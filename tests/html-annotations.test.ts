import { TFile, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HtmlPreviewView } from "../src/html-preview-view";
import { PreviewCoordinator } from "../src/preview/preview-coordinator";
import { validRule } from "./fixtures/cleanup-rules";

function createFile(path: string): TFile {
  const file = Object.create(TFile.prototype) as TFile;
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  Object.assign(file, {
    basename: dot >= 0 ? name.slice(0, dot) : name,
    extension: dot >= 0 ? name.slice(dot + 1) : "",
    name,
    path
  });
  return file;
}

function createLeaf(app: unknown): WorkspaceLeaf {
  const leaf = Object.create(WorkspaceLeaf.prototype) as WorkspaceLeaf;
  Object.assign(leaf, { app });
  return leaf;
}

function createHarness() {
  const annotationStore = {
    addFileAnnotation: vi.fn(async () => undefined),
    load: vi.fn(async () => []),
    removeAnnotation: vi.fn(async () => undefined)
  };
  const app = {
    vault: {
      cachedRead: vi.fn(async () => "<p>Alpha beta gamma</p>"),
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}?cache=1`)
    },
    workspace: { openLinkText: vi.fn(async () => undefined) }
  };
  const promptAnnotation = vi.fn(async () => "important sentence");
  const showNotice = vi.fn();
  const view = new HtmlPreviewView(createLeaf(app), {
    annotationStore,
    cleanupStore: {
      addFileRule: vi.fn(async () => undefined),
      loadEffective: vi.fn(async () => []),
      promoteToFolder: vi.fn(async () => ({ ...validRule, scope: "folder" as const, sourcePath: "." })),
      removeRule: vi.fn(async () => undefined),
      resetFileRules: vi.fn(async () => undefined)
    },
    coordinator: new PreviewCoordinator(0),
    createAnnotationId: () => "11111111111111111111111111111111",
    createRenderId: () => "render-test",
    createRuleId: () => "fedcba9876543210fedcba9876543210",
    getKnownVaultPaths: () => new Set(),
    getSettings: () => ({ allowScripts: true }),
    openExternal: vi.fn(),
    promptAnnotation,
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();
  return { annotationStore, promptAnnotation, showNotice, view };
}

describe("HtmlPreviewView annotations", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("persists an annotation selection from the preview iframe", async () => {
    const { annotationStore, promptAnnotation, showNotice, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            quote: "Alpha beta",
            target: {
              end: 10,
              exact: "Alpha beta",
              prefix: "",
              start: 0,
              suffix: " gamma"
            }
          },
          renderId: "render-test",
          type: "obsidian-html-preview:annotation-selected"
        },
        source: iframe.contentWindow
      })
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(promptAnnotation).toHaveBeenCalledWith("Alpha beta");
    expect(annotationStore.addFileAnnotation).toHaveBeenCalledWith(
      "pages/index.html",
      expect.objectContaining({
        comment: "important sentence",
        id: "11111111111111111111111111111111",
        quote: "Alpha beta"
      })
    );
    expect(showNotice).toHaveBeenCalledWith("Annotation added.");
  });
});
