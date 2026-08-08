import { Plugin, TFile } from "obsidian";

import {
  HtmlPreviewView,
  HTML_PREVIEW_VIEW_TYPE
} from "./html-preview-view";
import { PreviewCoordinator } from "./preview/preview-coordinator";
import {
  DEFAULT_SETTINGS,
  HtmlPreviewSettingTab,
  type HtmlPreviewSettings
} from "./settings";

export default class HtmlPreviewPlugin extends Plugin {
  readonly coordinator = new PreviewCoordinator();
  settings: HtmlPreviewSettings = { ...DEFAULT_SETTINGS };
  private readonly knownVaultPaths = new Set<string>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.rebuildPathIndex();

    this.registerView(
      HTML_PREVIEW_VIEW_TYPE,
      (leaf) =>
        new HtmlPreviewView(leaf, {
          coordinator: this.coordinator,
          getKnownVaultPaths: () => this.knownVaultPaths,
          getSettings: () => this.settings,
          openExternal: (url) => {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        })
    );
    this.registerExtensions(["html", "htm"], HTML_PREVIEW_VIEW_TYPE);
    this.addSettingTab(new HtmlPreviewSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.knownVaultPaths.delete(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.knownVaultPaths.delete(oldPath);
        this.coordinator.notify(oldPath);
        if (file instanceof TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
  }

  onunload(): void {
    this.coordinator.dispose();
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<HtmlPreviewSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  refreshOpenPreviews(): void {
    for (const file of this.app.vault.getFiles()) {
      if (file.extension === "html" || file.extension === "htm") {
        this.coordinator.notify(file.path);
      }
    }
  }

  private rebuildPathIndex(): void {
    this.knownVaultPaths.clear();
    for (const file of this.app.vault.getFiles()) {
      this.knownVaultPaths.add(file.path);
    }
  }
}

