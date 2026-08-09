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

    const quote = document.createElement("blockquote");
    quote.className = "annotation-sidebar-modal-quote";
    quote.textContent = `“${this.options.annotation.quote}”`;

    const colorLabel = document.createElement("label");
    colorLabel.className = "annotation-sidebar-modal-label";
    colorLabel.textContent = "颜色";
    const color = document.createElement("select");
    color.className = "annotation-sidebar-modal-select";
    color.setAttribute("aria-label", "Annotation color");
    for (const value of ANNOTATION_COLORS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = COLOR_LABELS[value];
      color.append(option);
    }
    color.value = this.options.annotation.color ?? "yellow";

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
      color.disabled = true;
      textarea.disabled = true;
      void this.options.onSave({
        ...this.options.annotation,
        color: color.value as AnnotationColor,
        comment: textarea.value.trim()
      }).then(() => this.close()).catch(() => {
        save.disabled = false;
        cancel.disabled = false;
        color.disabled = false;
        textarea.disabled = false;
      });
    });
    actions.append(cancel, save);

    this.contentEl.append(colorLabel, color, quote, commentLabel, textarea, actions);
    textarea.focus();
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
