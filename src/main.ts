import { Notice, Plugin, TFile } from "obsidian";

import { HtmlAnnotationStore } from "./annotations/annotation-store";
import { AnnotationService } from "./annotations/annotation-service";
import {
  annotationExportPath,
  exportAnnotationMarkdown
} from "./annotations/export";
import type { HtmlAnnotation } from "./annotations/types";
import { AnnotationSearchModal } from "./annotations/search-modal";
import {
  filterAnnotations,
  type AnnotationSearchQuery
} from "./annotations/search";
import {
  AnnotationSidebarView,
  ANNOTATION_SIDEBAR_VIEW_TYPE
} from "./annotations/sidebar-view";
import { CleanupRuleStore } from "./cleanup/rule-store";
import {
  HtmlPreviewView,
  HTML_PREVIEW_VIEW_TYPE
} from "./html-preview-view";
import { createRenderId } from "./preview/bridge-script";
import { PreviewCoordinator } from "./preview/preview-coordinator";
import {
  DEFAULT_SETTINGS,
  HtmlPreviewSettingTab,
  normalizeSettings,
  type HtmlPreviewSettings
} from "./settings";
import {
  EnhancedMarkdownView,
  ENHANCED_MARKDOWN_VIEW_TYPE
} from "./markdown/enhanced-markdown-view";
import {
  MarkdownTemplateCatalog,
  type MarkdownTemplateCatalogAdapter
} from "./markdown/templates/catalog";
import type { MarkdownTemplateSummary } from "./markdown/templates/types";
import { resolveMarkdownTemplate } from "./markdown/rules";
import { MarkdownTemplateModal } from "./markdown/template-modal";
import { ReaderPageStore } from "./reader/page-store";

export default class HtmlPreviewPlugin extends Plugin {
  readonly coordinator = new PreviewCoordinator();
  annotationStore!: HtmlAnnotationStore;
  annotationService!: AnnotationService;
  cleanupStore!: CleanupRuleStore;
  readerPageStore!: ReaderPageStore;
  settings: HtmlPreviewSettings = { ...DEFAULT_SETTINGS };
  markdownTemplateCatalog!: MarkdownTemplateCatalog;
  markdownTemplateSettings: HtmlPreviewSettings = { ...DEFAULT_SETTINGS };
  private markdownTemplates: MarkdownTemplateSummary[] = [];
  private readonly knownVaultPaths = new Set<string>();
  private markdownTemplateIds = new Set(["book-editorial"]);
  private readonly enhancedLeaves = new WeakSet<object>();
  private lastAnnotationSourcePath: string | null = null;
  private readonly nativeMarkdownPaths = new WeakMap<object, string>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.rebuildPathIndex();
    this.cleanupStore = new CleanupRuleStore(
      this.app.vault.adapter,
      ({ message, path }) => {
        new Notice(`HTML Preview cleanup data error in ${path}: ${message}`);
      }
    );
    this.readerPageStore = new ReaderPageStore(this.app.vault.adapter as never);
    this.annotationStore = new HtmlAnnotationStore(this.app.vault.adapter as never);
    this.annotationService = new AnnotationService(this.annotationStore);

    this.markdownTemplateCatalog = new MarkdownTemplateCatalog(
      this.app.vault.adapter as MarkdownTemplateCatalogAdapter
    );
    this.markdownTemplates = await this.markdownTemplateCatalog.list();
    this.markdownTemplateIds = new Set(this.markdownTemplates.map((template) => template.id));
    this.markdownTemplateSettings = this.settings;

    this.registerView(
      ANNOTATION_SIDEBAR_VIEW_TYPE,
      (leaf) =>
        new AnnotationSidebarView(leaf, {
          annotationService: this.annotationService,
          exportAnnotations: (sourcePath, annotations) =>
            this.exportAnnotations(sourcePath, annotations),
          searchAnnotations: () => this.openAnnotationSearch(),
          focusAnnotation: (sourcePath, id) =>
            this.focusAnnotation(sourcePath, id),
          removeAnnotation: (annotation) => this.annotationService.remove(annotation),
          saveAnnotation: (sourcePath, annotation) =>
            this.annotationService.save(sourcePath, annotation),
          copyText: async (text) => {
            await navigator.clipboard.writeText(text);
            new Notice("已复制摘录和批注");
          },
          showNotice: (message) => new Notice(message)
        })
    );

    this.registerView(
      ENHANCED_MARKDOWN_VIEW_TYPE,
      (leaf) =>
        new EnhancedMarkdownView(leaf, {
          annotationService: this.annotationService,
          coordinator: this.coordinator,
          createAnnotationId: () => createRenderId(),
          getFrontmatter: (file) =>
            this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {},
          loadTemplate: (templateId) => this.markdownTemplateCatalog.load(templateId),
          onReturnToMarkdown: (path) => {
            this.nativeMarkdownPaths.set(leaf, path);
          },
          onSwitchTemplate: (path, selected) => {
            this.openTemplateChooser(path, selected);
          },
          resolveAsset: (path) => {
            const file = this.app.vault.getAbstractFileByPath(path);
            return file instanceof TFile
              ? this.app.vault.getResourcePath(file)
              : null;
          },
          resolveTemplate: (path, frontmatter, mode) =>
            resolveMarkdownTemplate(
              path,
              frontmatter,
              this.markdownTemplateSettings,
              this.markdownTemplateIds,
              mode
            ),
          showNotice: (message) => {
            new Notice(message);
          }
        })
    );

    this.registerView(
      HTML_PREVIEW_VIEW_TYPE,
      (leaf) =>
        new HtmlPreviewView(leaf, {
          annotationService: this.annotationService,
          cleanupStore: this.cleanupStore,
          coordinator: this.coordinator,
          createAnnotationId: () => createRenderId(),
          getKnownVaultPaths: () => this.knownVaultPaths,
          getSettings: () => this.settings,
          openExternal: (url) => {
            window.open(url, "_blank", "noopener,noreferrer");
          },
          readerPageStore: this.readerPageStore,
          showNotice: (message) => {
            new Notice(message);
          }
        })
    );
    this.registerExtensions(["html", "htm"], HTML_PREVIEW_VIEW_TYPE);
    this.addSettingTab(new HtmlPreviewSettingTab(this.app, this));
    this.addCommand({
      id: "open-enhanced-markdown-reading",
      name: "Open enhanced Markdown reading",
      callback: () => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const file = (leaf?.view as any)?.file;
        if (file instanceof TFile) void this.openEnhancedMarkdown(file.path, "manual");
      }
    });
    this.addCommand({
      id: "search-vault-annotations",
      name: "Search annotations across the Vault",
      callback: () => this.openAnnotationSearch()
    });
    this.addCommand({
      id: "open-annotation-sidebar",
      name: "Open annotation sidebar",
      callback: () => {
        void this.openAnnotationSidebar();
      }
    });

    if (typeof this.app.workspace.on === "function") {
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", (leaf) => {
          this.installMarkdownAction(leaf);
          void this.maybeAutoOpen(leaf);
          void this.updateAnnotationSidebars(leaf);
        })
      );
      this.registerEvent(
        this.app.workspace.on("file-open", () => {
          void this.maybeAutoOpen(this.app.workspace.activeLeaf);
          void this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
        })
      );
    }
    this.app.workspace.onLayoutReady?.(() => {
      void this.restoreAnnotationSidebar();
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.knownVaultPaths.delete(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.knownVaultPaths.delete(oldPath);
        this.coordinator.notify(oldPath);
        if (file instanceof TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
          if (isHtmlPath(oldPath) || isHtmlPath(file.path)) {
            void this.cleanupStore.migrateFile(oldPath, file.path).catch((error) => {
              const detail = error instanceof Error ? error.message : String(error);
              new Notice(`Could not migrate HTML cleanup rules: ${detail}`);
            });
          }
        }
      })
    );
  }

  onunload(): void {
    this.coordinator.dispose();
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.markdownTemplateSettings = this.settings;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  listMarkdownTemplates(): readonly MarkdownTemplateSummary[] {
    return this.markdownTemplates;
  }

  listMarkdownFolders(): readonly string[] {
    return this.app.vault
      .getAllFolders()
      .map((folder: { path: string }) => folder.path)
      .filter((path: string) => path.length > 0)
      .sort((left: string, right: string) => left.localeCompare(right));
  }

  refreshOpenPreviews(): void {
    for (const file of this.app.vault.getFiles()) {
      if (file.extension === "html" || file.extension === "htm") {
        this.coordinator.notify(file.path);
      }
    }
  }

  private async restoreAnnotationSidebar(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(ANNOTATION_SIDEBAR_VIEW_TYPE).length > 0) {
      await this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
      return;
    }
    await this.openAnnotationSidebar(false);
  }

  private async openAnnotationSidebar(reveal = true): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(
      ANNOTATION_SIDEBAR_VIEW_TYPE
    )[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("无法打开注释侧栏。");
      return;
    }
    if (!existing) {
      await leaf.setViewState({ type: ANNOTATION_SIDEBAR_VIEW_TYPE, active: reveal });
    }
    if (reveal) await this.app.workspace.revealLeaf(leaf);
    await this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
  }

  private async updateAnnotationSidebars(activeLeaf: any): Promise<void> {
    const file = activeLeaf?.view?.file;
    const extension = file instanceof TFile ? file.extension.toLowerCase() : "";
    let sourcePath = file instanceof TFile &&
      (extension === "html" || extension === "htm" || extension === "md")
      ? file.path
      : null;
    if (sourcePath) {
      this.lastAnnotationSourcePath = sourcePath;
    } else if (activeLeaf?.view?.getViewType?.() === ANNOTATION_SIDEBAR_VIEW_TYPE) {
      sourcePath = this.lastAnnotationSourcePath;
    } else {
      sourcePath = this.lastAnnotationSourcePath;
    }
    for (const leaf of this.app.workspace.getLeavesOfType?.(
      ANNOTATION_SIDEBAR_VIEW_TYPE
    ) ?? []) {
      const view = leaf.view;
      if (view instanceof AnnotationSidebarView) await view.setSource(sourcePath);
    }
  }

  private async focusAnnotation(sourcePath: string, id: string): Promise<boolean> {
    if (await this.annotationService.focus(sourcePath, id)) return true;
    if (!sourcePath.toLowerCase().endsWith(".md")) return false;
    const leaf = this.app.workspace.getMostRecentLeaf();
    await this.openEnhancedMarkdown(sourcePath, "manual", leaf);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    return this.annotationService.focus(sourcePath, id);
  }

  private rebuildPathIndex(): void {
    this.knownVaultPaths.clear();
    for (const file of this.app.vault.getFiles()) {
      this.knownVaultPaths.add(file.path);
    }
  }

  private installMarkdownAction(leaf: any): void {
    const view = leaf?.view;
    if (!view || view.getViewType?.() !== "markdown" || this.enhancedLeaves.has(view)) {
      return;
    }
    this.enhancedLeaves.add(view);
    view.addAction?.("book-open-check", "Enhanced reading", () => {
      const file = view.file;
      if (file instanceof TFile) void this.openEnhancedMarkdown(file.path, "manual", leaf);
    });
  }

  private async maybeAutoOpen(leaf: any): Promise<void> {
    if (!this.settings.autoEnhanced || !leaf?.view || leaf.view.getViewType?.() !== "markdown") {
      return;
    }
    const file = leaf.view.file;
    if (!(file instanceof TFile)) return;
    if (this.nativeMarkdownPaths.get(leaf) === file.path) return;
    this.nativeMarkdownPaths.delete(leaf);
    const frontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {};
    const selection = resolveMarkdownTemplate(
      file.path,
      frontmatter,
      this.markdownTemplateSettings,
      this.markdownTemplateIds,
      "automatic"
    ) ?? (this.settings.autoEnhanced
      ? resolveMarkdownTemplate(
          file.path,
          frontmatter,
          this.markdownTemplateSettings,
          this.markdownTemplateIds,
          "manual"
        )
      : null);
    if (selection) {
      const returnMode = leaf.view.getMode?.() === "source" ? "source" : "preview";
      await leaf.setViewState(
        {
          type: ENHANCED_MARKDOWN_VIEW_TYPE,
          state: {
            file: file.path,
            mode: "automatic",
            returnMode,
            templateId: selection.templateId,
            themeId: selection.themeId
          }
        },
        { history: true }
      );
    }
  }

  private async openEnhancedMarkdown(
    sourcePath: string,
    mode: "automatic" | "manual",
    leaf = this.app.workspace.getMostRecentLeaf(),
    selected?: { templateId: string; themeId: string }
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md" || !leaf) return;
    this.nativeMarkdownPaths.delete(leaf);
    const frontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {};
    const selection = selected
      ? { source: "default" as const, ...selected }
      : resolveMarkdownTemplate(
          sourcePath,
          frontmatter,
          this.markdownTemplateSettings,
          this.markdownTemplateIds,
          mode
        );
    if (!selection) {
      new Notice("No valid Markdown template is available for this note.");
      return;
    }
    const returnMode = (leaf.view as { getMode?: () => string } | undefined)?.getMode?.() === "source"
      ? "source"
      : "preview";
    await leaf.setViewState(
      {
        type: ENHANCED_MARKDOWN_VIEW_TYPE,
        state: {
          file: sourcePath,
          mode,
          returnMode,
          templateId: selection.templateId,
          themeId: selection.themeId
        }
      },
      { history: true }
    );
  }

  private openTemplateChooser(
    sourcePath: string,
    selected: import("./markdown/rules").TemplateSelection | null = null
  ): void {
    new MarkdownTemplateModal(this.app, {
      list: () => this.markdownTemplateCatalog.list(),
      onSelect: (selection) => {
        void this.openEnhancedMarkdown(sourcePath, "manual", undefined, selection);
      },
      selected: selected ?? undefined
    }).open();
  }

  private async exportAnnotations(
    sourcePath: string,
    annotations: readonly HtmlAnnotation[]
  ): Promise<void> {
    const path = annotationExportPath(sourcePath);
    const content = exportAnnotationMarkdown(sourcePath, annotations);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else if (existing) {
      throw new Error(`无法导出注释：目标路径不是文件：${path}`);
    } else {
      await this.app.vault.create(path, content);
    }
    new Notice(`注释已导出到 ${path}`);
  }

  private openAnnotationSearch(): void {
    new AnnotationSearchModal(this.app, {
      open: async (sourcePath, id) => {
        const file = this.app.vault.getAbstractFileByPath(sourcePath);
        if (!(file instanceof TFile)) return false;
        await this.app.workspace.openLinkText(sourcePath, "", false);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        return this.focusAnnotation(sourcePath, id);
      },
      search: (query) => this.searchAnnotations(query)
    }).open();
  }

  private async searchAnnotations(query: AnnotationSearchQuery): Promise<HtmlAnnotation[]> {
    const paths = this.app.vault.getFiles()
      .filter((file) => ["html", "htm", "md"].includes(file.extension.toLowerCase()))
      .map((file) => file.path);
    const annotations = (await Promise.all(paths.map((path) => this.annotationService.load(path))))
      .flat();
    return filterAnnotations(annotations, query).sort(
      (left, right) => left.sourcePath.localeCompare(right.sourcePath) ||
        left.target.start - right.target.start
    );
  }
}

function isHtmlPath(path: string): boolean {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return extension === "html" || extension === "htm";
}
