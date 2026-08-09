import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";

import type { AnnotationService } from "./annotation-service";
import { AnnotationSidebarEditModal } from "./sidebar-edit-modal";
import { annotationDisplayColor, type HtmlAnnotation } from "./types";

export const ANNOTATION_SIDEBAR_VIEW_TYPE = "html-preview-annotations";

type AnnotationFilter = "all" | "comments" | "highlights";
type AnnotationSort = "document" | "newest";

export interface AnnotationSidebarEnvironment {
  annotationService: Pick<AnnotationService, "load" | "subscribe">;
  exportAnnotations(sourcePath: string, annotations: readonly HtmlAnnotation[]): Promise<void>;
  repairAnnotation(sourcePath: string, id: string): Promise<boolean>;
  searchAnnotations(): void;
  focusAnnotation(sourcePath: string, id: string): Promise<boolean>;
  removeAnnotation(annotation: HtmlAnnotation): Promise<void>;
  saveAnnotation(sourcePath: string, annotation: HtmlAnnotation): Promise<void>;
  copyText(text: string): Promise<void>;
  showNotice(message: string): void;
}

export class AnnotationSidebarView extends ItemView {
  private annotations: HtmlAnnotation[] = [];
  private filter: AnnotationFilter = "all";
  private sort: AnnotationSort = "document";
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
    const search = document.createElement("button");
    search.type = "button";
    search.className = "clickable-icon annotation-sidebar-search";
    search.title = "搜索全部注释";
    search.setAttribute("aria-label", "Search all annotations");
    setIcon(search, "search");
    search.addEventListener("click", () => this.environment.searchAnnotations());
    header.append(search);
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

    const management = document.createElement("div");
    management.className = "annotation-sidebar-management";
    const sort = document.createElement("select");
    sort.className = "annotation-sidebar-sort";
    sort.setAttribute("aria-label", "Annotation sort order");
    for (const [value, label] of [
      ["document", "文档顺序"],
      ["newest", "最新优先"]
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sort.append(option);
    }
    sort.value = this.sort;
    sort.addEventListener("change", () => {
      this.sort = sort.value === "newest" ? "newest" : "document";
      this.render();
    });
    const bulkDelete = document.createElement("button");
    bulkDelete.type = "button";
    bulkDelete.className = "annotation-sidebar-bulk-delete";
    bulkDelete.setAttribute("aria-label", "Delete filtered annotations");
    bulkDelete.textContent = "删除当前筛选";
    const bulkColor = document.createElement("select");
    bulkColor.className = "annotation-sidebar-bulk-color";
    bulkColor.setAttribute("aria-label", "Batch annotation color");
    const noColor = document.createElement("option");
    noColor.value = "";
    noColor.textContent = "批量改色";
    bulkColor.append(noColor);
    for (const color of ["yellow", "green", "blue", "pink", "violet"] as const) {
      const option = document.createElement("option");
      option.value = color;
      option.textContent = color;
      bulkColor.append(option);
    }
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "annotation-sidebar-export";
    exportButton.setAttribute("aria-label", "Export annotations as Markdown");
    exportButton.title = "导出全部注释为 Markdown";
    setIcon(exportButton, "file-down");
    const exportLabel = document.createElement("span");
    exportLabel.textContent = "导出";
    exportButton.append(exportLabel);
    exportButton.addEventListener("click", () => {
      const sourcePath = this.sourcePath;
      if (!sourcePath) return;
      exportButton.disabled = true;
      void this.environment.exportAnnotations(sourcePath, this.annotations)
        .catch((error) => {
          this.environment.showNotice(
            error instanceof Error ? error.message : String(error)
          );
        })
        .finally(() => {
          exportButton.disabled = false;
        });
    });
    management.append(sort, bulkColor, exportButton, bulkDelete);
    fragment.append(management);

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
    }).sort((left, right) =>
      this.sort === "newest"
        ? right.target.start - left.target.start
        : left.target.start - right.target.start
    );
    bulkDelete.disabled = visible.length === 0;
    bulkColor.disabled = visible.length === 0;
    bulkColor.addEventListener("change", () => {
      const sourcePath = this.sourcePath;
      if (!sourcePath) return;
      const color = bulkColor.value as HtmlAnnotation["color"];
      bulkColor.value = "";
      if (!color) return;
      bulkColor.disabled = true;
      void Promise.all(visible.map((annotation) =>
        this.environment.saveAnnotation(sourcePath, { ...annotation, color })
      )).catch((error) => {
        this.environment.showNotice(error instanceof Error ? error.message : String(error));
      }).finally(() => {
        bulkColor.disabled = false;
      });
    });
    bulkDelete.addEventListener("click", () => {
      bulkDelete.disabled = true;
      void Promise.all(visible.map((annotation) => this.environment.removeAnnotation(annotation)))
        .catch((error) => {
          this.environment.showNotice(
            error instanceof Error ? error.message : String(error)
          );
        });
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

  private item(annotation: HtmlAnnotation): HTMLElement {
    const sourcePath = this.sourcePath;
    const entry = document.createElement("div");
    entry.className = "annotation-sidebar-entry";
    const item = document.createElement("button");
    item.type = "button";
    item.className = "annotation-sidebar-item";
    item.dataset.annotationColor = annotationDisplayColor(annotation);
    const quote = document.createElement("span");
    quote.className = "annotation-sidebar-quote";
    quote.textContent = annotation.quote;
    item.append(quote);
    if (annotation.comment.trim()) {
      const note = document.createElement("div");
      note.className = "annotation-sidebar-note";
      const label = document.createElement("div");
      label.className = "annotation-sidebar-comment-label";
      label.textContent = "批注";
      const comment = document.createElement("div");
      comment.className = "annotation-sidebar-comment";
      comment.textContent = annotation.comment;
      note.append(label, comment);
      item.append(note);
    } else {
      const label = document.createElement("div");
      label.className = "annotation-sidebar-highlight-label";
      label.textContent = "仅高亮";
      item.append(label);
    }
    item.addEventListener("click", async () => {
      if (!sourcePath) return;
      item.classList.remove("is-unresolved");
      const found = await this.environment.focusAnnotation(sourcePath, annotation.id);
      if (!found) {
        item.classList.add("is-unresolved");
        this.environment.showNotice("无法定位这条注释，原文可能已经发生变化。");
      }
    });

    const actions = document.createElement("div");
    actions.className = "annotation-sidebar-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "clickable-icon annotation-sidebar-action";
    edit.dataset.annotationAction = "edit";
    edit.setAttribute("aria-label", "Edit annotation");
    edit.title = "编辑批注";
    setIcon(edit, "pencil");
    edit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sourcePath) return;
      new AnnotationSidebarEditModal(this.app, {
        annotation,
        onSave: (updated) => this.environment.saveAnnotation(sourcePath, updated)
      }).open();
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "clickable-icon annotation-sidebar-action";
    copy.dataset.annotationAction = "copy";
    copy.setAttribute("aria-label", "Copy annotation");
    copy.title = "复制摘录和批注";
    setIcon(copy, "copy");
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = annotation.comment.trim()
        ? `${annotation.quote}\n\n${annotation.comment}`
        : annotation.quote;
      void this.environment.copyText(text).catch((error) => {
        this.environment.showNotice(error instanceof Error ? error.message : String(error));
      });
    });
    const repair = document.createElement("button");
    repair.type = "button";
    repair.className = "clickable-icon annotation-sidebar-action annotation-sidebar-repair";
    repair.dataset.annotationAction = "repair";
    repair.setAttribute("aria-label", "Repair annotation");
    repair.title = "重新定位批注";
    setIcon(repair, "locate-fixed");
    repair.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sourcePath) return;
      repair.disabled = true;
      void this.environment.repairAnnotation(sourcePath, annotation.id)
        .then((started) => {
          if (!started) this.environment.showNotice("当前视图无法开始重新定位。请先打开原文预览。 ");
        })
        .catch((error) => {
          this.environment.showNotice(
            error instanceof Error ? error.message : String(error)
          );
        })
        .finally(() => {
          repair.disabled = false;
        });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "clickable-icon annotation-sidebar-action";
    remove.dataset.annotationAction = "delete";
    remove.setAttribute("aria-label", "Delete annotation");
    remove.title = "删除批注";
    setIcon(remove, "trash-2");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      remove.disabled = true;
      void this.environment.removeAnnotation(annotation).catch((error) => {
        remove.disabled = false;
        this.environment.showNotice(
          error instanceof Error ? error.message : String(error)
        );
      });
    });
    actions.append(edit, copy, repair, remove);
    entry.append(item, actions);
    return entry;
  }

  private empty(message: string): HTMLElement {
    const empty = document.createElement("p");
    empty.className = "annotation-sidebar-empty";
    empty.textContent = message;
    return empty;
  }
}
