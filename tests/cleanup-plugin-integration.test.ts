import { TFile, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HtmlPreviewPlugin from "../src/main";
import { HTML_PREVIEW_VIEW_TYPE, HtmlPreviewView } from "../src/html-preview-view";
import type { CleanupStorageAdapter } from "../src/cleanup/rule-store";
import { validRule } from "./fixtures/cleanup-rules";

class MemoryVaultAdapter implements CleanupStorageAdapter {
  directories = new Set<string>();
  files = new Map<string, string>();

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async read(path: string): Promise<string> {
    const data = this.files.get(path);
    if (data === undefined) throw new Error(`Missing file: ${path}`);
    return data;
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(from: string, to: string): Promise<void> {
    const data = await this.read(from);
    this.files.set(to, data);
    this.files.delete(from);
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }
}

interface MockPluginState {
  registeredExtensions: Array<{ extensions: string[]; viewType: string }>;
  registeredViews: Map<string, (leaf: WorkspaceLeaf) => HtmlPreviewView>;
}

function createFile(path: string): TFile {
  const file = Object.create(TFile.prototype) as TFile;
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  Object.assign(file, {
    basename: dot < 0 ? name : name.slice(0, dot),
    extension: dot < 0 ? "" : name.slice(dot + 1),
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
  const adapter = new MemoryVaultAdapter();
  const handlers = new Map<string, (...args: any[]) => unknown>();
  const file = createFile("pages/index.html");
  const app = {
    vault: {
      adapter,
      cachedRead: vi.fn(async () => "<aside class=\"sidebar\">Related</aside>"),
      getFiles: vi.fn(() => [file]),
      getResourcePath: vi.fn((target: TFile) => `app://vault/${target.path}`),
      on: vi.fn((event: string, callback: (...args: any[]) => unknown) => {
        handlers.set(event, callback);
        return {};
      })
    },
    workspace: { openLinkText: vi.fn(async () => undefined) }
  };
  const plugin = new HtmlPreviewPlugin(app as never, {
    id: "html-preview",
    version: "0.2.0"
  } as never);
  return { adapter, app, handlers, plugin };
}

describe("cleanup plugin integration", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("wires the Vault cleanup store into registered HTML views", async () => {
    const { app, plugin } = createHarness();
    await plugin.onload();
    await plugin.cleanupStore.addFileRule("pages/index.html", {
      ...validRule,
      sourcePath: "pages/index.html"
    });
    const state = plugin as unknown as MockPluginState;
    const factory = state.registeredViews.get(HTML_PREVIEW_VIEW_TYPE);
    const view = factory?.(createLeaf(app));
    expect(view).toBeInstanceOf(HtmlPreviewView);
    document.body.append(view!.containerEl);
    view!.onload();

    await view!.onLoadFile(createFile("pages/index.html"));

    expect(state.registeredExtensions).toContainEqual({
      extensions: ["html", "htm"],
      viewType: HTML_PREVIEW_VIEW_TYPE
    });
    expect(view!.contentEl.querySelector("iframe")?.srcdoc).toContain(validRule.id);
  });

  it("migrates file-scoped cleanup rules after a Vault rename", async () => {
    const { handlers, plugin } = createHarness();
    await plugin.onload();
    await plugin.cleanupStore.addFileRule("Old/page.html", {
      ...validRule,
      sourcePath: "Old/page.html"
    });

    handlers.get("rename")?.(createFile("New/page.html"), "Old/page.html");
    await vi.waitFor(async () => {
      expect(await plugin.cleanupStore.loadEffective("New/page.html")).toHaveLength(1);
    });

    expect(await plugin.cleanupStore.loadEffective("Old/page.html")).toEqual([]);
    expect(await plugin.cleanupStore.loadEffective("New/page.html")).toEqual([
      expect.objectContaining({ sourcePath: "New/page.html" })
    ]);
  });
});
