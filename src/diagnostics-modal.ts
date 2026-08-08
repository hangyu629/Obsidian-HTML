import { App, Modal } from "obsidian";

import type { DiagnosticLevel } from "./preview/types";

export interface DisplayDiagnostic {
  level: DiagnosticLevel;
  message: string;
}

export class DiagnosticsModal extends Modal {
  constructor(app: App, private readonly diagnostics: readonly DisplayDiagnostic[]) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "HTML preview diagnostics";
    this.contentEl.replaceChildren();

    if (this.diagnostics.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No compatibility issues were detected.";
      this.contentEl.append(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "html-preview-diagnostics";
    for (const diagnostic of this.diagnostics) {
      const item = document.createElement("li");
      item.className = `html-preview-diagnostic is-${diagnostic.level}`;
      item.textContent = diagnostic.message;
      list.append(item);
    }
    this.contentEl.append(list);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}

