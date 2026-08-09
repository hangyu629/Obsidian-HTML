import { Modal, type App } from "obsidian";

import { ANNOTATION_COLORS, type HtmlAnnotation } from "./types";
import {
  DEFAULT_ANNOTATION_SEARCH_QUERY,
  type AnnotationSearchQuery
} from "./search";

export interface AnnotationSearchModalEnvironment {
  open(sourcePath: string, id: string): Promise<boolean>;
  search(query: AnnotationSearchQuery): Promise<HtmlAnnotation[]>;
}

export class AnnotationSearchModal extends Modal {
  private query: AnnotationSearchQuery = { ...DEFAULT_ANNOTATION_SEARCH_QUERY };

  constructor(
    app: App,
    private readonly environment: AnnotationSearchModalEnvironment
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "搜索全部注释";
    this.render();
    void this.refresh();
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }

  private render(results: readonly HtmlAnnotation[] = []): void {
    const root = document.createElement("div");
    root.className = "annotation-search-modal";
    const controls = document.createElement("div");
    controls.className = "annotation-search-controls";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "annotation-search-input";
    input.placeholder = "搜索摘录、批注或文件";
    input.setAttribute("aria-label", "Search annotations");
    input.value = this.query.query;
    input.addEventListener("input", () => {
      this.query = { ...this.query, query: input.value };
      void this.refresh();
    });
    const folder = document.createElement("input");
    folder.type = "text";
    folder.className = "annotation-search-folder";
    folder.placeholder = "文件夹路径（可选）";
    folder.setAttribute("aria-label", "Annotation folder");
    folder.value = this.query.folder;
    folder.addEventListener("change", () => {
      this.query = { ...this.query, folder: folder.value };
      void this.refresh();
    });
    const color = document.createElement("select");
    color.setAttribute("aria-label", "Annotation color filter");
    for (const [value, label] of [["all", "全部颜色"], ...ANNOTATION_COLORS.map((value) => [value, value] as const)]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      color.append(option);
    }
    color.value = this.query.color;
    color.addEventListener("change", () => {
      this.query = { ...this.query, color: color.value as AnnotationSearchQuery["color"] };
      void this.refresh();
    });
    const kind = document.createElement("select");
    kind.setAttribute("aria-label", "Annotation type filter");
    for (const [value, label] of [["all", "全部类型"], ["comments", "有批注"], ["highlights", "仅高亮"]] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      kind.append(option);
    }
    kind.value = this.query.kind;
    kind.addEventListener("change", () => {
      this.query = { ...this.query, kind: kind.value as AnnotationSearchQuery["kind"] };
      void this.refresh();
    });
    controls.append(input, folder, color, kind);
    root.append(controls);

    const list = document.createElement("div");
    list.className = "annotation-search-results";
    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "annotation-search-empty";
      empty.textContent = "没有符合条件的注释";
      list.append(empty);
    }
    for (const annotation of results) {
      const result = document.createElement("button");
      result.type = "button";
      result.className = "annotation-search-result";
      result.dataset.annotationColor = annotation.color ?? "yellow";
      const quote = document.createElement("strong");
      quote.textContent = annotation.quote;
      const detail = document.createElement("span");
      detail.textContent = annotation.comment.trim() || "仅高亮";
      const path = document.createElement("small");
      path.textContent = annotation.sourcePath;
      result.append(quote, detail, path);
      result.addEventListener("click", () => {
        void this.environment.open(annotation.sourcePath, annotation.id)
          .then((opened) => {
            if (opened) this.close();
          });
      });
      list.append(result);
    }
    root.append(list);
    this.contentEl.replaceChildren(root);
  }

  private async refresh(): Promise<void> {
    try {
      this.render(await this.environment.search(this.query));
    } catch {
      this.render();
    }
  }
}
