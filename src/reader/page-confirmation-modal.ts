import { App, Modal, setIcon } from "obsidian";

export interface ReaderPageConfirmationModalOptions {
  mode: "restore" | "save";
  onConfirm(): Promise<void>;
  onError(error: unknown): void;
  sourcePath: string;
}

export class ReaderPageConfirmationModal extends Modal {
  constructor(
    app: App,
    private readonly options: ReaderPageConfirmationModalOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent =
      this.options.mode === "save" ? "Save reading page" : "Restore original page";
    this.contentEl.replaceChildren();

    const root = document.createElement("div");
    root.className = "html-reader-confirmation";

    const summary = document.createElement("div");
    summary.className = "html-reader-confirmation-summary";
    const icon = document.createElement("div");
    icon.className = "html-reader-confirmation-icon";
    setIcon(icon, this.options.mode === "save" ? "save" : "history");

    const copy = document.createElement("div");
    const path = document.createElement("code");
    path.className = "html-reader-confirmation-path";
    path.textContent = this.options.sourcePath;
    const detail = document.createElement("p");
    detail.className = "html-reader-confirmation-detail";
    detail.textContent =
      this.options.mode === "save"
        ? "A hidden backup is created first, then the current HTML is replaced by the clean reading page."
        : "The saved original will replace the current HTML after confirmation.";
    copy.append(path, detail);
    summary.append(icon, copy);

    const consequence = document.createElement("p");
    consequence.className = "html-reader-confirmation-consequence";
    consequence.textContent =
      this.options.mode === "save"
        ? "This keeps the file browser-friendly while preserving one recoverable original copy."
        : "This replaces the current HTML file and removes the consumed hidden backup.";

    const actions = document.createElement("div");
    actions.className = "html-reader-confirmation-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.dataset.readerCancel = "true";
    cancel.className = "html-reader-confirmation-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.close());
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.dataset.readerConfirm = "true";
    confirm.className = "html-reader-confirmation-confirm";
    confirm.textContent = this.options.mode === "save" ? "Replace HTML" : "Restore original";
    confirm.addEventListener("click", () => {
      cancel.disabled = true;
      confirm.disabled = true;
      confirm.textContent = this.options.mode === "save" ? "Saving..." : "Restoring...";
      void this.options
        .onConfirm()
        .then(() => this.close())
        .catch((error) => {
          cancel.disabled = false;
          confirm.disabled = false;
          confirm.textContent =
            this.options.mode === "save" ? "Replace HTML" : "Restore original";
          this.options.onError(error);
        });
    });
    actions.append(cancel, confirm);

    root.append(summary, consequence, actions);
    this.contentEl.append(root);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
