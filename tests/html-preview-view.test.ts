import { TFile, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HtmlPreviewView, HTML_PREVIEW_VIEW_TYPE } from "../src/html-preview-view";
import { PreviewCoordinator } from "../src/preview/preview-coordinator";

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

function createHarness(
  read = vi.fn(async () => "<h1>Hello</h1>"),
  allowScripts = true
) {
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
  const view = new HtmlPreviewView(createLeaf(app), {
    coordinator,
    createRenderId: () => "render-test",
    getKnownVaultPaths: () => new Set(["pages/guide.html"]),
    getSettings: () => ({ allowScripts }),
    openExternal
  });
  view.onload();

  return { app, coordinator, openExternal, openLinkText, view };
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
