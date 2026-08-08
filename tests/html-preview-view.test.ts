import { TFile, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HtmlPreviewView, HTML_PREVIEW_VIEW_TYPE } from "../src/html-preview-view";
import type { CleanupRule } from "../src/cleanup/types";
import { PreviewCoordinator } from "../src/preview/preview-coordinator";
import { validCandidate, validRule } from "./fixtures/cleanup-rules";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

function createCleanupStore(initialRules: readonly CleanupRule[] = []) {
  let rules = [...initialRules];
  return {
    addFileRule: vi.fn(async (sourcePath: string, rule: CleanupRule) => {
      rules = [...rules.filter((item) => item.id !== rule.id), { ...rule, sourcePath }];
    }),
    loadEffective: vi.fn(async () => [...rules]),
    promoteToFolder: vi.fn(async (sourcePath: string, ruleId: string) => {
      const rule = rules.find((item) => item.id === ruleId);
      if (!rule) throw new Error("missing rule");
      const separator = sourcePath.lastIndexOf("/");
      const promoted = {
        ...rule,
        scope: "folder" as const,
        sourcePath: separator < 0 ? "." : sourcePath.slice(0, separator)
      };
      rules = [...rules.filter((item) => item.id !== ruleId), promoted];
      return promoted;
    }),
    removeRule: vi.fn(async (rule: CleanupRule) => {
      rules = rules.filter((item) => item.id !== rule.id);
    }),
    resetFileRules: vi.fn(async (sourcePath: string) => {
      rules = rules.filter(
        (item) => item.scope !== "file" || item.sourcePath !== sourcePath
      );
    })
  };
}

function createHarness(
  read: (file: TFile) => Promise<string> = vi.fn(async () => "<h1>Hello</h1>"),
  allowScripts = true,
  cleanupStore = createCleanupStore()
) {
  const annotationService = {
    focus: vi.fn(async () => false),
    load: vi.fn(async () => []),
    registerView: vi.fn(() => () => undefined),
    remove: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined)
  };
  const openLinkText = vi.fn(async () => undefined);
  const app = {
    vault: {
      cachedRead: read,
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}?cache=1`)
    },
    workspace: { openLinkText }
  };
  const coordinator = new PreviewCoordinator(0);
  const openExternal = vi.fn();
  const showNotice = vi.fn();
  const view = new HtmlPreviewView(createLeaf(app), {
    annotationService,
    cleanupStore,
    coordinator,
    createRenderId: () => "render-test",
    createRuleId: () => "fedcba9876543210fedcba9876543210",
    getKnownVaultPaths: () => new Set(["pages/guide.html"]),
    getSettings: () => ({ allowScripts }),
    openExternal,
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();

  return {
    app,
    annotationService,
    cleanupStore,
    coordinator,
    openExternal,
    openLinkText,
    showNotice,
    view
  };
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function click(element: Element | null): Promise<void> {
  expect(element).not.toBeNull();
  element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushAsyncWork();
}

interface MockViewAction {
  callback(event: MouseEvent): unknown;
  element?: HTMLElement;
  title: string;
}

function viewActions(view: HtmlPreviewView): MockViewAction[] {
  return (view as unknown as { actions: MockViewAction[] }).actions;
}

describe("HtmlPreviewView", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("loads a file into a sandboxed iframe", async () => {
    const { view } = createHarness();
    const file = createFile("pages/index.html");

    await view.onLoadFile(file as never);
    const iframe = view.contentEl.querySelector("iframe");

    expect(view.getViewType()).toBe(HTML_PREVIEW_VIEW_TYPE);
    expect(iframe?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-forms allow-modals allow-popups allow-downloads"
    );
    expect(iframe?.srcdoc).toContain("<h1>Hello</h1>");
    expect(view.contentEl.classList.contains("html-preview-view")).toBe(true);
  });

  it("loads effective cleanup rules into the preview runtime", async () => {
    const cleanupStore = createCleanupStore([validRule]);
    const { view } = createHarness(undefined, true, cleanupStore);

    await view.onLoadFile(createFile("pages/index.html"));

    expect(cleanupStore.loadEffective).toHaveBeenCalledWith("pages/index.html");
    expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain(validRule.id);
    expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain(
      validRule.selector
    );
  });

  it("exposes cleanup actions and sends token-bound mode commands", async () => {
    const { view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    const cleanupAction = viewActions(view).find(
      (action) => action.title === "Clean up page"
    );

    await cleanupAction?.callback(new MouseEvent("click"));

    expect(viewActions(view).map((action) => action.title)).toEqual(
      expect.arrayContaining(["Clean up page", "Undo cleanup", "Manage cleanup rules"])
    );
    expect(postMessage).toHaveBeenCalledWith(
      {
        enabled: true,
        renderId: "render-test",
        type: "obsidian-html-preview:cleanup-mode"
      },
      "*"
    );
  });

  it("uses contextual annotations without fixed annotation actions", async () => {
    const { annotationService, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));

    expect(viewActions(view).map((action) => action.title)).not.toEqual(
      expect.arrayContaining(["Add annotation", "Manage annotations"])
    );
    expect(annotationService.registerView).toHaveBeenCalled();
  });

  it("reports that cleanup requires JavaScript when scripts are disabled", async () => {
    const { cleanupStore, showNotice, view } = createHarness(undefined, false);
    await view.onLoadFile(createFile("pages/index.html"));

    await viewActions(view)
      .find((action) => action.title === "Clean up page")
      ?.callback(new MouseEvent("click"));

    expect(showNotice).toHaveBeenCalledWith(
      "Enable page JavaScript in HTML Preview settings to use cleanup."
    );
    expect(cleanupStore.loadEffective).not.toHaveBeenCalled();
  });

  it("synchronizes toolbar state when Escape exits cleanup mode in the iframe", async () => {
    const { view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    const cleanupAction = viewActions(view).find(
      (action) => action.title === "Clean up page"
    )!;
    await cleanupAction.callback(new MouseEvent("click"));
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          enabled: false,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-mode-state"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    await cleanupAction.callback(new MouseEvent("click"));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
      "*"
    );
  });

  it("ignores cleanup rules from a stale asynchronous render", async () => {
    const firstRules = deferred<CleanupRule[]>();
    const cleanupStore = createCleanupStore();
    cleanupStore.loadEffective
      .mockImplementationOnce(() => firstRules.promise)
      .mockResolvedValueOnce([]);
    const { view } = createHarness(
      vi.fn(async (file: TFile) => `<h1>${file.path}</h1>`),
      true,
      cleanupStore
    );

    const firstLoad = view.onLoadFile(createFile("pages/first.html"));
    await view.onLoadFile(createFile("pages/second.html"));
    firstRules.resolve([validRule]);
    await firstLoad;

    expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain(
      "pages/second.html"
    );
    expect(view.contentEl.querySelector("iframe")?.srcdoc).not.toContain(validRule.id);
  });

  it("persists a validated cleanup selection as a file rule", async () => {
    const { cleanupStore, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    await viewActions(view)
      .find((action) => action.title === "Clean up page")
      ?.callback(new MouseEvent("click"));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();

    expect(cleanupStore.addFileRule).toHaveBeenCalledWith(
      "pages/index.html",
      expect.objectContaining({
        ...validCandidate,
        id: "fedcba9876543210fedcba9876543210",
        scope: "file",
        sourcePath: "pages/index.html"
      })
    );
  });

  it("rejects cleanup selections with a stale token, wrong source, or invalid schema", async () => {
    const { cleanupStore, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    const messages = [
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "stale",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      }),
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: window
      }),
      new MessageEvent("message", {
        data: {
          candidate: { ...validCandidate, selector: "body" },
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      })
    ];

    for (const message of messages) window.dispatchEvent(message);
    await flushAsyncWork();

    expect(cleanupStore.addFileRule).not.toHaveBeenCalled();
  });

  it("rejects a valid cleanup selection while cleanup mode is off", async () => {
    const { cleanupStore, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();

    expect(cleanupStore.addFileRule).not.toHaveBeenCalled();
  });

  it("rerenders and reports a storage failure so temporary hiding is rolled back", async () => {
    const read = vi.fn(async () => "<aside>Related</aside>");
    const cleanupStore = createCleanupStore();
    cleanupStore.addFileRule.mockRejectedValueOnce(new Error("disk full"));
    const { showNotice, view } = createHarness(read, true, cleanupStore);
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    await viewActions(view)
      .find((action) => action.title === "Clean up page")
      ?.callback(new MouseEvent("click"));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();

    expect(showNotice).toHaveBeenCalledWith(
      expect.stringContaining("Could not save the cleanup rule")
    );
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("undoes the latest rule created in the current view session", async () => {
    const { cleanupStore, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    await viewActions(view)
      .find((action) => action.title === "Clean up page")
      ?.callback(new MouseEvent("click"));
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          candidate: validCandidate,
          renderId: "render-test",
          type: "obsidian-html-preview:cleanup-selected"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();

    await viewActions(view)
      .find((action) => action.title === "Undo cleanup")
      ?.callback(new MouseEvent("click"));
    await flushAsyncWork();

    expect(cleanupStore.removeRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fedcba9876543210fedcba9876543210" })
    );
  });

  it("opens the rule manager and restores an effective rule", async () => {
    const pageRule = { ...validRule, sourcePath: "pages/index.html" };
    const cleanupStore = createCleanupStore([pageRule]);
    const { view } = createHarness(undefined, true, cleanupStore);
    await view.onLoadFile(createFile("pages/index.html"));

    await viewActions(view)
      .find((action) => action.title === "Manage cleanup rules")
      ?.callback(new MouseEvent("click"));
    await click(
      document.body.querySelector(
        `[data-cleanup-action="restore"][data-rule-id="${pageRule.id}"]`
      )
    );

    expect(cleanupStore.removeRule).toHaveBeenCalledWith(pageRule);
  });

  it("promotes a current-file rule from the manager", async () => {
    const pageRule = { ...validRule, sourcePath: "pages/index.html" };
    const cleanupStore = createCleanupStore([pageRule]);
    const { view } = createHarness(undefined, true, cleanupStore);
    await view.onLoadFile(createFile("pages/index.html"));

    await viewActions(view)
      .find((action) => action.title === "Manage cleanup rules")
      ?.callback(new MouseEvent("click"));
    await click(
      document.body.querySelector(
        `[data-cleanup-action="promote"][data-rule-id="${pageRule.id}"]`
      )
    );

    expect(cleanupStore.promoteToFolder).toHaveBeenCalledWith(
      "pages/index.html",
      pageRule.id
    );
  });

  it("resets current-file rules from the manager", async () => {
    const pageRule = { ...validRule, sourcePath: "pages/index.html" };
    const cleanupStore = createCleanupStore([pageRule]);
    const { view } = createHarness(undefined, true, cleanupStore);
    await view.onLoadFile(createFile("pages/index.html"));

    await viewActions(view)
      .find((action) => action.title === "Manage cleanup rules")
      ?.callback(new MouseEvent("click"));
    await click(
      document.body.querySelector('[data-cleanup-action="reset-file"]')
    );

    expect(cleanupStore.resetFileRules).toHaveBeenCalledWith("pages/index.html");
  });

  it("shows runtime-reported unmatched rules in the manager", async () => {
    const pageRule = { ...validRule, sourcePath: "pages/index.html" };
    const cleanupStore = createCleanupStore([pageRule]);
    const { view } = createHarness(undefined, true, cleanupStore);
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe")!;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          renderId: "render-test",
          ruleIds: [pageRule.id],
          type: "obsidian-html-preview:cleanup-unmatched"
        },
        source: iframe.contentWindow
      })
    );
    await flushAsyncWork();

    await viewActions(view)
      .find((action) => action.title === "Manage cleanup rules")
      ?.callback(new MouseEvent("click"));

    expect(document.body.textContent).toContain("Not matched on this page");
  });

  it("removes script permission from the sandbox when JavaScript is disabled", async () => {
    const { view } = createHarness(
      vi.fn(async () => `<button onclick="window.ran = true">Run</button>`),
      false
    );

    await view.onLoadFile(createFile("pages/index.html"));

    expect(view.contentEl.querySelector("iframe")?.getAttribute("sandbox")).toBe(
      "allow-forms allow-modals allow-popups allow-downloads"
    );
  });

  it("ignores a stale file read after a newer render completes", async () => {
    const firstRead = deferred<string>();
    const read = vi
      .fn()
      .mockImplementationOnce(() => firstRead.promise)
      .mockResolvedValueOnce("<h1>Second</h1>");
    const { view } = createHarness(read);

    const firstLoad = view.onLoadFile(createFile("pages/first.html"));
    await view.onLoadFile(createFile("pages/second.html"));
    firstRead.resolve("<h1>First</h1>");
    await firstLoad;

    expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain("Second");
    expect(view.contentEl.querySelector("iframe")?.srcdoc).not.toContain("First");
  });

  it("routes validated bridge messages to Obsidian or the external adapter", async () => {
    const { openExternal, openLinkText, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));
    const iframe = view.contentEl.querySelector("iframe");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          href: "guide.html#intro",
          renderId: "render-test",
          type: "obsidian-html-preview:navigate"
        },
        source: iframe?.contentWindow
      })
    );
    await Promise.resolve();
    expect(openLinkText).toHaveBeenCalledWith(
      "pages/guide.html#intro",
      "pages/index.html",
      false
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          href: "https://example.com",
          renderId: "render-test",
          type: "obsidian-html-preview:navigate"
        },
        source: iframe?.contentWindow
      })
    );
    expect(openExternal).toHaveBeenCalledWith("https://example.com");
  });

  it("rejects messages from the wrong source or render", async () => {
    const { openExternal, openLinkText, view } = createHarness();
    await view.onLoadFile(createFile("pages/index.html"));

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          href: "guide.html",
          renderId: "wrong-render",
          type: "obsidian-html-preview:navigate"
        },
        source: window
      })
    );
    await Promise.resolve();

    expect(openLinkText).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("reloads when the coordinator reports a source change", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => "<p>content</p>");
    const { coordinator, view } = createHarness(read);
    await view.onLoadFile(createFile("pages/index.html"));

    coordinator.notify("pages/index.html");
    await vi.runAllTimersAsync();

    expect(read).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("shows a compact error state when reading fails", async () => {
    const { view } = createHarness(vi.fn(async () => Promise.reject(new Error("denied"))));

    await view.onLoadFile(createFile("pages/index.html"));

    expect(view.contentEl.querySelector(".html-preview-state")?.textContent).toContain(
      "Unable to preview this HTML file"
    );
    expect(view.contentEl.querySelector("iframe")).toBeNull();
  });

  it("cleans up its iframe and refresh subscription when unloaded", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => "<p>content</p>");
    const { coordinator, view } = createHarness(read);
    const file = createFile("pages/index.html");
    await view.onLoadFile(file as never);

    await view.onUnloadFile(file as never);
    coordinator.notify("pages/index.html");
    await vi.runAllTimersAsync();

    expect(view.contentEl.children).toHaveLength(0);
    expect(read).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
