import { TFile, WorkspaceLeaf } from "obsidian";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EnhancedMarkdownView,
  ENHANCED_MARKDOWN_VIEW_TYPE
} from "../src/markdown/enhanced-markdown-view";
import type { HtmlAnnotation } from "../src/annotations/types";
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
  })),
  initialAnnotations: readonly HtmlAnnotation[] = []
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
  const annotationService = {
    focus: vi.fn(async () => false),
    load: vi.fn(async () => [...initialAnnotations]),
    registerView: vi.fn(() => () => undefined),
    remove: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined)
  };
  const showNotice = vi.fn();
  const onReturnToMarkdown = vi.fn();
  const view = new EnhancedMarkdownView(leaf, {
    annotationService,
    coordinator,
    createAnnotationId: () => "11111111111111111111111111111111",
    getFrontmatter: () => ({}),
    loadTemplate: vi.fn(async () => template()),
    resolveAsset: (path) => `app://vault/${path}`,
    resolveTemplate,
    onReturnToMarkdown,
    onSwitchTemplate: vi.fn(),
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();
  return {
    annotationService,
    app,
    coordinator,
    leaf,
    onReturnToMarkdown,
    resolveTemplate,
    showNotice,
    view
  };
}

interface MockViewAction {
  callback(event: MouseEvent): unknown;
  title: string;
}

function actions(view: EnhancedMarkdownView): MockViewAction[] {
  return (view as unknown as { actions: MockViewAction[] }).actions;
}

function clickByText(host: HTMLElement, text: string): void {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text
  );
  expect(button).toBeDefined();
  button?.click();
}

describe("EnhancedMarkdownView", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    window.getSelection()?.removeAllRanges();
  });

  it("keeps enhanced Markdown content selectable before annotation mode", () => {
    const css = readFileSync("styles.css", "utf8");

    expect(css).toContain(
      '.view-content.enhanced-markdown-view [data-slot="content"]'
    );
    expect(css).toContain(
      '.view-content.enhanced-markdown-view [data-slot="content"] *'
    );
  });

  it("styles contextual controls, five highlight colors, and the mobile editor", () => {
    const css = readFileSync("styles.css", "utf8");

    expect(css).toContain(".annotation-selection-toolbar");
    expect(css).toContain(".annotation-editor");
    expect(css).toContain('[data-annotation-color="yellow"]');
    expect(css).toContain('[data-annotation-color="green"]');
    expect(css).toContain('[data-annotation-color="blue"]');
    expect(css).toContain('[data-annotation-color="pink"]');
    expect(css).toContain('[data-annotation-color="violet"]');
    expect(css).toContain("@media (max-width: 640px)");
  });

  it("renders a selected template and exposes view actions", async () => {
    const { view } = harness();
    await view.onLoadFile(file("notes/example.md"));

    expect(view.getViewType()).toBe(ENHANCED_MARKDOWN_VIEW_TYPE);
    expect(view.contentEl.querySelector("[data-slot=content]")?.textContent).toContain(
      "# Note"
    );
    expect(actions(view).map((action) => action.title)).toEqual(
      expect.arrayContaining(["Markdown", "Template & theme"])
    );
    expect(actions(view).map((action) => action.title)).not.toEqual(
      expect.arrayContaining([
        "Source",
        "Preview",
        "Add annotation",
        "Manage annotations"
      ])
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

    const nativeAction = actions(view).find((action) => action.title === "Markdown");
    await nativeAction?.callback(new MouseEvent("click"));
    expect(vi.spyOn(leaf, "setViewState")).not.toHaveBeenCalled();
  });

  it("switches the current leaf to the native Markdown view with history", async () => {
    const { leaf, onReturnToMarkdown, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const setViewState = vi.spyOn(leaf, "setViewState");
    await view.openMarkdownMarkdown();

    expect(setViewState).toHaveBeenCalledWith(
      { state: { file: "notes/example.md", mode: "preview" }, type: "markdown" },
      { history: true }
    );
    expect(onReturnToMarkdown).toHaveBeenCalledOnce();
  });

  it("restores the source mode captured before enhanced reading", async () => {
    const { leaf, onReturnToMarkdown, view } = harness();
    await view.setState({
      file: "notes/example.md",
      mode: "manual",
      returnMode: "source",
      templateId: "book-editorial",
      themeId: "light"
    });
    await view.onLoadFile(file("notes/example.md"));
    const setViewState = vi.spyOn(leaf, "setViewState");

    await view.openMarkdownMarkdown();

    expect(setViewState).toHaveBeenCalledWith(
      { state: { file: "notes/example.md", mode: "source" }, type: "markdown" },
      { history: true }
    );
    expect(onReturnToMarkdown).toHaveBeenCalledOnce();
  });

  it("cleans the rendered DOM and coordinator subscription on unload", async () => {
    const { coordinator, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    await view.onUnloadFile(file("notes/example.md"));
    expect(view.contentEl.childElementCount).toBe(0);
    coordinator.notify("notes/example.md");
    expect(view.contentEl.childElementCount).toBe(0);
  });

  it("saves an annotation from the current enhanced Markdown selection", async () => {
    const { annotationService, showNotice, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const text = view.contentEl.querySelector("[data-slot=content]")?.firstChild;
    expect(text).toBeInstanceOf(Text);

    const range = document.createRange();
    range.setStart(text as Text, 0);
    range.setEnd(text as Text, 6);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    view.contentEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    clickByText(view.contentEl, "注释");
    const textarea = view.contentEl.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea).not.toBeNull();
    textarea!.value = "important note";
    clickByText(view.contentEl, "保存批注");

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "notes/example.md",
        expect.objectContaining({
          color: "yellow",
          comment: "important note",
          id: "11111111111111111111111111111111",
          quote: "# Note"
        })
      );
    });
    expect(showNotice).toHaveBeenCalledWith("Annotation added.");
  });

  it("creates a color-only highlight directly from the selection toolbar", async () => {
    const { annotationService, view } = harness();
    await view.onLoadFile(file("notes/example.md"));
    const text = view.contentEl.querySelector("[data-slot=content]")?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 6);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);

    view.contentEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    clickByText(view.contentEl, "颜色");
    view.contentEl.querySelector<HTMLButtonElement>('[aria-label="蓝色"]')?.click();

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "notes/example.md",
        expect.objectContaining({ color: "blue", comment: "", quote: "# Note" })
      );
    });
  });

  it("renders saved annotations only inside enhanced Markdown content", async () => {
    const annotation: HtmlAnnotation = {
      comment: "important note",
      id: "11111111111111111111111111111111",
      quote: "# Note",
      sourcePath: "notes/example.md",
      target: {
        end: 6,
        exact: "# Note",
        prefix: "",
        start: 0,
        suffix: ""
      }
    };
    const { view } = harness(undefined, undefined, [annotation]);

    await view.onLoadFile(file("notes/example.md"));

    const mark = view.contentEl.querySelector(
      "mark[data-obsidian-html-preview-annotation]"
    );
    expect(mark?.textContent).toBe("# Note");
    expect(mark?.getAttribute("title")).toBe("important note");
    expect(mark?.getAttribute("data-annotation-color")).toBe("yellow");
  });

  it("opens an existing highlight for editing and registers focus routing", async () => {
    const existing: HtmlAnnotation = {
      color: "green",
      comment: "important note",
      id: "11111111111111111111111111111111",
      quote: "# Note",
      sourcePath: "notes/example.md",
      target: { end: 6, exact: "# Note", prefix: "", start: 0, suffix: "" }
    };
    const { annotationService, view } = harness(undefined, undefined, [existing]);
    await view.onLoadFile(file("notes/example.md"));
    const mark = view.contentEl.querySelector<HTMLElement>("mark")!;
    mark.scrollIntoView = vi.fn();

    mark.click();
    const textarea = view.contentEl.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(textarea.value).toBe("important note");
    textarea.value = "updated";
    clickByText(view.contentEl, "保存修改");

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "notes/example.md",
        expect.objectContaining({ id: existing.id, comment: "updated", color: "green" })
      );
    });
    expect(annotationService.registerView).toHaveBeenCalled();
    const adapter = annotationService.registerView.mock.calls.at(-1)?.[0];
    await expect(adapter?.focusAnnotation(existing.id)).resolves.toBe(true);
  });
});
