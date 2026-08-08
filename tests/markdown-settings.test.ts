import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  HtmlPreviewSettingTab,
  normalizeSettings,
  type HtmlPreviewSettings
} from "../src/settings";

describe("Markdown enhanced reading settings", () => {
  it("defaults to automatic matching with the built-in template", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      allowScripts: true,
      autoEnhanced: true,
      defaultTemplateId: "book-editorial",
      defaultThemeId: "light",
      folderMappings: []
    });
  });

  it("renders controls for enhanced reading defaults", () => {
    const plugin = {
      settings: { ...DEFAULT_SETTINGS } as HtmlPreviewSettings,
      saveSettings: vi.fn(async () => undefined),
      refreshOpenPreviews: vi.fn()
    } as never;
    const tab = new HtmlPreviewSettingTab({} as never, plugin);
    tab.display();
    expect(tab.containerEl).toBeDefined();
    expect(tab.containerEl.textContent).toContain("Folder template mappings");
  });

  it("migrates the removed minimal template in stored settings", () => {
    expect(
      normalizeSettings({
        defaultTemplateId: "minimal",
        folderMappings: [{ folder: "books", templateId: "minimal", themeId: "light" }]
      })
    ).toMatchObject({
      defaultTemplateId: "book-editorial",
      folderMappings: [{ folder: "books", templateId: "book-editorial" }]
    });
  });
});
