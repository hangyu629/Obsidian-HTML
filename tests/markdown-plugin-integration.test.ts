import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import HtmlPreviewPlugin from "../src/main";
import { ENHANCED_MARKDOWN_VIEW_TYPE } from "../src/markdown/enhanced-markdown-view";
import { MARKDOWN_TEMPLATE_ROOT } from "../src/markdown/templates/catalog";

function appHarness() {
  const events = new Map<string, (...args: unknown[]) => void>();
  const adapter = {
    exists: vi.fn(async () => false),
    list: vi.fn(async () => ({ files: [], folders: [] })),
    read: vi.fn(async () => "")
  };
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
      getAbstractFileByPath: vi.fn((path: string) =>
        Object.assign(Object.create(TFile.prototype), {
          basename: "Note", extension: "md", name: "Note.md", path
        })
      ),
      getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}`)
    },
    workspace: {
      on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
        events.set(name, callback);
        return { name };
      })
    }
  };
  return { app, events };
}

describe("Markdown plugin integration", () => {
  it("registers enhanced Markdown without claiming the md extension", async () => {
    const { app } = appHarness();
    const plugin = new HtmlPreviewPlugin(app as never, { id: "test" } as never);
    await plugin.onload();

    const mockPlugin = plugin as unknown as {
      registeredExtensions: Array<{ extensions: string[] }>;
      registeredViews: Map<string, unknown>;
    };
    expect(mockPlugin.registeredViews.has(ENHANCED_MARKDOWN_VIEW_TYPE)).toBe(true);
    expect(mockPlugin.registeredExtensions).not.toContainEqual(
      expect.objectContaining({ extensions: expect.arrayContaining(["md"]) })
    );
    expect(plugin.markdownTemplateCatalog).toBeDefined();
    expect(plugin.settings.defaultTemplateId).toBe("book-editorial");
    expect(MARKDOWN_TEMPLATE_ROOT).toBe(".html-preview/markdown-templates");
  });
});
