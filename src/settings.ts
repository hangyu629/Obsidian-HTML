import { App, PluginSettingTab, Setting } from "obsidian";

import type HtmlPreviewPlugin from "./main";
import type { FolderTemplateMapping, MarkdownTemplateSettings } from "./markdown/rules";

export interface HtmlPreviewSettings extends MarkdownTemplateSettings {
  allowScripts: boolean;
}

export const DEFAULT_SETTINGS: HtmlPreviewSettings = {
  allowScripts: true,
  autoEnhanced: true,
  defaultTemplateId: "minimal",
  defaultThemeId: "light",
  folderMappings: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMappings(value: unknown): FolderTemplateMapping[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 128)
    .filter(isRecord)
    .map((mapping) => ({
      folder: typeof mapping.folder === "string" ? mapping.folder.trim() : "",
      templateId:
        typeof mapping.templateId === "string" ? mapping.templateId.trim() : "",
      themeId: typeof mapping.themeId === "string" ? mapping.themeId.trim() : undefined
    }))
    .filter((mapping) => mapping.folder.length > 0 && mapping.templateId.length > 0);
}

export function normalizeSettings(value: unknown): HtmlPreviewSettings {
  const stored = isRecord(value) ? value : {};
  return {
    allowScripts: typeof stored.allowScripts === "boolean" ? stored.allowScripts : true,
    autoEnhanced:
      typeof stored.autoEnhanced === "boolean" ? stored.autoEnhanced : true,
    defaultTemplateId:
      typeof stored.defaultTemplateId === "string" && stored.defaultTemplateId.length > 0
        ? stored.defaultTemplateId
        : DEFAULT_SETTINGS.defaultTemplateId,
    defaultThemeId:
      typeof stored.defaultThemeId === "string" && stored.defaultThemeId.length > 0
        ? stored.defaultThemeId
        : DEFAULT_SETTINGS.defaultThemeId,
    folderMappings: normalizeMappings(stored.folderMappings)
  };
}

export class HtmlPreviewSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: HtmlPreviewPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.replaceChildren();

    new Setting(this.containerEl)
      .setName("Allow page JavaScript")
      .setDesc(
        "Enabled by default. Required for page cleanup. Scripts run in an isolated frame but can still make network requests."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowScripts)
          .onChange(async (value) => {
            this.plugin.settings.allowScripts = value;
            await this.plugin.saveSettings();
            this.plugin.refreshOpenPreviews();
          })
      );

    new Setting(this.containerEl)
      .setName("Automatic enhanced Markdown reading")
      .setDesc("Open matching Markdown notes in the enhanced reading view.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoEnhanced)
          .onChange(async (value) => {
            this.plugin.settings.autoEnhanced = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Default Markdown template")
      .setDesc("Used when opening enhanced reading manually without a matching rule.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.defaultTemplateId)
          .onChange(async (value) => {
            this.plugin.settings.defaultTemplateId = value.trim() || "minimal";
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.containerEl)
      .setName("Default Markdown theme")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.defaultThemeId)
          .onChange(async (value) => {
            this.plugin.settings.defaultThemeId = value.trim() || "light";
            await this.plugin.saveSettings();
          })
      );
  }
}
