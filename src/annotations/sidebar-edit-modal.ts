import { App, Modal } from "obsidian";

import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  type HtmlAnnotation
} from "./types";

const COLOR_LABELS: Record<AnnotationColor, string> = {
  blue: "蓝色",
  green: "绿色",
  pink: "粉色",
  violet: "紫色",
  yellow: "黄色"
};

export interface AnnotationSidebarEditModalOptions {
  annotation: HtmlAnnotation;
  onSave(annotation: HtmlAnnotation): Promise<void>;
}

export class AnnotationSidebarEditModal extends Modal {
  constructor(
    app: App,
    private readonly options: AnnotationSidebarEditModalOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "编辑批注";
    this.contentEl.replaceChildren();

    let selectedColor: AnnotationColor = this.options.annotation.color ?? "yellow";

    const root = document.createElement("div");
    root.className = "annotation-sidebar-modal";

    const meta = document.createElement("p");
    meta.className = "annotation-sidebar-modal-meta";
    meta.textContent = "调整高亮颜色和批注内容";

    const quote = document.createElement("blockquote");
    quote.className = "annotation-sidebar-modal-quote";
    quote.textContent = `“${this.options.annotation.quote}”`;

    const quoteCard = document.createElement("div");
    quoteCard.className = "annotation-sidebar-modal-quote-card";
    quoteCard.append(quote);

    const colorLabel = document.createElement("label");
    colorLabel.className = "annotation-sidebar-modal-label";
    colorLabel.textContent = "颜色";

    const palette = document.createElement("div");
    palette.className = "annotation-sidebar-modal-palette";
    palette.setAttribute("aria-label", "Annotation color");
    for (const value of ANNOTATION_COLORS) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "annotation-sidebar-modal-swatch";
      swatch.dataset.annotationColorChoice = value;
      swatch.dataset.annotationColor = value;
      swatch.setAttribute("aria-label", COLOR_LABELS[value]);
      swatch.setAttribute("aria-pressed", String(value === selectedColor));
      swatch.addEventListener("click", () => {
        selectedColor = value;
        for (const candidate of palette.querySelectorAll<HTMLElement>("[data-annotation-color-choice]")) {
          candidate.setAttribute(
            "aria-pressed",
            String(candidate.dataset.annotationColorChoice === selectedColor)
          );
        }
      });
      palette.append(swatch);
    }

    const commentLabel = document.createElement("label");
    commentLabel.className = "annotation-sidebar-modal-label";
    commentLabel.textContent = "批注";
    const textarea = document.createElement("textarea");
    textarea.className = "annotation-sidebar-modal-textarea";
    textarea.setAttribute("aria-label", "Annotation comment");
    textarea.value = this.options.annotation.comment;

    const actions = document.createElement("div");
    actions.className = "annotation-sidebar-modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "annotation-sidebar-modal-secondary";
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => this.close());
    const save = document.createElement("button");
    save.type = "button";
    save.className = "annotation-sidebar-modal-primary";
    save.textContent = "保存";
    save.setAttribute("aria-label", "Save annotation");
    save.addEventListener("click", () => {
      save.disabled = true;
      cancel.disabled = true;
      for (const swatch of palette.querySelectorAll<HTMLButtonElement>("button")) {
        swatch.disabled = true;
      }
      textarea.disabled = true;
      void this.options.onSave({
        ...this.options.annotation,
        color: selectedColor,
        comment: textarea.value.trim()
      }).then(() => this.close()).catch(() => {
        save.disabled = false;
        cancel.disabled = false;
        for (const swatch of palette.querySelectorAll<HTMLButtonElement>("button")) {
          swatch.disabled = false;
        }
        textarea.disabled = false;
      });
    });
    actions.append(cancel, save);

    root.append(meta, quoteCard, colorLabel, palette, commentLabel, textarea, actions);
    this.contentEl.append(root);
    textarea.focus();
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
