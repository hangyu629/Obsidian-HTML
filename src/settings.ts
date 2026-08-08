import { App, PluginSettingTab, Setting } from "obsidian";

import type HtmlPreviewPlugin from "./main";
import type { FolderTemplateMapping, MarkdownTemplateSettings } from "./markdown/rules";

export interface HtmlPreviewSettings extends MarkdownTemplateSettings {
  allowScripts: boolean;
}

export const DEFAULT_SETTINGS: HtmlPreviewSettings = {
  allowScripts: true,
  autoEnhanced: true,
  defaultTemplateId: "book-editorial",
  defaultThemeId: "light",
  folderMappings: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTemplateId(value: string): string {
  return value === "minimal" ? "book-editorial" : value;
}

function normalizeMappings(value: unknown): FolderTemplateMapping[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 128)
    .filter(isRecord)
    .map((mapping) => ({
      folder: typeof mapping.folder === "string" ? mapping.folder.trim() : "",
      templateId:
        typeof mapping.templateId === "string"
          ? normalizeTemplateId(mapping.templateId.trim())
          : "",
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
        ? normalizeTemplateId(stored.defaultTemplateId)
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
            this.plugin.settings.defaultTemplateId =
              normalizeTemplateId(value.trim()) || "book-editorial";
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

    new Setting(this.containerEl)
      .setName("Folder template mappings")
      .setDesc("The most specific matching folder wins when a note has no frontmatter override.")
      .addButton((button) =>
        button
          .setButtonText("Add mapping")
          .onClick(async () => {
            this.plugin.settings.folderMappings = [
              ...this.plugin.settings.folderMappings,
              { folder: "", templateId: "book-editorial", themeId: "light" }
            ];
            await this.plugin.saveSettings();
            this.display();
          })
      );

    this.plugin.settings.folderMappings.forEach((mapping, index) => {
      const update = async (changes: Partial<typeof mapping>): Promise<void> => {
        this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.map(
          (current, currentIndex) =>
            currentIndex === index
              ? {
                  ...current,
                  ...changes,
                  templateId: normalizeTemplateId(changes.templateId ?? current.templateId)
                }
              : current
        );
        await this.plugin.saveSettings();
      };
      new Setting(this.containerEl)
        .setName(`Folder mapping ${index + 1}`)
        .addText((text) =>
          text
            .setValue(mapping.folder)
            .setPlaceholder("Folder path")
            .onChange((value) => update({ folder: value.trim() }))
        )
        .addText((text) =>
          text
            .setValue(mapping.templateId)
            .setPlaceholder("Template id")
            .onChange((value) => update({ templateId: value.trim() }))
        )
        .addText((text) =>
          text
            .setValue(mapping.themeId ?? "")
            .setPlaceholder("Theme id")
            .onChange((value) => update({ themeId: value.trim() || undefined }))
        )
        .addExtraButton((button) =>
          button.setIcon("trash").setTooltip("Remove mapping").onClick(async () => {
            this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.filter(
              (_current, currentIndex) => currentIndex !== index
            );
            await this.plugin.saveSettings();
            this.display();
          })
        );
    });
  }
}
