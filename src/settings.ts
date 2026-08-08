import { App, PluginSettingTab, Setting } from "obsidian";

import type HtmlPreviewPlugin from "./main";

export interface HtmlPreviewSettings {
  allowScripts: boolean;
}

export const DEFAULT_SETTINGS: HtmlPreviewSettings = {
  allowScripts: true
};

export class HtmlPreviewSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: HtmlPreviewPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.replaceChildren();

    new Setting(this.containerEl)
      .setName("Allow page JavaScript")
      .setDesc(
        "Enabled by default. Scripts run in an isolated frame but can still make network requests."
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
  }
}

