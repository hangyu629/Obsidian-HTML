import { ItemView, type WorkspaceLeaf } from "obsidian";

import type { AnnotationService } from "./annotation-service";
import { annotationDisplayColor, type HtmlAnnotation } from "./types";

export const ANNOTATION_SIDEBAR_VIEW_TYPE = "html-preview-annotations";

type AnnotationFilter = "all" | "comments" | "highlights";

export interface AnnotationSidebarEnvironment {
  annotationService: Pick<AnnotationService, "load" | "subscribe">;
  focusAnnotation(sourcePath: string, id: string): Promise<boolean>;
  showNotice(message: string): void;
}

export class AnnotationSidebarView extends ItemView {
  private annotations: HtmlAnnotation[] = [];
  private filter: AnnotationFilter = "all";
  private loadToken = 0;
  private sourcePath: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly environment: AnnotationSidebarEnvironment
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ANNOTATION_SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "注释";
  }

  getIcon(): string {
    return "messages-square";
  }

  onload(): void {
    this.contentEl.classList.add("annotation-sidebar");
    this.render();
  }

  onunload(): void {
    this.loadToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }

  async setSource(sourcePath: string | null): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.sourcePath = sourcePath;
    this.filter = "all";
    this.annotations = [];
    const token = ++this.loadToken;
    this.render();
    if (!sourcePath) return;
    this.unsubscribe = this.environment.annotationService.subscribe(
      sourcePath,
      () => {
        void this.refresh();
      }
    );
    try {
      const annotations = await this.environment.annotationService.load(sourcePath);
      if (token !== this.loadToken || this.sourcePath !== sourcePath) return;
      this.annotations = [...annotations].sort(
        (left, right) => left.target.start - right.target.start
      );
      this.render();
    } catch (error) {
      if (token !== this.loadToken) return;
      this.environment.showNotice(
        `无法读取注释：${error instanceof Error ? error.message : String(error)}`
      );
      this.render("无法读取当前文件的注释");
    }
  }

  private async refresh(): Promise<void> {
    const sourcePath = this.sourcePath;
    if (!sourcePath) return;
    const token = ++this.loadToken;
    try {
      const annotations = await this.environment.annotationService.load(sourcePath);
      if (token !== this.loadToken || this.sourcePath !== sourcePath) return;
      this.annotations = [...annotations].sort(
        (left, right) => left.target.start - right.target.start
      );
      this.render();
    } catch (error) {
      if (token !== this.loadToken) return;
      this.environment.showNotice(
        `无法刷新注释：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private render(error?: string): void {
    const fragment = document.createDocumentFragment();
    const header = document.createElement("header");
    header.className = "annotation-sidebar-header";
    const title = document.createElement("h2");
    title.textContent = "本文注释";
    const count = document.createElement("span");
    count.className = "annotation-sidebar-count";
    count.textContent = String(this.annotations.length);
    header.append(title, count);
    fragment.append(header);

    if (!this.sourcePath) {
      fragment.append(this.empty("打开 HTML 或 Markdown 文件以查看注释"));
      this.contentEl.replaceChildren(fragment);
      return;
    }

    const filters = document.createElement("div");
    filters.className = "annotation-sidebar-filters";
    filters.setAttribute("role", "toolbar");
    filters.setAttribute("aria-label", "筛选注释");
    for (const [value, label] of [
      ["all", "全部"],
      ["comments", "有批注"],
      ["highlights", "仅高亮"]
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "annotation-sidebar-filter";
      button.setAttribute("aria-pressed", String(this.filter === value));
      button.addEventListener("click", () => {
        this.filter = value;
        this.render();
      });
      filters.append(button);
    }
    fragment.append(filters);

    if (error) {
      fragment.append(this.empty(error));
      this.contentEl.replaceChildren(fragment);
      return;
    }

    const visible = this.annotations.filter((annotation) => {
      const hasComment = annotation.comment.trim().length > 0;
      return this.filter === "all" ||
        (this.filter === "comments" && hasComment) ||
        (this.filter === "highlights" && !hasComment);
    });
    if (visible.length === 0) {
      fragment.append(this.empty(
        this.annotations.length === 0
          ? "当前文件还没有注释"
          : "没有符合当前筛选条件的注释"
      ));
      this.contentEl.replaceChildren(fragment);
      return;
    }

    const list = document.createElement("div");
    list.className = "annotation-sidebar-list";
    for (const annotation of visible) list.append(this.item(annotation));
    fragment.append(list);
    this.contentEl.replaceChildren(fragment);
  }

  private item(annotation: HtmlAnnotation): HTMLButtonElement {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "annotation-sidebar-item";
    item.dataset.annotationColor = annotationDisplayColor(annotation);
    const quote = document.createElement("span");
    quote.className = "annotation-sidebar-quote";
    quote.textContent = annotation.quote;
    item.append(quote);
    if (annotation.comment.trim()) {
      const comment = document.createElement("span");
      comment.className = "annotation-sidebar-comment";
      comment.textContent = annotation.comment;
      item.append(comment);
    }
    item.addEventListener("click", async () => {
      const sourcePath = this.sourcePath;
      if (!sourcePath) return;
      item.classList.remove("is-unresolved");
      const found = await this.environment.focusAnnotation(sourcePath, annotation.id);
      if (!found) {
        item.classList.add("is-unresolved");
        this.environment.showNotice("无法定位这条注释，原文可能已经发生变化。");
      }
    });
    return item;
  }

  private empty(message: string): HTMLElement {
    const empty = document.createElement("p");
    empty.className = "annotation-sidebar-empty";
    empty.textContent = message;
    return empty;
  }
}
