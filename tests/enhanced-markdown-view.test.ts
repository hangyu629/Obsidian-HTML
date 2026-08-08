import { TFile, WorkspaceLeaf } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import {
  EnhancedMarkdownView,
  ENHANCED_MARKDOWN_VIEW_TYPE
} from "../src/markdown/enhanced-markdown-view";
import { PreviewCoordinator } from "../src/preview/preview-coordinator";
import { BUILT_IN_TEMPLATE } from "../src/markdown/templates/built-in";
import type { MarkdownTemplatePackage } from "../src/markdown/templates/types";

function file(path: string): TFile {
  return Object.assign(Object.create(TFile.prototype), {
    basename: path.split("/").pop()?.replace(/\.md$/i, "") ?? path,
    extension: "md",
    name: path.split("/").pop() ?? path,
    path
  }) as TFile;
}

function template(): MarkdownTemplatePackage {
  return {
    ...BUILT_IN_TEMPLATE,
    layout: `<header data-slot="title"></header><main data-slot="content"></main>`,
    styles: ".page {}",
    themes: { light: ":root {}" }
  };
}

function harness(
  read: (current: TFile) => Promise<string> = async () => "# Note",
  resolveTemplate = vi.fn(() => ({
    source: "default" as const,
    templateId: "book-editorial",
    themeId: "light"
  }))
) {
  const app = {
    vault: {
      cachedRead: read,
      getAbstractFileByPath: vi.fn((path: string) => file(path)),
      getResourcePath: vi.fn((current: TFile) => `app://vault/${current.path}`)
    }
  };
  const leaf = Object.assign(Object.create(WorkspaceLeaf.prototype), { app });
  const coordinator = new PreviewCoordinator(0);
  const view = new EnhancedMarkdownView(leaf, {
    coordinator,
    getFrontmatter: () => ({}),
    loadTemplate: vi.fn(async () => template()),
    resolveAsset: (path) => `app://vault/${path}`,
    resolveTemplate,
    onSwitchTemplate: vi.fn()
  });
  document.body.append(view.containerEl);
  view.onload();
  return { app, coordinator, leaf, resolveTemplate, view };
}

interface MockViewAction {
  callback(event: MouseEvent): unknown;
  title: string;
}

function actions(view: EnhancedMarkdownView): MockViewAction[] {
  return (view as unknown as { actions: MockViewAction[] }).actions;
}

describe("EnhancedMarkdownView", () => {
  it("renders a selected template and exposes view actions", async () => {
    const { view } = harness();
    await view.onLoadFile(file("notes/example.md"));

    expect(view.getViewType()).toBe(ENHANCED_MARKDOWN_VIEW_TYPE);
    expect(view.contentEl.querySelector("[data-slot=content]")?.textContent).toContain(
      "# Note"
    );
    expect(actions(view).map((action) => action.title)).toEqual(
      expect.arrayContaining(["Source", "Preview", "Template & theme"])
    );
  });

  it("ignores a stale source read after the file changes", async () => {
    let release!: (value: string) => void;
    const first = new Promise<string>((resolve) => {
      release = resolve;
    });
    const read = vi
      .fn<(current: TFile) => Promise<string>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce("# Second");
    const { view } = harness(read);
    const firstLoad = view.onLoadFile(file("notes/first.md"));
    await view.onLoadFile(file("notes/second.md"));
    release("# First");
    await firstLoad;

    expect(view.contentEl.textContent).toContain("# Second");
    expect(view.contentEl.textContent).not.toContain("# First");
  });

  it("refreshes through the coordinator and switches back to native Markdown", async () => {
    const { coordinator, leaf, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const read = vi.spyOn(view.app.vault, "cachedRead");
    coordinator.notify("notes/example.md");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(read).toHaveBeenCalled();

    const nativeAction = actions(view).find((action) => action.title === "Source");
    await nativeAction?.callback(new MouseEvent("click"));
    expect(vi.spyOn(leaf, "setViewState")).not.toHaveBeenCalled();
  });

  it("switches the current leaf to the native Markdown view with history", async () => {
    const { leaf, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const setViewState = vi.spyOn(leaf, "setViewState");
    await view.openNativeMarkdown();

    expect(setViewState).toHaveBeenCalledWith(
      { state: { file: "notes/example.md", mode: "source" }, type: "markdown" },
      { history: true }
    );
  });

  it("switches the current leaf to native Markdown preview mode", async () => {
    const { leaf, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const setViewState = vi.spyOn(leaf, "setViewState");

    await view.openMarkdownPreview();

    expect(setViewState).toHaveBeenCalledWith(
      { state: { file: "notes/example.md", mode: "preview" }, type: "markdown" },
      { history: true }
    );
  });

  it("cleans the rendered DOM and coordinator subscription on unload", async () => {
    const { coordinator, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    await view.onUnloadFile(file("notes/example.md"));
    expect(view.contentEl.childElementCount).toBe(0);
    coordinator.notify("notes/example.md");
    expect(view.contentEl.childElementCount).toBe(0);
  });
});
