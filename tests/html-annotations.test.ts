import { TFile, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOTATION_DELETE_MESSAGE_TYPE,
  ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE,
  ANNOTATION_REANCHOR_MESSAGE_TYPE,
  ANNOTATION_RESULT_MESSAGE_TYPE,
  ANNOTATION_SAVE_MESSAGE_TYPE
} from "../src/annotations/runtime";
import type { HtmlAnnotation } from "../src/annotations/types";
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
  return Object.assign(Object.create(WorkspaceLeaf.prototype), { app });
}

function existingAnnotation(): HtmlAnnotation {
  return {
    color: "yellow",
    comment: "existing",
    id: "22222222222222222222222222222222",
    quote: "gamma",
    sourcePath: "pages/index.html",
    target: { end: 16, exact: "gamma", prefix: "Alpha beta ", start: 11, suffix: "" }
  };
}

function createHarness(initial: readonly HtmlAnnotation[] = []) {
  let currentAnnotations = [...initial];
  const listeners = new Set<() => void>();
  const annotationService = {
    focus: vi.fn(async () => false),
    load: vi.fn(async () => [...currentAnnotations]),
    registerView: vi.fn(() => () => undefined),
    remove: vi.fn(async (annotation: HtmlAnnotation) => {
      currentAnnotations = currentAnnotations.filter((item) => item.id !== annotation.id);
      for (const listener of listeners) listener();
    }),
    save: vi.fn(async () => undefined),
    subscribe: vi.fn((_sourcePath: string, listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    })
  };
  const app = {
    vault: {
      cachedRead: vi.fn(async () => "<p>Alpha beta gamma</p>"),
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}?cache=1`)
    },
    workspace: { openLinkText: vi.fn(async () => undefined) }
  };
  const showNotice = vi.fn();
  const view = new HtmlPreviewView(createLeaf(app), {
    annotationService,
    cleanupStore: {
      addFileRule: vi.fn(async () => undefined),
      loadEffective: vi.fn(async () => []),
      promoteToFolder: vi.fn(async () => ({
        ...validRule,
        scope: "folder" as const,
        sourcePath: "."
      })),
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
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();
  return { annotationService, showNotice, view };
}

describe("HtmlPreviewView annotations", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("keeps text selectable and includes the contextual runtime", async () => {
    const { view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const srcdoc = view.contentEl.querySelector("iframe")?.srcdoc ?? "";

    expect(srcdoc).toContain("user-select: text !important");
    expect(srcdoc).toContain("annotation-selection-toolbar");
    expect(srcdoc).toContain("annotation-editor");
  });

  it("persists a validated save message and responds to the iframe", async () => {
    const { annotationService, showNotice, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            color: "blue",
            comment: "important sentence",
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
          requestId: "save-1",
          type: ANNOTATION_SAVE_MESSAGE_TYPE
        },
        source: iframe.contentWindow
      })
    );

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "pages/index.html",
        expect.objectContaining({
          color: "blue",
          comment: "important sentence",
          id: "11111111111111111111111111111111",
          quote: "Alpha beta"
        })
      );
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        annotation: expect.objectContaining({ id: "11111111111111111111111111111111" }),
        ok: true,
        renderId: "render-test",
        requestId: "save-1",
        type: ANNOTATION_RESULT_MESSAGE_TYPE
      }),
      "*"
    );
    expect(showNotice).toHaveBeenCalledWith("Annotation added.");
  });

  it("does not rebuild the iframe after saving a local HTML annotation", async () => {
    const listeners = new Set<() => void>();
    const app = {
      vault: {
        cachedRead: vi.fn(async () => "<p>Alpha beta gamma</p>"),
        getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}?cache=1`)
      },
      workspace: { openLinkText: vi.fn(async () => undefined) }
    };
    const annotationService = {
      focus: vi.fn(async () => false),
      load: vi.fn(async () => []),
      registerView: vi.fn(() => () => undefined),
      remove: vi.fn(async () => undefined),
      save: vi.fn(async () => {
        for (const listener of listeners) listener();
      }),
      subscribe: vi.fn((_sourcePath: string, listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      })
    };
    const view = new HtmlPreviewView(createLeaf(app), {
      annotationService,
      cleanupStore: {
        addFileRule: vi.fn(async () => undefined),
        loadEffective: vi.fn(async () => []),
        promoteToFolder: vi.fn(async () => ({
          ...validRule,
          scope: "folder" as const,
          sourcePath: "."
        })),
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
      showNotice: vi.fn()
    });
    document.body.append(view.containerEl);
    view.onload();
    await view.onLoadFile(createFile("pages/index.html"));
    const initialFrame = view.contentEl.querySelector("iframe");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            color: "blue",
            comment: "important sentence",
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
          requestId: "save-keep-frame",
          type: ANNOTATION_SAVE_MESSAGE_TYPE
        },
        source: initialFrame?.contentWindow ?? null
      })
    );

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalled();
    });
    expect(view.contentEl.querySelector("iframe")).toBe(initialFrame);
    expect(app.vault.cachedRead).toHaveBeenCalledTimes(1);
  });

  it("persists a recovered HTML anchor without rebuilding the iframe", async () => {
    const existing = existingAnnotation();
    const { annotationService, view } = createHarness([existing]);
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    const initialFrame = iframe;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            ...existing,
            target: {
              ...existing.target,
              end: 22,
              prefix: "Intro ",
              start: 12,
              suffix: ""
            }
          },
          renderId: "render-test",
          type: ANNOTATION_REANCHOR_MESSAGE_TYPE
        },
        source: iframe.contentWindow
      })
    );

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "pages/index.html",
        expect.objectContaining({
          id: existing.id,
          target: expect.objectContaining({ start: 12, end: 22, prefix: "Intro " })
        })
      );
    });
    expect(view.contentEl.querySelector("iframe")).toBe(initialFrame);
  });

  it("deletes an existing annotation and rejects unknown colors", async () => {
    const existing = existingAnnotation();
    const { annotationService, view } = createHarness([existing]);
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotationId: existing.id,
          renderId: "render-test",
          requestId: "delete-1",
          type: ANNOTATION_DELETE_MESSAGE_TYPE
        },
        source: iframe.contentWindow
      })
    );
    await vi.waitFor(() => expect(annotationService.remove).toHaveBeenCalledWith(existing));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            color: "orange",
            comment: "invalid",
            quote: "Alpha",
            target: { end: 5, exact: "Alpha", prefix: "", start: 0, suffix: " beta" }
          },
          renderId: "render-test",
          requestId: "save-invalid",
          type: ANNOTATION_SAVE_MESSAGE_TYPE
        },
        source: iframe.contentWindow
      })
    );
    await Promise.resolve();

    expect(annotationService.save).not.toHaveBeenCalled();
  });

  it("refreshes the HTML iframe after an external annotation deletion", async () => {
    const existing = existingAnnotation();
    const { annotationService, view } = createHarness([existing]);
    await view.onLoadFile(createFile("pages/index.html"));

    expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain(existing.id);

    await annotationService.remove(existing);

    await vi.waitFor(() => {
      expect(view.contentEl.querySelector("iframe")?.srcdoc).not.toContain(existing.id);
    });
  });
});
