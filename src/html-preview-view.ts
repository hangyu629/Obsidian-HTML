import { FileView, TFile, WorkspaceLeaf } from "obsidian";

import { AnnotationsModal } from "./annotations/annotations-modal";
import type { HtmlAnnotationStore } from "./annotations/annotation-store";
import type { HtmlAnnotation } from "./annotations/types";
import { ANNOTATION_MODE_MESSAGE_TYPE, ANNOTATION_SELECTED_MESSAGE_TYPE } from "./annotations/runtime";
import { DiagnosticsModal, type DisplayDiagnostic } from "./diagnostics-modal";
import { CleanupRulesModal } from "./cleanup/rules-modal";
import type { CleanupRuleStore } from "./cleanup/rule-store";
import { parseCleanupCandidate } from "./cleanup/rule-validation";
import {
  CLEANUP_MODE_MESSAGE_TYPE,
  CLEANUP_MODE_STATE_MESSAGE_TYPE,
  CLEANUP_SELECTED_MESSAGE_TYPE,
  CLEANUP_UNMATCHED_MESSAGE_TYPE
} from "./cleanup/runtime";
import type { CleanupCandidate, CleanupRule } from "./cleanup/types";
import {
  createRenderId,
  NAVIGATION_MESSAGE_TYPE
} from "./preview/bridge-script";
import { buildPreviewDocument } from "./preview/document-builder";
import { classifyNavigation } from "./preview/navigation";
import type { PreviewCoordinator } from "./preview/preview-coordinator";
import type { PreviewNavigationMessage } from "./preview/types";
import type { HtmlPreviewSettings } from "./settings";

export const HTML_PREVIEW_VIEW_TYPE = "html-preview";
const SANDBOX_FLAGS =
  "allow-scripts allow-forms allow-modals allow-popups allow-downloads";
const SCRIPT_FREE_SANDBOX_FLAGS =
  "allow-forms allow-modals allow-popups allow-downloads";

export interface HtmlPreviewEnvironment {
  annotationStore: Pick<HtmlAnnotationStore, "addFileAnnotation" | "load" | "removeAnnotation">;
  cleanupStore: Pick<
    CleanupRuleStore,
    | "addFileRule"
    | "loadEffective"
    | "promoteToFolder"
    | "removeRule"
    | "resetFileRules"
  >;
  coordinator: PreviewCoordinator;
  createAnnotationId?: () => string;
  createRenderId?: () => string;
  createRuleId?: () => string;
  getKnownVaultPaths(): ReadonlySet<string>;
  getSettings(): Pick<HtmlPreviewSettings, "allowScripts">;
  openExternal(url: string): void;
  promptAnnotation(quote: string): Promise<string | null>;
  showNotice(message: string): void;
}

let nextViewId = 0;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCleanupSelection(value: unknown): CleanupCandidate | null {
  if (!isRecord(value) || value.type !== CLEANUP_SELECTED_MESSAGE_TYPE) {
    return null;
  }
  return parseCleanupCandidate(value.candidate);
}

function parseUnmatchedRuleIds(value: unknown): string[] | null {
  if (
    !isRecord(value) ||
    value.type !== CLEANUP_UNMATCHED_MESSAGE_TYPE ||
    !Array.isArray(value.ruleIds) ||
    value.ruleIds.length > 500
  ) {
    return null;
  }
  const ruleIds = value.ruleIds;
  return ruleIds.every(
    (item): item is string =>
      typeof item === "string" && /^[0-9a-f]{32}$/.test(item)
  )
    ? ruleIds
    : null;
}

function parseCleanupModeState(value: unknown): boolean | null {
  return isRecord(value) &&
    value.type === CLEANUP_MODE_STATE_MESSAGE_TYPE &&
    typeof value.enabled === "boolean"
    ? value.enabled
    : null;
}

export class HtmlPreviewView extends FileView {
  private activeRenderId = "";
  private activeAnnotations: HtmlAnnotation[] = [];
  private activeRules: CleanupRule[] = [];
  private cleanupAction: HTMLElement | null = null;
  private cleanupMode = false;
  private diagnostics: DisplayDiagnostic[] = [];
  private frame: HTMLIFrameElement | null = null;
  private readonly viewId = `html-preview-${++nextViewId}`;
  private renderToken = 0;
  private undoStack: CleanupRule[] = [];
  private unmatchedRuleIds = new Set<string>();
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
    this.addAction("message-square-plus", "Add annotation", () => {
      this.requestAnnotationSelection();
    });
    this.addAction("messages-square", "Manage annotations", () => {
      this.openAnnotationManager();
    });
    this.cleanupAction = this.addAction("eraser", "Clean up page", () => {
      this.toggleCleanupMode();
    });
    this.updateCleanupAction();
    this.addAction("undo-2", "Undo cleanup", () => {
      void this.undoCleanup();
    });
    this.addAction("list-x", "Manage cleanup rules", () => {
      this.openCleanupManager();
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
    if (this.file?.path !== file.path) {
      this.undoStack = [];
      this.setCleanupMode(false, false);
    }
    this.file = file;
    this.subscribe(file.path);
    await this.render();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.unmatchedRuleIds.clear();
    this.undoStack = [];
    this.setCleanupMode(false, false);
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
    this.undoStack = [];
    this.setCleanupMode(false, false);
    this.subscribe(file.path);
    await this.render();
  }

  onunload(): void {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.unmatchedRuleIds.clear();
    this.undoStack = [];
    this.setCleanupMode(false, false);
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
    const renderId = this.environment.createRenderId?.() ?? createRenderId();
    const allowScripts = this.environment.getSettings().allowScripts;

    try {
      const [source, cleanupRules, annotations] = await Promise.all([
        this.app.vault.cachedRead(file),
        this.loadCleanupRules(file.path, allowScripts),
        this.environment.annotationStore.load(file.path)
      ]);
      if (token !== this.renderToken || this.file?.path !== file.path) {
        return;
      }

      const result = buildPreviewDocument({
        allowScripts,
        cleanupRules,
        annotations,
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
      frame.setAttribute(
        "sandbox",
        allowScripts ? SANDBOX_FLAGS : SCRIPT_FREE_SANDBOX_FLAGS
      );
      frame.setAttribute("title", `Preview of ${file.name}`);
      frame.srcdoc = result.html;
      this.frame = frame;
      this.activeRenderId = renderId;
      this.activeAnnotations = annotations;
      this.activeRules = cleanupRules;
      this.unmatchedRuleIds.clear();
      this.diagnostics = result.diagnostics;
      frame.addEventListener("load", () => {
        if (this.frame === frame && this.cleanupMode) {
          this.postCleanupMode();
        }
      });
      this.contentEl.replaceChildren(frame);
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
      this.activeAnnotations = [];
      this.activeRules = [];
      this.showState("Unable to preview this HTML file");
    }
  }

  private async handleMessage(event: MessageEvent<unknown>): Promise<void> {
    if (
      this.frame === null ||
      event.source !== this.frame.contentWindow ||
      !isRecord(event.data) ||
      event.data.renderId !== this.activeRenderId ||
      this.file === null
    ) {
      return;
    }

    const candidate = parseCleanupSelection(event.data);
    if (candidate) {
      if (!this.cleanupMode) {
        return;
      }
      await this.saveCleanupRule(candidate, this.file.path, this.activeRenderId);
      return;
    }

    const annotation = parseAnnotationSelection(event.data);
    if (annotation) {
      await this.saveAnnotation(annotation, this.file.path);
      return;
    }

    const cleanupModeState = parseCleanupModeState(event.data);
    if (cleanupModeState !== null) {
      this.setCleanupMode(cleanupModeState, false);
      return;
    }

    const unmatchedRuleIds = parseUnmatchedRuleIds(event.data);
    if (unmatchedRuleIds) {
      this.unmatchedRuleIds = new Set(unmatchedRuleIds);
      return;
    }

    if (!isNavigationMessage(event.data)) {
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

  private requestAnnotationSelection(): void {
    if (!this.environment.getSettings().allowScripts) {
      this.environment.showNotice(
        "Enable page JavaScript in HTML Preview settings to use annotations."
      );
      return;
    }
    if (!this.frame?.contentWindow || !this.file) return;
    this.frame.contentWindow.postMessage(
      { enabled: true, renderId: this.activeRenderId, type: ANNOTATION_MODE_MESSAGE_TYPE },
      "*"
    );
    this.environment.showNotice("Select text in the page to add an annotation.");
  }

  private async saveAnnotation(
    annotation: { quote: string; target: HtmlAnnotation["target"] },
    sourcePath: string
  ): Promise<void> {
    const comment = await this.environment.promptAnnotation(annotation.quote);
    if (!comment || comment.trim().length === 0) return;
    await this.environment.annotationStore.addFileAnnotation(sourcePath, {
      comment: comment.trim(),
      id: this.environment.createAnnotationId?.() ?? createRenderId(),
      quote: annotation.quote,
      sourcePath,
      target: annotation.target
    });
    this.environment.showNotice("Annotation added.");
    await this.reload();
  }

  private openAnnotationManager(): void {
    if (!this.file) return;
    new AnnotationsModal(this.app, {
      annotations: this.activeAnnotations,
      onDelete: async (annotation) => {
        await this.environment.annotationStore.removeAnnotation(annotation);
        await this.reload();
      },
      onError: (message) => this.environment.showNotice(message)
    }).open();
  }

  private async loadCleanupRules(
    sourcePath: string,
    allowScripts: boolean
  ): Promise<CleanupRule[]> {
    if (!allowScripts) {
      return [];
    }
    try {
      return await this.environment.cleanupStore.loadEffective(sourcePath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not load cleanup rules: ${detail}`);
      return [];
    }
  }

  private toggleCleanupMode(): void {
    if (!this.environment.getSettings().allowScripts) {
      this.environment.showNotice(
        "Enable page JavaScript in HTML Preview settings to use cleanup."
      );
      return;
    }
    this.setCleanupMode(!this.cleanupMode, true);
  }

  private setCleanupMode(enabled: boolean, notifyFrame: boolean): void {
    this.cleanupMode = enabled;
    this.updateCleanupAction();
    if (notifyFrame) {
      this.postCleanupMode();
    }
  }

  private updateCleanupAction(): void {
    this.cleanupAction?.classList.toggle("is-active", this.cleanupMode);
    this.cleanupAction?.setAttribute("aria-pressed", String(this.cleanupMode));
  }

  private postCleanupMode(): void {
    if (!this.frame?.contentWindow || !this.activeRenderId) {
      return;
    }
    this.frame.contentWindow.postMessage(
      {
        enabled: this.cleanupMode,
        renderId: this.activeRenderId,
        type: CLEANUP_MODE_MESSAGE_TYPE
      },
      "*"
    );
  }

  private async saveCleanupRule(
    candidate: CleanupCandidate,
    sourcePath: string,
    renderId: string
  ): Promise<void> {
    if (!this.environment.getSettings().allowScripts) {
      return;
    }
    const rule: CleanupRule = {
      ...candidate,
      createdAt: new Date().toISOString(),
      id: this.environment.createRuleId?.() ?? createRenderId(),
      scope: "file",
      sourcePath
    };
    try {
      await this.environment.cleanupStore.addFileRule(sourcePath, rule);
      if (this.file?.path !== sourcePath || this.activeRenderId !== renderId) {
        return;
      }
      this.undoStack.push(rule);
      await this.render();
    } catch (error) {
      if (this.file?.path !== sourcePath || this.activeRenderId !== renderId) {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not save the cleanup rule: ${detail}`);
      await this.render();
    }
  }

  private async undoCleanup(): Promise<void> {
    const rule = this.undoStack.pop();
    if (!rule) {
      this.environment.showNotice("There is no cleanup action to undo in this view.");
      return;
    }
    try {
      await this.environment.cleanupStore.removeRule(rule);
      await this.render();
    } catch (error) {
      this.undoStack.push(rule);
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not undo the cleanup rule: ${detail}`);
    }
  }

  private openCleanupManager(): void {
    const sourcePath = this.file?.path;
    if (!sourcePath) {
      return;
    }
    new CleanupRulesModal(this.app, {
      onError: (message) => {
        this.environment.showNotice(`Could not update cleanup rules: ${message}`);
      },
      onPromote: async (rule) => {
        const promoted = await this.environment.cleanupStore.promoteToFolder(
          sourcePath,
          rule.id
        );
        this.undoStack = this.undoStack.map((item) =>
          item.id === promoted.id ? promoted : item
        );
        await this.render();
      },
      onReset: async () => {
        await this.environment.cleanupStore.resetFileRules(sourcePath);
        this.undoStack = this.undoStack.filter(
          (rule) => rule.scope !== "file" || rule.sourcePath !== sourcePath
        );
        await this.render();
      },
      onRestore: async (rule) => {
        await this.environment.cleanupStore.removeRule(rule);
        this.undoStack = this.undoStack.filter((item) => item.id !== rule.id);
        await this.render();
      },
      rules: this.activeRules,
      sourcePath,
      unmatchedRuleIds: this.unmatchedRuleIds
    }).open();
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

function parseAnnotationSelection(
  value: unknown
): { quote: string; target: HtmlAnnotation["target"] } | null {
  if (!isRecord(value) || value.type !== ANNOTATION_SELECTED_MESSAGE_TYPE || !isRecord(value.annotation)) {
    return null;
  }
  const annotation = value.annotation as Record<string, unknown>;
  const target = annotation.target;
  if (
    typeof annotation.quote !== "string" ||
    !isRecord(target) ||
    typeof target.start !== "number" ||
    typeof target.end !== "number" ||
    typeof target.exact !== "string" ||
    typeof target.prefix !== "string" ||
    typeof target.suffix !== "string"
  ) {
    return null;
  }
  return {
    quote: annotation.quote,
    target: {
      end: target.end,
      exact: target.exact,
      prefix: target.prefix,
      start: target.start,
      suffix: target.suffix
    }
  };
}
