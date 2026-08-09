import { FileView, TFile, WorkspaceLeaf } from "obsidian";

import type { AnnotationService } from "./annotations/annotation-service";
import {
  ANNOTATION_DELETE_MESSAGE_TYPE,
  ANNOTATION_FOCUS_MESSAGE_TYPE,
  ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE,
  ANNOTATION_REANCHOR_MESSAGE_TYPE,
  ANNOTATION_REPAIR_MESSAGE_TYPE,
  ANNOTATION_RESULT_MESSAGE_TYPE,
  ANNOTATION_SAVE_MESSAGE_TYPE,
  ANNOTATION_SYNC_DELETE_MESSAGE_TYPE,
  ANNOTATION_SYNC_SAVE_MESSAGE_TYPE
} from "./annotations/runtime";
import {
  annotationColor,
  type AnnotationColor,
  type HtmlAnnotation
} from "./annotations/types";
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
import { buildReaderPreview, isSavedReaderPage } from "./reader/document-builder";
import { extractReadableArticle } from "./reader/extractor";
import { ReaderPageConfirmationModal } from "./reader/page-confirmation-modal";
import type { ReaderPageStore } from "./reader/page-store";
import type { HtmlPreviewSettings } from "./settings";

export const HTML_PREVIEW_VIEW_TYPE = "html-preview";
const SANDBOX_FLAGS =
  "allow-scripts allow-forms allow-modals allow-popups allow-downloads";
const SCRIPT_FREE_SANDBOX_FLAGS =
  "allow-forms allow-modals allow-popups allow-downloads";

export interface HtmlPreviewEnvironment {
  annotationService: Pick<
    AnnotationService,
    "load" | "registerView" | "remove" | "save" | "subscribe"
  >;
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
  readerPageStore: Pick<ReaderPageStore, "hasBackup" | "restore" | "save">;
  showNotice(message: string): void;
}

type PresentationMode = "page" | "reader";

interface AnnotationSaveMessage {
  annotation: {
    color: AnnotationColor;
    comment: string;
    id?: string;
    quote: string;
    target: HtmlAnnotation["target"];
  };
  requestId: string;
}

interface AnnotationDeleteMessage {
  annotationId: string;
  requestId: string;
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
  private annotationSubscription: (() => void) | null = null;
  private annotationViewRegistration: (() => void) | null = null;
  private activeRules: CleanupRule[] = [];
  private suppressAnnotationRenders = 0;
  private cleanupAction: HTMLElement | null = null;
  private cleanupManagerAction: HTMLElement | null = null;
  private originalAction: HTMLElement | null = null;
  private reloadAction: HTMLElement | null = null;
  private restoreReaderAction: HTMLElement | null = null;
  private saveReaderAction: HTMLElement | null = null;
  private smartReadingAction: HTMLElement | null = null;
  private undoAction: HTMLElement | null = null;
  private showOriginal = false;
  private cleanupMode = false;
  private diagnostics: DisplayDiagnostic[] = [];
  private frame: HTMLIFrameElement | null = null;
  private backupAvailable = false;
  private lastSource = "";
  private presentationMode: PresentationMode = "page";
  private readonly scrollByMode = new Map<PresentationMode, { x: number; y: number }>();
  private standaloneReaderSource: string | null = null;
  private readonly viewId = `html-preview-${++nextViewId}`;
  private focusSequence = 0;
  private readonly pendingFocus = new Map<
    string,
    { resolve(found: boolean): void; timeout: number }
  >();
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
    this.reloadAction = this.addAction("rotate-cw", "Reload preview", () => {
      void this.reload();
    });
    this.cleanupAction = this.addAction("eraser", "Clean up page", () => {
      this.toggleCleanupMode();
    });
    this.originalAction = this.addAction("eye-off", "View original page", () => {
      this.showOriginal = !this.showOriginal;
      this.updateOriginalAction();
      void this.render();
    });
    this.updateOriginalAction();
    this.updateCleanupAction();
    this.undoAction = this.addAction("undo-2", "Undo cleanup", () => {
      void this.undoCleanup();
    });
    this.cleanupManagerAction = this.addAction("list-x", "Manage cleanup rules", () => {
      this.openCleanupManager();
    });
    this.smartReadingAction = this.addAction("book-open", "Smart reading", () => {
      void this.toggleSmartReading();
    });
    this.saveReaderAction = this.addAction("save", "Save reading page", () => {
      this.openSaveReaderPage();
    });
    this.restoreReaderAction = this.addAction("history", "Restore original page", () => {
      this.openRestoreOriginalPage();
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
    this.updateActionVisibility();
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    if (this.file?.path !== file.path) {
      this.undoStack = [];
      this.setCleanupMode(false, false);
      this.presentationMode = "page";
      this.scrollByMode.clear();
      this.showOriginal = false;
      this.standaloneReaderSource = null;
      this.updateOriginalAction();
      this.updateActionVisibility();
    }
    this.file = file;
    this.subscribe(file.path);
    await this.render();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.resolvePendingFocus(false);
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.backupAvailable = false;
    this.lastSource = "";
    this.showOriginal = false;
    this.presentationMode = "page";
    this.scrollByMode.clear();
    this.standaloneReaderSource = null;
    this.suppressAnnotationRenders = 0;
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
    this.presentationMode = "page";
    this.scrollByMode.clear();
    this.standaloneReaderSource = null;
    this.subscribe(file.path);
    await this.render();
  }

  onunload(): void {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.resolvePendingFocus(false);
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.backupAvailable = false;
    this.lastSource = "";
    this.presentationMode = "page";
    this.scrollByMode.clear();
    this.standaloneReaderSource = null;
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

  private canUseBridge(): boolean {
    return this.presentationMode === "reader" || this.environment.getSettings().allowScripts;
  }

  private currentTheme(): "dark" | "light" {
    return document.body.classList.contains("theme-dark") ? "dark" : "light";
  }

  private rememberScroll(mode: PresentationMode): void {
    if (!this.frame?.contentWindow) {
      return;
    }
    this.scrollByMode.set(mode, {
      x: this.frame.contentWindow.scrollX,
      y: this.frame.contentWindow.scrollY
    });
  }

  private async toggleSmartReading(): Promise<void> {
    this.rememberScroll(this.presentationMode);
    this.presentationMode = this.presentationMode === "reader" ? "page" : "reader";
    this.updateActionVisibility();
    await this.render();
  }

  private updateActionVisibility(): void {
    const readerMode = this.presentationMode === "reader";
    const pageOnly = !readerMode;
    this.cleanupAction?.toggleAttribute("hidden", !pageOnly);
    this.originalAction?.toggleAttribute("hidden", !pageOnly);
    this.undoAction?.toggleAttribute("hidden", !pageOnly);
    this.cleanupManagerAction?.toggleAttribute("hidden", !pageOnly);
    this.saveReaderAction?.toggleAttribute(
      "hidden",
      !readerMode || this.standaloneReaderSource === null
    );
    this.restoreReaderAction?.toggleAttribute("hidden", !this.backupAvailable);
    this.smartReadingAction?.classList.toggle("is-active", readerMode);
    this.smartReadingAction?.setAttribute("aria-pressed", String(readerMode));
  }

  private openSaveReaderPage(): void {
    const file = this.file;
    const readerSource = this.standaloneReaderSource;
    if (!file || readerSource === null || this.lastSource.length === 0) {
      return;
    }
    new ReaderPageConfirmationModal(this.app, {
      mode: "save",
      onConfirm: async () => {
        await this.environment.readerPageStore.save(
          file.path,
          this.lastSource,
          readerSource,
          (source) => this.app.vault.modify(file, source)
        );
        this.backupAvailable = true;
        this.presentationMode = "page";
        this.standaloneReaderSource = null;
        this.updateActionVisibility();
        await this.render();
      },
      onError: (error) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.environment.showNotice(`Could not save the reading page: ${detail}`);
      },
      sourcePath: file.path
    }).open();
  }

  private openRestoreOriginalPage(): void {
    const file = this.file;
    if (!file || !this.backupAvailable) {
      return;
    }
    new ReaderPageConfirmationModal(this.app, {
      mode: "restore",
      onConfirm: async () => {
        await this.environment.readerPageStore.restore(
          file.path,
          (source) => this.app.vault.modify(file, source)
        );
        this.backupAvailable = false;
        this.presentationMode = "page";
        this.standaloneReaderSource = null;
        this.updateActionVisibility();
        await this.render();
      },
      onError: (error) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.environment.showNotice(`Could not restore the original page: ${detail}`);
      },
      sourcePath: file.path
    }).open();
  }

  private subscribe(sourcePath: string): void {
    this.unsubscribe?.();
    this.annotationSubscription?.();
    this.annotationViewRegistration?.();
    this.unsubscribe = this.environment.coordinator.subscribe(
      this.viewId,
      sourcePath,
      new Set(),
      () => {
        void this.render();
      }
    );
    this.annotationSubscription = this.environment.annotationService.subscribe(
      sourcePath,
      () => {
        if (this.suppressAnnotationRenders > 0) {
          this.suppressAnnotationRenders -= 1;
          return;
        }
        void this.render();
      }
    );
    this.annotationViewRegistration = this.environment.annotationService.registerView({
      beginAnnotationRepair: (id) => this.beginAnnotationRepair(id),
      removeAnnotation: (id) => this.syncRemovedAnnotation(id),
      saveAnnotation: (annotation) => this.syncSavedAnnotation(annotation),
      sourcePath,
      focusAnnotation: (id) => this.focusAnnotation(id)
    });
  }

  private async render(): Promise<void> {
    const file = this.file;
    if (!file) {
      this.showState("No HTML file is open.");
      return;
    }

    this.rememberScroll(this.presentationMode);
    const previousScroll = this.scrollByMode.get(this.presentationMode) ?? null;
    const token = ++this.renderToken;
    const renderId = this.environment.createRenderId?.() ?? createRenderId();
    const allowScripts = this.environment.getSettings().allowScripts;
    const readerMode = this.presentationMode === "reader";

    try {
      const [source, cleanupRules, annotations, backupAvailable] = await Promise.all([
        this.app.vault.cachedRead(file),
        readerMode || allowScripts
          ? this.loadStoredCleanupRules(file.path)
          : Promise.resolve([]),
        this.environment.annotationService.load(file.path),
        this.environment.readerPageStore.hasBackup(file.path).catch(() => false)
      ]);
      if (token !== this.renderToken || this.file?.path !== file.path) {
        return;
      }

      this.backupAvailable = backupAvailable;
      this.lastSource = source;
      let result;
      let sandbox = allowScripts ? SANDBOX_FLAGS : SCRIPT_FREE_SANDBOX_FLAGS;
      if (readerMode) {
        const extracted = extractReadableArticle({
          cleanupRules,
          source,
          sourcePath: file.path
        });
        if (!extracted.ok) {
          this.presentationMode = "page";
          this.standaloneReaderSource = null;
          this.updateActionVisibility();
          this.environment.showNotice(
            "No reliable article content was found for smart reading."
          );
          result = buildPreviewDocument({
            allowScripts,
            cleanupRules: this.showOriginal || isSavedReaderPage(source) ? [] : cleanupRules,
            annotations,
            knownVaultPaths: this.environment.getKnownVaultPaths(),
            renderId,
            resourceUrl: this.app.vault.getResourcePath(file),
            source,
            sourcePath: file.path
          });
        } else {
          const readerPreview = buildReaderPreview({
            annotations,
            article: extracted.article,
            knownVaultPaths: this.environment.getKnownVaultPaths(),
            renderId,
            resourceUrl: this.app.vault.getResourcePath(file),
            sourcePath: file.path,
            theme: this.currentTheme()
          });
          this.standaloneReaderSource = readerPreview.standaloneHtml;
          result = readerPreview;
          sandbox = SANDBOX_FLAGS;
        }
      } else {
        this.standaloneReaderSource = null;
        result = buildPreviewDocument({
          allowScripts,
          cleanupRules: this.showOriginal || isSavedReaderPage(source) ? [] : cleanupRules,
          annotations,
          knownVaultPaths: this.environment.getKnownVaultPaths(),
          renderId,
          resourceUrl: this.app.vault.getResourcePath(file),
          source,
          sourcePath: file.path
        });
      }
      if (token !== this.renderToken) {
        return;
      }

      const frame = document.createElement("iframe");
      frame.className = "html-preview-frame";
      frame.setAttribute("sandbox", sandbox);
      frame.setAttribute("title", `Preview of ${file.name}`);
      frame.srcdoc = result.html;
      this.frame = frame;
      this.activeRenderId = renderId;
      this.activeAnnotations = annotations;
      this.activeRules = cleanupRules;
      this.unmatchedRuleIds.clear();
      this.diagnostics = result.diagnostics;
      this.updateActionVisibility();
      frame.addEventListener("load", () => {
        if (this.frame === frame && previousScroll &&
          (previousScroll.x !== 0 || previousScroll.y !== 0)) {
          frame.contentWindow?.scrollTo(previousScroll.x, previousScroll.y);
        }
        if (this.frame === frame && this.cleanupMode && this.presentationMode === "page") {
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
      this.standaloneReaderSource = null;
      this.updateActionVisibility();
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

    const annotationSave = parseAnnotationSave(event.data);
    if (annotationSave) {
      await this.saveAnnotation(annotationSave, this.file.path);
      return;
    }

    const annotationDelete = parseAnnotationDelete(event.data);
    if (annotationDelete) {
      await this.deleteAnnotation(annotationDelete);
      return;
    }

    const focusResult = parseAnnotationFocusResult(event.data);
    if (focusResult) {
      const pending = this.pendingFocus.get(focusResult.requestId);
      if (pending) {
        window.clearTimeout(pending.timeout);
        this.pendingFocus.delete(focusResult.requestId);
        pending.resolve(focusResult.found);
      }
      return;
    }

    const reanchoredAnnotation = parseReanchoredAnnotation(event.data);
    if (reanchoredAnnotation) {
      await this.persistRecoveredAnnotation(reanchoredAnnotation);
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

  private async saveAnnotation(
    message: AnnotationSaveMessage,
    sourcePath: string
  ): Promise<void> {
    const annotation: HtmlAnnotation = {
      ...message.annotation,
      id:
        message.annotation.id ??
        this.environment.createAnnotationId?.() ??
        createRenderId(),
      sourcePath
    };
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(sourcePath, annotation);
      this.activeAnnotations = [
        ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
        annotation
      ];
      this.postAnnotationResult(message.requestId, true, annotation);
      this.environment.showNotice(
        message.annotation.id ? "Annotation updated." : "Annotation added."
      );
    } catch (error) {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
      this.postAnnotationResult(message.requestId, false);
      this.environment.showNotice(
        `Could not save annotation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async deleteAnnotation(message: AnnotationDeleteMessage): Promise<void> {
    const annotation = this.activeAnnotations.find(
      (item) => item.id === message.annotationId
    );
    if (!annotation) {
      this.postAnnotationResult(message.requestId, false);
      return;
    }
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.remove(annotation);
      this.activeAnnotations = this.activeAnnotations.filter(
        (item) => item.id !== annotation.id
      );
      this.postAnnotationResult(message.requestId, true);
      this.environment.showNotice("Annotation deleted.");
    } catch (error) {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
      this.postAnnotationResult(message.requestId, false);
      this.environment.showNotice(
        `Could not delete annotation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private postAnnotationResult(
    requestId: string,
    ok: boolean,
    annotation?: HtmlAnnotation
  ): void {
    this.frame?.contentWindow?.postMessage(
      {
        ...(annotation ? { annotation } : {}),
        ok,
        renderId: this.activeRenderId,
        requestId,
        type: ANNOTATION_RESULT_MESSAGE_TYPE
      },
      "*"
    );
  }

  private async persistRecoveredAnnotation(annotation: HtmlAnnotation): Promise<void> {
    const current = this.activeAnnotations.find((item) => item.id === annotation.id);
    if (!current || current.target.start === annotation.target.start &&
      current.target.end === annotation.target.end &&
      current.target.prefix === annotation.target.prefix &&
      current.target.suffix === annotation.target.suffix) {
      return;
    }
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(annotation.sourcePath, annotation);
      this.activeAnnotations = [
        ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
        annotation
      ];
    } catch {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
    }
  }

  private syncSavedAnnotation(annotation: HtmlAnnotation): void {
    if (!this.frame?.contentWindow || !this.activeRenderId) return;
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = [
      ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
      annotation
    ];
    this.frame.contentWindow.postMessage(
      {
        annotation,
        renderId: this.activeRenderId,
        type: ANNOTATION_SYNC_SAVE_MESSAGE_TYPE
      },
      "*"
    );
  }

  private syncRemovedAnnotation(id: string): void {
    if (!this.frame?.contentWindow || !this.activeRenderId) return;
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = this.activeAnnotations.filter((item) => item.id !== id);
    this.frame.contentWindow.postMessage(
      {
        annotationId: id,
        renderId: this.activeRenderId,
        type: ANNOTATION_SYNC_DELETE_MESSAGE_TYPE
      },
      "*"
    );
  }

  async focusAnnotation(id: string): Promise<boolean> {
    if (!this.canUseBridge() ||
      !this.frame?.contentWindow || !this.activeRenderId) return false;
    const requestId = `focus-${++this.focusSequence}`;
    return new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => {
        this.pendingFocus.delete(requestId);
        resolve(false);
      }, 1_500);
      this.pendingFocus.set(requestId, { resolve, timeout });
      this.frame?.contentWindow?.postMessage(
        {
          annotationId: id,
          renderId: this.activeRenderId,
          requestId,
          type: ANNOTATION_FOCUS_MESSAGE_TYPE
        },
        "*"
      );
    });
  }

  beginAnnotationRepair(id: string): boolean {
    if (!this.canUseBridge() ||
      !this.frame?.contentWindow || !this.activeRenderId ||
      !this.activeAnnotations.some((annotation) => annotation.id === id)) {
      return false;
    }
    this.frame.contentWindow.postMessage(
      {
        annotationId: id,
        renderId: this.activeRenderId,
        type: ANNOTATION_REPAIR_MESSAGE_TYPE
      },
      "*"
    );
    this.environment.showNotice("Select new text to repair this annotation.");
    return true;
  }

  private resolvePendingFocus(found: boolean): void {
    for (const pending of this.pendingFocus.values()) {
      window.clearTimeout(pending.timeout);
      pending.resolve(found);
    }
    this.pendingFocus.clear();
  }

  private async loadStoredCleanupRules(sourcePath: string): Promise<CleanupRule[]> {
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

  private updateOriginalAction(): void {
    if (!this.originalAction) return;
    this.originalAction.classList.toggle("is-active", this.showOriginal);
    this.originalAction.setAttribute("aria-pressed", String(this.showOriginal));
    this.originalAction.setAttribute(
      "aria-label",
      this.showOriginal ? "Apply cleanup rules" : "View original page"
    );
    this.originalAction.title = this.showOriginal ? "Apply cleanup rules" : "View original page";
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

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function validAnnotationId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

function parseAnnotationSave(value: unknown): AnnotationSaveMessage | null {
  if (!isRecord(value) || value.type !== ANNOTATION_SAVE_MESSAGE_TYPE ||
    !validRequestId(value.requestId) || !isRecord(value.annotation)) return null;
  const annotation = value.annotation;
  const target = annotation.target;
  const color = annotationColor(annotation.color);
  if (
    color === null ||
    typeof annotation.comment !== "string" || annotation.comment.length > 10_000 ||
    typeof annotation.quote !== "string" || annotation.quote.length === 0 ||
    annotation.quote.length > 20_000 ||
    (annotation.id !== undefined && !validAnnotationId(annotation.id)) ||
    !isRecord(target) ||
    !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) ||
    typeof target.start !== "number" || typeof target.end !== "number" ||
    target.start < 0 || target.end <= target.start || target.end > 10_000_000 ||
    typeof target.exact !== "string" || target.exact !== annotation.quote ||
    typeof target.prefix !== "string" || target.prefix.length > 256 ||
    typeof target.suffix !== "string" || target.suffix.length > 256
  ) return null;
  return {
    annotation: {
      color,
      comment: annotation.comment,
      ...(annotation.id ? { id: annotation.id } : {}),
      quote: annotation.quote,
      target: {
        end: target.end,
        exact: target.exact,
        prefix: target.prefix,
        start: target.start,
        suffix: target.suffix
      }
    },
    requestId: value.requestId
  };
}

function parseAnnotationDelete(value: unknown): AnnotationDeleteMessage | null {
  return isRecord(value) &&
    value.type === ANNOTATION_DELETE_MESSAGE_TYPE &&
    validRequestId(value.requestId) &&
    validAnnotationId(value.annotationId)
    ? { annotationId: value.annotationId, requestId: value.requestId }
    : null;
}

function parseReanchoredAnnotation(value: unknown): HtmlAnnotation | null {
  if (!isRecord(value) || value.type !== ANNOTATION_REANCHOR_MESSAGE_TYPE || !isRecord(value.annotation)) {
    return null;
  }
  const annotation = value.annotation;
  const target = annotation.target;
  const color = annotationColor(annotation.color);
  if (
    color === null ||
    !validAnnotationId(annotation.id) ||
    typeof annotation.sourcePath !== "string" || annotation.sourcePath.length === 0 ||
    typeof annotation.comment !== "string" || annotation.comment.length > 10_000 ||
    typeof annotation.quote !== "string" || annotation.quote.length === 0 ||
    annotation.quote.length > 20_000 ||
    !isRecord(target) ||
    !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) ||
    typeof target.start !== "number" || typeof target.end !== "number" ||
    target.start < 0 || target.end <= target.start || target.end > 10_000_000 ||
    typeof target.exact !== "string" || target.exact !== annotation.quote ||
    typeof target.prefix !== "string" || target.prefix.length > 256 ||
    typeof target.suffix !== "string" || target.suffix.length > 256
  ) return null;
  return {
    color,
    comment: annotation.comment,
    id: annotation.id,
    quote: annotation.quote,
    sourcePath: annotation.sourcePath,
    target: {
      end: target.end,
      exact: target.exact,
      prefix: target.prefix,
      start: target.start,
      suffix: target.suffix
    }
  };
}

function parseAnnotationFocusResult(
  value: unknown
): { found: boolean; requestId: string } | null {
  return isRecord(value) &&
    value.type === ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE &&
    validRequestId(value.requestId) &&
    typeof value.found === "boolean"
    ? { found: value.found, requestId: value.requestId }
    : null;
}
