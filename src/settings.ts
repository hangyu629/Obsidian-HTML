import { App, PluginSettingTab, Setting } from "obsidian";

import type HtmlPreviewPlugin from "./main";
import type { FolderTemplateMapping, MarkdownTemplateSettings } from "./markdown/rules";
import type { MarkdownTemplateSummary } from "./markdown/templates/types";

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
      .setName("Open Markdown in Enhanced Preview by default")
      .setDesc("Open Markdown notes in Enhanced Preview automatically when they are opened.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoEnhanced)
          .onChange(async (value) => {
            this.plugin.settings.autoEnhanced = value;
            await this.plugin.saveSettings();
          })
      );

    const templates = this.plugin.listMarkdownTemplates();
    this.addDefaultTemplateSetting(templates);
    this.addDefaultThemeSetting(templates);

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
      const row = new Setting(this.containerEl)
        .setName(`Folder mapping ${index + 1}`)
        .addDropdown((dropdown) => {
          dropdown.addOption("", "Vault root");
          for (const folder of this.plugin.listMarkdownFolders()) {
            dropdown.addOption(folder, folder);
          }
          dropdown.setValue(mapping.folder);
          dropdown.onChange((value) => void update({ folder: value }));
        }
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
      this.addFolderTemplateSelectors(row.settingEl, mapping, templates, update);
    });
  }

  private addDefaultTemplateSetting(templates: readonly MarkdownTemplateSummary[]): void {
    const setting = new Setting(this.containerEl)
      .setName("Default Markdown template")
      .setDesc("Used when opening enhanced reading manually without a matching rule.");
    setting.addDropdown((dropdown) => {
      for (const template of templates) dropdown.addOption(template.id, template.name);
      dropdown.setValue(this.plugin.settings.defaultTemplateId);
      dropdown.onChange(async (value) => {
        const template = templates.find((item) => item.id === value);
        if (!template) return;
        this.plugin.settings.defaultTemplateId = template.id;
        this.plugin.settings.defaultThemeId = template.defaultTheme;
        await this.plugin.saveSettings();
        this.display();
      });
      dropdown.selectEl.dataset.defaultTemplate = "true";
    });
  }

  private addDefaultThemeSetting(templates: readonly MarkdownTemplateSummary[]): void {
    const selected = templates.find((template) => template.id === this.plugin.settings.defaultTemplateId);
    const setting = new Setting(this.containerEl).setName("Default Markdown theme");
    setting.addDropdown((dropdown) => {
      for (const themeId of selected?.themeIds ?? ["light"]) {
        dropdown.addOption(themeId, selected?.themeNames?.[themeId] ?? themeId);
      }
      dropdown.setValue(selected?.themeIds.includes(this.plugin.settings.defaultThemeId)
        ? this.plugin.settings.defaultThemeId
        : selected?.defaultTheme ?? "light");
      dropdown.onChange(async (value) => {
        this.plugin.settings.defaultThemeId = value;
        await this.plugin.saveSettings();
      });
      dropdown.selectEl.dataset.defaultTheme = "true";
    });
  }

  private addFolderTemplateSelectors(
    setting: HTMLElement,
    mapping: FolderTemplateMapping,
    templates: readonly MarkdownTemplateSummary[],
    update: (changes: Partial<FolderTemplateMapping>) => Promise<void>
  ): void {
    if (templates.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "No Markdown templates available";
      setting.append(empty);
      return;
    }
    const fallbackTemplate = templates[0];
    if (!fallbackTemplate) return;
    const selectedTemplate =
      templates.find((template) => template.id === mapping.templateId) ?? fallbackTemplate;
    const templateSelect = document.createElement("select");
    templateSelect.dataset.folderTemplate = "true";
    for (const template of templates) {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.append(option);
    }
    templateSelect.value = selectedTemplate.id;
    templateSelect.addEventListener("change", () => {
      const template = templates.find((item) => item.id === templateSelect.value);
      if (!template) return;
      void update({ templateId: template.id, themeId: template.defaultTheme }).then(() => {
        this.display();
      });
    });

    const themeSelect = document.createElement("select");
    themeSelect.dataset.folderTheme = "true";
    for (const themeId of selectedTemplate.themeIds) {
      const option = document.createElement("option");
      option.value = themeId;
      option.textContent = selectedTemplate.themeNames?.[themeId] ?? themeId;
      themeSelect.append(option);
    }
    themeSelect.value = selectedTemplate.themeIds.includes(mapping.themeId ?? "")
      ? mapping.themeId ?? selectedTemplate.defaultTheme
      : selectedTemplate.defaultTheme;
    themeSelect.addEventListener("change", () => {
      void update({ themeId: themeSelect.value });
    });
    setting.append(templateSelect, themeSelect);
  }
}
