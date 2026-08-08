import { FileView, TFile, WorkspaceLeaf } from "obsidian";

import { DiagnosticsModal, type DisplayDiagnostic } from "./diagnostics-modal";
import { NAVIGATION_MESSAGE_TYPE } from "./preview/bridge-script";
import { buildPreviewDocument } from "./preview/document-builder";
import { classifyNavigation } from "./preview/navigation";
import type { PreviewCoordinator } from "./preview/preview-coordinator";
import type { PreviewNavigationMessage } from "./preview/types";
import type { HtmlPreviewSettings } from "./settings";

export const HTML_PREVIEW_VIEW_TYPE = "html-preview";
const SANDBOX_FLAGS =
  "allow-scripts allow-forms allow-modals allow-popups allow-downloads";

export interface HtmlPreviewEnvironment {
  coordinator: PreviewCoordinator;
  createRenderId?: () => string;
  getKnownVaultPaths(): ReadonlySet<string>;
  getSettings(): HtmlPreviewSettings;
  openExternal(url: string): void;
}

let nextViewId = 0;
let nextRenderId = 0;

function isNavigationMessage(value: unknown): value is PreviewNavigationMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === NAVIGATION_MESSAGE_TYPE &&
    typeof candidate.renderId === "string" &&
    typeof candidate.href === "string" &&
    candidate.href.length <= 8_192
  );
}

export class HtmlPreviewView extends FileView {
  private activeRenderId = "";
  private diagnostics: DisplayDiagnostic[] = [];
  private frame: HTMLIFrameElement | null = null;
  private readonly viewId = `html-preview-${++nextViewId}`;
  private renderToken = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly environment: HtmlPreviewEnvironment
  ) {
    super(leaf);
  }

  getViewType(): string {
    return HTML_PREVIEW_VIEW_TYPE;
  }

  getIcon(): string {
    return "file-code-2";
  }

  onload(): void {
    super.onload();
    this.contentEl.classList.add("html-preview-view");
    this.addAction("rotate-cw", "Reload preview", () => {
      void this.reload();
    });
    this.addAction("external-link", "Open outside Obsidian", () => {
      this.openCurrentExternally();
    });
    this.addAction("circle-alert", "Preview diagnostics", () => {
      new DiagnosticsModal(this.app, this.diagnostics).open();
    });
    this.registerDomEvent(window, "message", (event) => {
      void this.handleMessage(event as MessageEvent<unknown>);
    });
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.file = file;
    this.subscribe(file.path);
    await this.render();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeRenderId = "";
    this.frame = null;
    this.contentEl.replaceChildren();
    if (this.file?.path === file.path) {
      this.file = null;
    }
    await super.onUnloadFile(file);
  }

  async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    this.file = file;
    this.subscribe(file.path);
    await this.render();
  }

  onunload(): void {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.frame = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }

  async reload(): Promise<void> {
    await this.render();
  }

  private subscribe(sourcePath: string): void {
    this.unsubscribe?.();
    this.unsubscribe = this.environment.coordinator.subscribe(
      this.viewId,
      sourcePath,
      new Set(),
      () => {
        void this.render();
      }
    );
  }

  private async render(): Promise<void> {
    const file = this.file;
    if (!file) {
      this.showState("No HTML file is open.");
      return;
    }

    const token = ++this.renderToken;
    const renderId =
      this.environment.createRenderId?.() ?? `render-${++nextRenderId}`;

    try {
      const source = await this.app.vault.cachedRead(file);
      if (token !== this.renderToken || this.file?.path !== file.path) {
        return;
      }

      const result = buildPreviewDocument({
        allowScripts: this.environment.getSettings().allowScripts,
        knownVaultPaths: this.environment.getKnownVaultPaths(),
        renderId,
        resourceUrl: this.app.vault.getResourcePath(file),
        source,
        sourcePath: file.path
      });
      if (token !== this.renderToken) {
        return;
      }

      const frame = document.createElement("iframe");
      frame.className = "html-preview-frame";
      frame.setAttribute("sandbox", SANDBOX_FLAGS);
      frame.setAttribute("title", `Preview of ${file.name}`);
      frame.srcdoc = result.html;
      this.contentEl.replaceChildren(frame);
      this.frame = frame;
      this.activeRenderId = renderId;
      this.diagnostics = result.diagnostics;
      this.environment.coordinator.update(
        this.viewId,
        file.path,
        result.dependencies
      );
    } catch (error) {
      if (token !== this.renderToken) {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      this.diagnostics = [
        { level: "error", message: `The HTML file could not be read: ${detail}` }
      ];
      this.frame = null;
      this.activeRenderId = "";
      this.showState("Unable to preview this HTML file");
    }
  }

  private async handleMessage(event: MessageEvent<unknown>): Promise<void> {
    if (
      this.frame === null ||
      event.source !== this.frame.contentWindow ||
      !isNavigationMessage(event.data) ||
      event.data.renderId !== this.activeRenderId ||
      this.file === null
    ) {
      return;
    }

    const decision = classifyNavigation(event.data.href, this.file.path);
    if (decision.kind === "external") {
      this.environment.openExternal(decision.url);
      return;
    }
    if (decision.kind === "vault") {
      if (!this.environment.getKnownVaultPaths().has(decision.path)) {
        this.diagnostics.push({
          level: "warning",
          message: `Linked Vault file was not found: ${decision.path}`
        });
        return;
      }
      await this.app.workspace.openLinkText(
        `${decision.path}${decision.subpath}`,
        this.file.path,
        false
      );
      return;
    }
    if (decision.kind === "blocked") {
      this.diagnostics.push({ level: "warning", message: decision.reason });
    }
  }

  private openCurrentExternally(): void {
    if (this.file) {
      this.environment.openExternal(this.app.vault.getResourcePath(this.file));
    }
  }

  private showState(message: string): void {
    const state = document.createElement("div");
    state.className = "html-preview-state";
    const text = document.createElement("p");
    text.textContent = message;
    state.append(text);
    this.contentEl.replaceChildren(state);
    this.frame = null;
  }
}

