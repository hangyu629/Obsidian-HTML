import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import HtmlPreviewPlugin from "../src/main";
import { ANNOTATION_SIDEBAR_VIEW_TYPE } from "../src/annotations/sidebar-view";
import { ENHANCED_MARKDOWN_VIEW_TYPE } from "../src/markdown/enhanced-markdown-view";
import { MARKDOWN_TEMPLATE_ROOT } from "../src/markdown/templates/catalog";

function appHarness() {
  const events = new Map<string, (...args: unknown[]) => void>();
  const workspaceLeaves: unknown[] = [];
  let layoutReadyCallback: (() => void) | null = null;
  const adapter = {
    exists: vi.fn(async () => false),
    list: vi.fn(async () => ({ files: [], folders: [] })),
    read: vi.fn(async () => "")
  };
  const vaultFiles = new Map<string, TFile>();
  const app = {
    metadataCache: { getFileCache: vi.fn(() => ({ frontmatter: {} })) },
    vault: {
      adapter,
      getFiles: vi.fn(() => []),
      on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
        events.set(name, callback);
        return { name };
      }),
      cachedRead: vi.fn(async () => "# Note"),
      create: vi.fn(async (path: string) => {
        const file = Object.assign(Object.create(TFile.prototype), { path }) as TFile;
        vaultFiles.set(path, file);
        return file;
      }),
      modify: vi.fn(async (_file: TFile, _content: string) => undefined),
      getAbstractFileByPath: vi.fn((path: string) => vaultFiles.get(path) ??
        Object.assign(Object.create(TFile.prototype), {
          basename: "Note", extension: "md", name: "Note.md", path
        })
      ),
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}`)
    },
    workspace: {
      activeLeaf: null as unknown,
      getLeavesOfType: vi.fn(() => workspaceLeaves),
      getMostRecentLeaf: vi.fn(() => app.workspace.activeLeaf),
      on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
        events.set(name, callback);
        return { name };
      }),
      onLayoutReady: vi.fn((callback: () => void) => {
        layoutReadyCallback = callback;
      }),
      getRightLeaf: vi.fn(() => {
        const leaf = {
          app,
          setViewState: vi.fn(async (state: unknown) => {
            const viewFactory = (pluginForTest as any)?.registeredViews?.get(
              (state as { type?: string }).type ?? ""
            );
            if (viewFactory) {
              (leaf as any).view = viewFactory(leaf);
            }
            workspaceLeaves.push(leaf);
          })
        };
        return leaf;
      })
    }
  };
  let pluginForTest: HtmlPreviewPlugin | null = null;
  return {
    app,
    events,
    get layoutReadyCallback() {
      return layoutReadyCallback;
    },
    set plugin(value: HtmlPreviewPlugin) {
      pluginForTest = value;
    },
    workspaceLeaves
  };
}

describe("Markdown plugin integration", () => {
  it("exports annotations to a sibling Markdown file and updates an existing export", async () => {
    const { app } = appHarness();
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    const exportAnnotations = (plugin as any).exportAnnotations.bind(plugin);
    const annotations = [{
      id: "a1",
      color: "blue",
      comment: "A note",
      quote: "Quoted text",
      sourcePath: "notes/Note.md",
      target: { start: 2, end: 13, exact: "Quoted text", prefix: "", suffix: "" }
    }];

    (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);
    await exportAnnotations("notes/Note.md", annotations);
    expect(app.vault.create).toHaveBeenCalledWith(
      "notes/Note.annotations.md",
      expect.stringContaining("A note")
    );

    (app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      Object.assign(Object.create(TFile.prototype), { path: "notes/Note.annotations.md" })
    );
    await exportAnnotations("notes/Note.md", annotations);
    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.objectContaining({ path: "notes/Note.annotations.md" }),
      expect.stringContaining("Quoted text")
    );
  });

  it("registers enhanced Markdown without claiming the md extension", async () => {
    const { app } = appHarness();
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();

    const mockPlugin = plugin as unknown as {
      registeredExtensions: Array<{ extensions: string[] }>;
      registeredViews: Map<string, unknown>;
    };
    expect(mockPlugin.registeredViews.has(ENHANCED_MARKDOWN_VIEW_TYPE)).toBe(true);
    expect(mockPlugin.registeredViews.has(ANNOTATION_SIDEBAR_VIEW_TYPE)).toBe(true);
    expect(
      (plugin as unknown as { commands: Array<{ id?: string }> }).commands
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "open-annotation-sidebar" })
      ])
    );
    expect(mockPlugin.registeredExtensions).not.toContainEqual(
      expect.objectContaining({ extensions: expect.arrayContaining(["md"]) })
    );
    expect(plugin.markdownTemplateCatalog).toBeDefined();
    expect(plugin.settings.defaultTemplateId).toBe("book-editorial");
    expect(plugin.listMarkdownTemplates().map((template) => template.id)).toEqual([
      "book-editorial",
      "magazine-research",
      "command-library"
    ]);
    expect(MARKDOWN_TEMPLATE_ROOT).toBe(".html-preview/markdown-templates");
  });

  it("restores the annotation sidebar after the plugin is re-enabled", async () => {
    const harness = appHarness();
    const plugin = new HtmlPreviewPlugin(harness.app as never, { id: "test" } as never);
    harness.plugin = plugin;
    await plugin.onload();

    expect(harness.layoutReadyCallback).toBeTypeOf("function");
    harness.layoutReadyCallback?.();
    await vi.waitFor(() => {
      expect(harness.app.workspace.getRightLeaf).toHaveBeenCalled();
      expect(harness.workspaceLeaves).toHaveLength(1);
    });
    expect((harness.workspaceLeaves[0] as any).view.getViewType()).toBe(
      ANNOTATION_SIDEBAR_VIEW_TYPE
    );
  });

  it("uses the global default template when default enhanced preview is enabled", async () => {
    const { app } = appHarness();
    const leaf = {
      app,
      setViewState: vi.fn(async () => undefined),
      view: Object.assign(Object.create(Object.prototype), {
        file: Object.assign(Object.create(TFile.prototype), {
          basename: "Note", extension: "md", name: "Note.md", path: "notes/Note.md"
        }),
        getViewType: () => "markdown",
        getMode: () => "source"
      })
    };
    app.workspace.activeLeaf = leaf;
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();
    await (plugin as unknown as { maybeAutoOpen(leaf: unknown): Promise<void> }).maybeAutoOpen(leaf);

    expect(leaf.setViewState).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ENHANCED_MARKDOWN_VIEW_TYPE,
        state: expect.objectContaining({
          file: "notes/Note.md",
          returnMode: "source",
          templateId: "book-editorial"
        })
      }),
      { history: true }
    );
  });

  it("does not reopen enhanced reading after the user returns to native Markdown", async () => {
    const { app } = appHarness();
    const leaf = {
      app,
      setViewState: vi.fn(async () => undefined),
      view: Object.assign(Object.create(Object.prototype), {
        file: Object.assign(Object.create(TFile.prototype), {
          basename: "Note", extension: "md", name: "Note.md", path: "notes/Note.md"
        }),
        getViewType: () => "markdown",
        getMode: () => "source"
      })
    };
    app.workspace.activeLeaf = leaf;
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();
    const environment = (plugin as unknown as { registeredViews: Map<string, (leaf: unknown) => unknown> })
      .registeredViews.get(ENHANCED_MARKDOWN_VIEW_TYPE);
    const enhanced = environment?.(leaf) as {
      onload(): void;
      onLoadFile(file: TFile): Promise<void>;
      openMarkdownMarkdown(): Promise<void>;
    };
    enhanced.onload();
    await (enhanced as unknown as { setState(state: Record<string, unknown>): Promise<void> }).setState({
      file: "notes/Note.md",
      mode: "automatic",
      returnMode: "source",
      templateId: "book-editorial",
      themeId: "light"
    });
    await enhanced.onLoadFile(leaf.view.file);

    await enhanced.openMarkdownMarkdown();
    await (plugin as unknown as { maybeAutoOpen(leaf: unknown): Promise<void> }).maybeAutoOpen(leaf);

    expect(leaf.setViewState).toHaveBeenCalledTimes(1);
    expect(leaf.setViewState).toHaveBeenCalledWith(
      { state: { file: "notes/Note.md", mode: "source" }, type: "markdown" },
      { history: true }
    );
  });

  it("keeps the last document source when the annotation sidebar becomes active", async () => {
    const { app, workspaceLeaves } = appHarness();
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();
    const factory = (plugin as unknown as {
      registeredViews: Map<string, (leaf: unknown) => any>;
    }).registeredViews.get(ANNOTATION_SIDEBAR_VIEW_TYPE)!;
    const sidebarLeaf = Object.assign(Object.create(Object.prototype), { app });
    const sidebar = factory(sidebarLeaf);
    sidebarLeaf.view = sidebar;
    sidebar.onload();
    workspaceLeaves.push(sidebarLeaf);
    const documentLeaf = {
      view: {
        file: Object.assign(Object.create(TFile.prototype), {
          basename: "Note",
          extension: "md",
          name: "Note.md",
          path: "notes/Note.md"
        })
      }
    };

    await (plugin as unknown as {
      updateAnnotationSidebars(leaf: unknown): Promise<void>;
    }).updateAnnotationSidebars(documentLeaf);
    expect(sidebar.contentEl.textContent).toContain("当前文件还没有注释");

    await (plugin as unknown as {
      updateAnnotationSidebars(leaf: unknown): Promise<void>;
    }).updateAnnotationSidebars(sidebarLeaf);

    expect(sidebar.contentEl.textContent).toContain("当前文件还没有注释");
    expect(sidebar.contentEl.textContent).not.toContain(
      "打开 HTML 或 Markdown 文件以查看注释"
    );
  });

  it("keeps annotation sidebar content when switching to another non-document tab", async () => {
    const { app, workspaceLeaves } = appHarness();
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();
    const factory = (plugin as unknown as {
      registeredViews: Map<string, (leaf: unknown) => any>;
    }).registeredViews.get(ANNOTATION_SIDEBAR_VIEW_TYPE)!;
    const sidebarLeaf = Object.assign(Object.create(Object.prototype), { app });
    const sidebar = factory(sidebarLeaf);
    sidebarLeaf.view = sidebar;
    sidebar.onload();
    workspaceLeaves.push(sidebarLeaf);
    const documentLeaf = {
      view: {
        file: Object.assign(Object.create(TFile.prototype), {
          basename: "Note",
          extension: "md",
          name: "Note.md",
          path: "notes/Note.md"
        })
      }
    };
    const outlineLeaf = {
      view: {
        getViewType: () => "outline"
      }
    };

    await (plugin as unknown as {
      updateAnnotationSidebars(leaf: unknown): Promise<void>;
    }).updateAnnotationSidebars(documentLeaf);
    expect(sidebar.contentEl.textContent).toContain("当前文件还没有注释");

    await (plugin as unknown as {
      updateAnnotationSidebars(leaf: unknown): Promise<void>;
    }).updateAnnotationSidebars(outlineLeaf);
    expect(sidebar.contentEl.textContent).toContain("当前文件还没有注释");

    await (plugin as unknown as {
      updateAnnotationSidebars(leaf: unknown): Promise<void>;
    }).updateAnnotationSidebars(sidebarLeaf);
    expect(sidebar.contentEl.textContent).toContain("当前文件还没有注释");
  });
});
