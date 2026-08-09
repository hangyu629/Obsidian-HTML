import { App, Modal, setIcon } from "obsidian";

export interface AnnotationSidebarBulkDeleteModalOptions {
  count: number;
  onConfirm(): Promise<void>;
  onError(error: unknown): void;
}

export class AnnotationSidebarBulkDeleteModal extends Modal {
  constructor(
    app: App,
    private readonly options: AnnotationSidebarBulkDeleteModalOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "删除筛选结果";
    this.contentEl.replaceChildren();

    const root = document.createElement("div");
    root.className = "annotation-sidebar-delete-modal";

    const summary = document.createElement("div");
    summary.className = "annotation-sidebar-delete-summary";
    const icon = document.createElement("div");
    icon.className = "annotation-sidebar-delete-icon";
    setIcon(icon, "trash-2");
    const copy = document.createElement("div");
    const message = document.createElement("p");
    message.className = "annotation-sidebar-delete-message";
    message.textContent = `将删除 ${this.options.count} 条注释`;
    const detail = document.createElement("p");
    detail.className = "annotation-sidebar-delete-detail";
    detail.textContent = "当前筛选结果中的高亮和批注都会被移除，此操作无法撤销。";
    copy.append(message, detail);
    summary.append(icon, copy);

    const actions = document.createElement("div");
    actions.className = "annotation-sidebar-delete-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "annotation-sidebar-delete-cancel";
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => this.close());
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "annotation-sidebar-delete-confirm";
    confirm.textContent = "确认删除";
    confirm.setAttribute("aria-label", "Confirm deleting filtered annotations");
    confirm.addEventListener("click", () => {
      cancel.disabled = true;
      confirm.disabled = true;
      confirm.textContent = "正在删除...";
      void this.options.onConfirm().then(() => this.close()).catch((error) => {
        cancel.disabled = false;
        confirm.disabled = false;
        confirm.textContent = "确认删除";
        this.options.onError(error);
      });
    });
    actions.append(cancel, confirm);

    root.append(summary, actions);
    this.contentEl.append(root);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
