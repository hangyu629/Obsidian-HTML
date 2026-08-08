import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  HtmlPreviewSettingTab,
  type HtmlPreviewSettings
} from "../src/settings";

describe("Markdown enhanced reading settings", () => {
  it("defaults to automatic matching with the built-in template", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      allowScripts: true,
      autoEnhanced: true,
      defaultTemplateId: "minimal",
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
  });
});
