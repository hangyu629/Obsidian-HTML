import { App, Modal, setIcon } from "obsidian";

import type { HtmlAnnotation } from "./types";

export interface AnnotationsModalOptions {
  annotations: readonly HtmlAnnotation[];
  onDelete(annotation: HtmlAnnotation): Promise<void>;
  onError(message: string): void;
}

export class AnnotationsModal extends Modal {
  constructor(app: App, private readonly options: AnnotationsModalOptions) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "HTML annotations";
    this.contentEl.replaceChildren();
    if (this.options.annotations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "html-preview-cleanup-empty";
      empty.textContent = "No annotations saved for this page.";
      this.contentEl.append(empty);
      return;
    }
    const list = document.createElement("ul");
    list.className = "html-preview-cleanup-rules";
    for (const annotation of this.options.annotations) {
      const item = document.createElement("li");
      item.className = "html-preview-cleanup-rule";
      const details = document.createElement("div");
      details.className = "html-preview-cleanup-rule-details";
      const quote = document.createElement("code");
      quote.className = "html-preview-cleanup-selector";
      quote.textContent = annotation.quote;
      const comment = document.createElement("div");
      comment.className = "html-preview-cleanup-rule-meta";
      const text = document.createElement("span");
      text.textContent = annotation.comment;
      comment.append(text);
      details.append(quote, comment);
      const actions = document.createElement("div");
      actions.className = "html-preview-cleanup-rule-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clickable-icon";
      button.title = "Delete annotation";
      button.setAttribute("aria-label", "Delete annotation");
      setIcon(button, "trash-2");
      button.addEventListener("click", () => {
        button.disabled = true;
        void this.options.onDelete(annotation).then(() => this.close()).catch((error) => {
          button.disabled = false;
          this.options.onError(error instanceof Error ? error.message : String(error));
        });
      });
      actions.append(button);
      item.append(details, actions);
      list.append(item);
    }
    this.contentEl.append(list);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
