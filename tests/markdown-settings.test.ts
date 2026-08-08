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
      listMarkdownTemplates: vi.fn(() => [
        {
          defaultTheme: "light",
          id: "book-editorial",
          name: "Book Editorial",
          themeIds: ["light", "dark"],
          themeNames: { light: "Light paper", dark: "Dark forest" }
        },
        {
          defaultTheme: "light",
          id: "magazine-research",
          name: "Magazine Research",
          themeIds: ["light", "dark"],
          themeNames: { light: "Light paper", dark: "Dark report" }
        }
      ]),
      settings: { ...DEFAULT_SETTINGS } as HtmlPreviewSettings,
      saveSettings: vi.fn(async () => undefined),
      refreshOpenPreviews: vi.fn()
      ,listMarkdownFolders: vi.fn(() => [])
    };
    const tab = new HtmlPreviewSettingTab({} as never, plugin as never);
    tab.display();
    expect(tab.containerEl).toBeDefined();
    expect(tab.containerEl.textContent).toContain("Open Markdown in Enhanced Preview by default");
    expect(tab.containerEl.querySelector("select[data-default-template]")).not.toBeNull();
    expect(tab.containerEl.querySelector("select[data-default-theme]")).not.toBeNull();
  });

  it("lets each folder mapping select a template and its theme", async () => {
    const plugin = {
      listMarkdownTemplates: vi.fn(() => [
        {
          defaultTheme: "light",
          id: "book-editorial",
          name: "Book Editorial",
          themeIds: ["light", "dark"],
          themeNames: { light: "Light paper", dark: "Dark forest" }
        },
        {
          defaultTheme: "light",
          id: "magazine-research",
          name: "Magazine Research",
          themeIds: ["light", "dark"],
          themeNames: { light: "Light paper", dark: "Dark report" }
        }
      ]),
      settings: {
        ...DEFAULT_SETTINGS,
        folderMappings: [
          { folder: "Books", templateId: "book-editorial", themeId: "dark" }
        ]
      } as HtmlPreviewSettings,
      saveSettings: vi.fn(async () => undefined),
      refreshOpenPreviews: vi.fn()
      ,listMarkdownFolders: vi.fn(() => ["Books", "Books/Research"])
    };
    const tab = new HtmlPreviewSettingTab({} as never, plugin as never);

    tab.display();

    const templateSelect = tab.containerEl.querySelector<HTMLSelectElement>(
      "select[data-folder-template]"
    );
    expect(templateSelect?.textContent).toContain("Magazine Research");
    const themeSelect = tab.containerEl.querySelector<HTMLSelectElement>(
      "select[data-folder-theme]"
    );
    expect(themeSelect?.value).toBe("dark");
    expect(themeSelect?.textContent).toContain("Dark forest");

    (templateSelect as HTMLSelectElement).value = "magazine-research";
    templateSelect?.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.settings.folderMappings[0]).toEqual({
      folder: "Books",
      templateId: "magazine-research",
      themeId: "light"
    });
    expect(plugin.saveSettings).toHaveBeenCalled();
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
