import { App, Modal, setIcon } from "obsidian";

import type { CleanupRule } from "./types";

export interface CleanupRulesModalOptions {
  onError(message: string): void;
  onPromote(rule: CleanupRule): Promise<void>;
  onReset(): Promise<void>;
  onRestore(rule: CleanupRule): Promise<void>;
  rules: readonly CleanupRule[];
  sourcePath: string;
  unmatchedRuleIds: ReadonlySet<string>;
}

export class CleanupRulesModal extends Modal {
  constructor(
    app: App,
    private readonly options: CleanupRulesModalOptions
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "Cleanup rules";
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("html-preview-cleanup-manager");

    if (this.options.rules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "html-preview-cleanup-empty";
      empty.textContent = "This page has no cleanup rules.";
      this.contentEl.append(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "html-preview-cleanup-rules";
    for (const rule of this.options.rules) {
      list.append(this.createRuleItem(rule));
    }
    this.contentEl.append(list);

    if (
      this.options.rules.some(
        (rule) =>
          rule.scope === "file" && rule.sourcePath === this.options.sourcePath
      )
    ) {
      const footer = document.createElement("div");
      footer.className = "html-preview-cleanup-footer";
      const reset = this.createButton(
        "trash-2",
        "Reset file rules",
        "reset-file",
        undefined,
        () => this.options.onReset()
      );
      const resetLabel = document.createElement("span");
      resetLabel.textContent = "Reset file rules";
      reset.append(resetLabel);
      footer.append(reset);
      this.contentEl.append(footer);
    }
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }

  private createRuleItem(rule: CleanupRule): HTMLLIElement {
    const item = document.createElement("li");
    item.className = "html-preview-cleanup-rule";

    const details = document.createElement("div");
    details.className = "html-preview-cleanup-rule-details";
    const summary = document.createElement("code");
    summary.className = "html-preview-cleanup-selector";
    summary.textContent = rule.selector;
    const metadata = document.createElement("div");
    metadata.className = "html-preview-cleanup-rule-meta";
    const scope = document.createElement("span");
    scope.className = `html-preview-cleanup-scope is-${rule.scope}`;
    scope.textContent = rule.scope === "file" ? "File" : "Folder";
    metadata.append(scope);
    if (rule.scope === "folder") {
      const path = document.createElement("span");
      path.textContent = rule.sourcePath === "." ? "Vault root" : rule.sourcePath;
      metadata.append(path);
    }
    if (this.options.unmatchedRuleIds.has(rule.id)) {
      const unmatched = document.createElement("span");
      unmatched.className = "html-preview-cleanup-unmatched";
      unmatched.textContent = "Not matched on this page";
      metadata.append(unmatched);
    }
    details.append(summary, metadata);

    const actions = document.createElement("div");
    actions.className = "html-preview-cleanup-rule-actions";
    actions.append(
      this.createButton("eye", "Restore cleanup rule", "restore", rule.id, () =>
        this.options.onRestore(rule)
      )
    );
    if (rule.scope === "file" && rule.sourcePath === this.options.sourcePath) {
      actions.append(
        this.createButton(
          "folder-up",
          "Apply cleanup rule to folder",
          "promote",
          rule.id,
          () => this.options.onPromote(rule)
        )
      );
    }
    item.append(details, actions);
    return item;
  }

  private createButton(
    icon: string,
    label: string,
    action: string,
    ruleId: string | undefined,
    callback: () => Promise<void>
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clickable-icon";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.cleanupAction = action;
    if (ruleId) button.dataset.ruleId = ruleId;
    setIcon(button, icon);
    button.addEventListener("click", () => {
      button.disabled = true;
      void callback()
        .then(() => this.close())
        .catch((error: unknown) => {
          button.disabled = false;
          this.options.onError(
            error instanceof Error ? error.message : String(error)
          );
        });
    });
    return button;
  }
}
