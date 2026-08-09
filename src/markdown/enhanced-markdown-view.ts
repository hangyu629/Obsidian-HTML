import { Component, FileView, TFile, type WorkspaceLeaf } from "obsidian";

import type { AnnotationService } from "../annotations/annotation-service";
import {
  AnnotationContextualUi,
  type AnnotationDraft
} from "../annotations/contextual-ui";
import {
  annotationFromMark,
  applyAnnotationHighlights,
  captureAnnotationSelection,
  clearAnnotationHighlights,
  focusAnnotationMark,
  type AnnotationSelection
} from "../annotations/dom";
import type { HtmlAnnotation } from "../annotations/types";
import { createRenderId } from "../preview/bridge-script";
import type { PreviewCoordinator } from "../preview/preview-coordinator";
import type { MarkdownTemplatePackage } from "./templates/types";
import type { TemplateResolutionMode, TemplateSelection } from "./rules";
import { renderEnhancedMarkdown } from "./render-document";

export const ENHANCED_MARKDOWN_VIEW_TYPE = "enhanced-markdown";

export interface EnhancedMarkdownViewEnvironment {
  annotationService: Pick<
    AnnotationService,
    "load" | "registerView" | "remove" | "save" | "subscribe"
  >;
  coordinator: PreviewCoordinator;
  createAnnotationId?: () => string;
  getFrontmatter(file: TFile): unknown;
  loadTemplate(templateId: string): Promise<MarkdownTemplatePackage>;
  onReturnToMarkdown?(sourcePath: string): void;
  onSwitchTemplate?(
    sourcePath: string,
    selected: TemplateSelection | null
  ): void | Promise<void>;
  resolveAsset?(vaultPath: string): string | null;
  resolveTemplate(
    sourcePath: string,
    frontmatter: unknown,
    mode: TemplateResolutionMode
  ): TemplateSelection | null;
  showNotice(message: string): void;
}

interface EnhancedMarkdownViewState {
  file?: string;
  mode?: TemplateResolutionMode;
  returnMode?: "source" | "preview";
  templateId?: string;
  themeId?: string;
}

let nextViewId = 0;

export class EnhancedMarkdownView extends FileView {
  private activeAnnotations: HtmlAnnotation[] = [];
  private annotationSubscription: (() => void) | null = null;
  private annotationUi: AnnotationContextualUi | null = null;
  private annotationViewRegistration: (() => void) | null = null;
  private suppressAnnotationRenders = 0;
  private readonly viewId = `enhanced-markdown-${++nextViewId}`;
  private environmentSubscription: (() => void) | null = null;
  private renderComponent: Component | null = null;
  private renderToken = 0;
  private sessionMode: TemplateResolutionMode = "manual";
  private sessionSelection: TemplateSelection | null = null;
  private returnMode: "source" | "preview" = "preview";
  private pendingRepairId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly environment: EnhancedMarkdownViewEnvironment
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ENHANCED_MARKDOWN_VIEW_TYPE;
  }

  getIcon(): string {
    return "book-open-check";
  }

  getState(): Record<string, unknown> {
    return {
      file: this.file?.path,
      mode: this.sessionMode,
      templateId: this.sessionSelection?.templateId,
      themeId: this.sessionSelection?.themeId
    };
  }

  async setState(state: EnhancedMarkdownViewState): Promise<void> {
    if (state.mode === "automatic" || state.mode === "manual") {
      this.sessionMode = state.mode;
    }
    if (state.returnMode === "source" || state.returnMode === "preview") {
      this.returnMode = state.returnMode;
    }
    if (state.templateId && state.themeId) {
      this.sessionSelection = {
        source: "default",
        templateId: state.templateId,
        themeId: state.themeId
      };
    }
    const path = typeof state.file === "string" ? state.file : undefined;
    const nextFile = path
      ? (this.app.vault.getAbstractFileByPath(path) as TFile | null)
      : null;
    if (nextFile instanceof TFile || nextFile) {
      await this.onLoadFile(nextFile);
    }
  }

  onload(): void {
    super.onload();
    this.contentEl.classList.add("enhanced-markdown-view");
    this.addAction("file-text", "Markdown", () => {
      void this.openMarkdownMarkdown();
    });
    this.addAction("palette", "Template & theme", () => {
      if (this.file) void this.environment.onSwitchTemplate?.(
        this.file.path,
        this.sessionSelection
      );
    });
    this.annotationUi = new AnnotationContextualUi(this.contentEl, {
      onDelete: (annotation) => this.deleteAnnotation(annotation),
      onSave: (draft) => this.saveAnnotation(draft)
    });
    this.registerDomEvent(this.contentEl, "mouseup", (event) => {
      if (!(event.target instanceof Element) ||
        !event.target.closest(".annotation-contextual-surface")) {
        this.showSelectionUi();
      }
    });
    this.registerDomEvent(this.contentEl, "keyup", (event) => {
      if (event.key === "Shift" || event.key.startsWith("Arrow")) {
        this.showSelectionUi();
      }
    });
    this.registerDomEvent(this.contentEl, "click", (event) => {
      this.openExistingAnnotation(event);
    });
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.file = file;
    this.annotationUi?.close();
    this.subscribe(file.path);
    await this.render();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.renderToken += 1;
    this.environmentSubscription?.();
    this.environmentSubscription = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.activeAnnotations = [];
    this.pendingRepairId = null;
    this.annotationUi?.close();
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    if (this.file?.path === file.path) this.file = null;
    await super.onUnloadFile(file);
  }

  async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    this.file = file;
    this.annotationUi?.close();
    this.subscribe(file.path);
    await this.render();
  }

  async openMarkdownMarkdown(): Promise<void> {
    if (!this.file) return;
    this.environment.onReturnToMarkdown?.(this.file.path);
    await this.leaf.setViewState(
      { type: "markdown", state: { file: this.file.path, mode: this.returnMode } },
      { history: true }
    );
  }

  onunload(): void {
    this.renderToken += 1;
    this.environmentSubscription?.();
    this.environmentSubscription = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.activeAnnotations = [];
    this.pendingRepairId = null;
    this.annotationUi?.destroy();
    this.annotationUi = null;
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }

  private subscribe(sourcePath: string): void {
    this.environmentSubscription?.();
    this.annotationSubscription?.();
    this.annotationViewRegistration?.();
    this.environmentSubscription = this.environment.coordinator.subscribe(
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
      removeAnnotation: (id) => this.syncRemovedAnnotation(id),
      saveAnnotation: (annotation) => this.syncSavedAnnotation(annotation),
      beginAnnotationRepair: (id) => this.beginAnnotationRepair(id),
      sourcePath,
      focusAnnotation: (id) => Promise.resolve(this.focusAnnotation(id))
    });
  }

  private async render(): Promise<void> {
    const file = this.file;
    if (!file) return;
    const token = ++this.renderToken;
    this.annotationUi?.close();
    const frontmatter = this.environment.getFrontmatter(file);
    const selection =
      this.sessionSelection ??
      this.environment.resolveTemplate(file.path, frontmatter, this.sessionMode);
    if (!selection) {
      this.showState("No enhanced Markdown template matches this note.");
      return;
    }

    try {
      const [source, template, annotations] = await Promise.all([
        this.app.vault.cachedRead(file),
        this.environment.loadTemplate(selection.templateId),
        this.environment.annotationService.load(file.path)
      ]);
      if (token !== this.renderToken || this.file?.path !== file.path) return;

      const root = document.createElement("article");
      root.className = "enhanced-markdown-document";
      const component = new Component();
      const result = await renderEnhancedMarkdown({
        app: this.app,
        component,
        frontmatter:
          typeof frontmatter === "object" && frontmatter !== null
            ? (frontmatter as Record<string, unknown>)
            : undefined,
        resolveAsset: this.environment.resolveAsset,
        root,
        source,
        sourcePath: file.path,
        template,
        themeId: selection.themeId
      });
      if (token !== this.renderToken || this.file?.path !== file.path) {
        component.unload();
        return;
      }
      const content = root.querySelector('[data-slot="content"]');
      let resolvedAnnotations = annotations;
      if (content instanceof HTMLElement) {
        resolvedAnnotations = applyAnnotationHighlights(content, annotations);
      }
      this.renderComponent?.unload();
      this.renderComponent = component;
      this.activeAnnotations = [...annotations];
      this.contentEl.replaceChildren(root);
      this.environment.coordinator.update(this.viewId, file.path, result.dependencies);
      await this.persistRecoveredTargets(file.path, annotations, resolvedAnnotations);
    } catch (error) {
      if (token !== this.renderToken || this.file?.path !== file.path) return;
      this.showState(
        `Unable to render enhanced Markdown: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private showState(message: string): void {
    const state = document.createElement("p");
    state.className = "enhanced-markdown-state";
    state.textContent = message;
    this.contentEl.replaceChildren(state);
  }

  private contentRoot(): HTMLElement | null {
    const content = this.contentEl.querySelector('[data-slot="content"]');
    return content instanceof HTMLElement ? content : null;
  }

  private captureCurrentSelection(): AnnotationSelection | null {
    const content = this.contentRoot();
    return content
      ? captureAnnotationSelection(content, window.getSelection())
      : null;
  }

  private async persistRecoveredTargets(
    sourcePath: string,
    original: readonly HtmlAnnotation[],
    resolved: readonly HtmlAnnotation[]
  ): Promise<void> {
    for (const annotation of resolved) {
      const previous = original.find((candidate) => candidate.id === annotation.id);
      if (!previous || previous.target.start === annotation.target.start &&
        previous.target.end === annotation.target.end &&
        previous.target.prefix === annotation.target.prefix &&
        previous.target.suffix === annotation.target.suffix) {
        continue;
      }
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(sourcePath, annotation);
    }
  }

  focusAnnotation(id: string): boolean {
    const content = this.contentRoot();
    return content ? focusAnnotationMark(content, id) : false;
  }

  beginAnnotationRepair(id: string): boolean {
    if (!this.file || !this.contentRoot() ||
      !this.activeAnnotations.some((annotation) => annotation.id === id)) {
      return false;
    }
    this.pendingRepairId = id;
    this.annotationUi?.close();
    this.environment.showNotice("请选择新的文本来重新定位这条批注。");
    return true;
  }

  private syncSavedAnnotation(annotation: HtmlAnnotation): void {
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = [
      ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
      annotation
    ];
    this.renderActiveAnnotations();
  }

  private syncRemovedAnnotation(id: string): void {
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = this.activeAnnotations.filter((item) => item.id !== id);
    this.renderActiveAnnotations();
  }

  private renderActiveAnnotations(): void {
    const content = this.contentRoot();
    if (!content) return;
    clearAnnotationHighlights(content);
    const resolved = applyAnnotationHighlights(content, this.activeAnnotations);
    const targets = new Map(resolved.map((annotation) => [annotation.id, annotation.target]));
    this.activeAnnotations = this.activeAnnotations.map((annotation) => {
      const target = targets.get(annotation.id);
      return target ? { ...annotation, target } : annotation;
    });
  }

  private showSelectionUi(): void {
    const selection = this.captureCurrentSelection();
    const nativeSelection = window.getSelection();
    if (!selection || !nativeSelection || nativeSelection.rangeCount === 0) return;
    const range = nativeSelection.getRangeAt(0);
    const anchor = typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect()
      : new DOMRect();
    const repair = this.pendingRepairId
      ? this.activeAnnotations.find((annotation) => annotation.id === this.pendingRepairId)
      : undefined;
    this.annotationUi?.showSelection(selection, anchor, repair);
  }

  private openExistingAnnotation(event: MouseEvent): void {
    const content = this.contentRoot();
    if (!content || event.target instanceof Element &&
      event.target.closest(".annotation-contextual-surface")) return;
    const id = annotationFromMark(content, event.target);
    const annotation = this.activeAnnotations.find((item) => item.id === id);
    if (!annotation) return;
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("mark[data-obsidian-html-preview-annotation]")
      : null;
    this.annotationUi?.showAnnotation(
      annotation,
      target?.getBoundingClientRect() ?? new DOMRect()
    );
  }

  private async saveAnnotation(draft: AnnotationDraft): Promise<boolean> {
    const sourcePath = this.file?.path;
    if (!sourcePath) return false;
    try {
      await this.environment.annotationService.save(sourcePath, {
        ...draft,
        id: draft.id ?? this.environment.createAnnotationId?.() ?? createRenderId(),
        sourcePath
      });
      if (draft.id && draft.id === this.pendingRepairId) this.pendingRepairId = null;
      window.getSelection()?.removeAllRanges();
      this.environment.showNotice(draft.id ? "Annotation updated." : "Annotation added.");
      return true;
    } catch (error) {
      this.environment.showNotice(
        `Could not save annotation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  private async deleteAnnotation(annotation: HtmlAnnotation): Promise<boolean> {
    try {
      await this.environment.annotationService.remove(annotation);
      this.environment.showNotice("Annotation deleted.");
      return true;
    } catch (error) {
      this.environment.showNotice(
        `Could not delete annotation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }
}
