import { Component, FileView, TFile, type WorkspaceLeaf } from "obsidian";

import type { PreviewCoordinator } from "../preview/preview-coordinator";
import type { MarkdownTemplatePackage } from "./templates/types";
import type { TemplateResolutionMode, TemplateSelection } from "./rules";
import { renderEnhancedMarkdown } from "./render-document";

export const ENHANCED_MARKDOWN_VIEW_TYPE = "enhanced-markdown";

export interface EnhancedMarkdownViewEnvironment {
  coordinator: PreviewCoordinator;
  getFrontmatter(file: TFile): unknown;
  loadTemplate(templateId: string): Promise<MarkdownTemplatePackage>;
  onReturnToMarkdown?(sourcePath: string): void;
  onSwitchTemplate?(sourcePath: string): void | Promise<void>;
  resolveAsset?(vaultPath: string): string | null;
  resolveTemplate(
    sourcePath: string,
    frontmatter: unknown,
    mode: TemplateResolutionMode
  ): TemplateSelection | null;
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
  private readonly viewId = `enhanced-markdown-${++nextViewId}`;
  private environmentSubscription: (() => void) | null = null;
  private renderComponent: Component | null = null;
  private renderToken = 0;
  private sessionMode: TemplateResolutionMode = "manual";
  private sessionSelection: TemplateSelection | null = null;
  private returnMode: "source" | "preview" = "preview";

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
      if (this.file) void this.environment.onSwitchTemplate?.(this.file.path);
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
    this.environmentSubscription?.();
    this.environmentSubscription = null;
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    if (this.file?.path === file.path) this.file = null;
    await super.onUnloadFile(file);
  }

  async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    this.file = file;
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
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }

  private subscribe(sourcePath: string): void {
    this.environmentSubscription?.();
    this.environmentSubscription = this.environment.coordinator.subscribe(
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
    if (!file) return;
    const token = ++this.renderToken;
    const frontmatter = this.environment.getFrontmatter(file);
    const selection =
      this.sessionSelection ??
      this.environment.resolveTemplate(file.path, frontmatter, this.sessionMode);
    if (!selection) {
      this.showState("No enhanced Markdown template matches this note.");
      return;
    }

    try {
      const [source, template] = await Promise.all([
        this.app.vault.cachedRead(file),
        this.environment.loadTemplate(selection.templateId)
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
      this.renderComponent?.unload();
      this.renderComponent = component;
      this.contentEl.replaceChildren(root);
      this.environment.coordinator.update(this.viewId, file.path, result.dependencies);
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
}
