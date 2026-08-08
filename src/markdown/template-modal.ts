import { Modal, type App } from "obsidian";

import type { MarkdownTemplateSummary } from "./templates/types";

export interface MarkdownTemplateModalEnvironment {
  list(): Promise<MarkdownTemplateSummary[]>;
  onSelect(selection: { templateId: string; themeId: string }): void;
}

export class MarkdownTemplateModal extends Modal {
  constructor(
    app: App,
    private readonly environment: MarkdownTemplateModalEnvironment
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.textContent = "Enhanced Markdown template";
    this.contentEl.replaceChildren();
    void this.populate();
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }

  private async populate(): Promise<void> {
    try {
      const templates = await this.environment.list();
      const fragment = document.createDocumentFragment();
      for (const template of templates) {
        const section = document.createElement("section");
        section.className = "enhanced-markdown-template-card";
        section.dataset.templateId = template.id;
        const header = document.createElement("div");
        header.className = "enhanced-markdown-template-card-header";
        const heading = document.createElement("h3");
        heading.textContent = template.name;
        header.append(heading);
        const badge = document.createElement("span");
        badge.className = "enhanced-markdown-template-badge";
        badge.textContent = template.id === "book-editorial" ? "Built-in" : "Available";
        header.append(badge);
        section.append(header);
        if (template.description) {
          const description = document.createElement("p");
          description.className = "enhanced-markdown-template-description";
          description.textContent = template.description;
          section.append(description);
        }
        const themes = document.createElement("div");
        themes.className = "enhanced-markdown-template-themes";
        for (const themeId of template.themeIds) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.templateId = template.id;
          button.dataset.themeId = themeId;
          button.textContent = template.themeNames?.[themeId] ?? themeId;
          button.title = `Use ${template.name} with ${button.textContent}`;
          button.addEventListener("click", () => {
            this.environment.onSelect({ templateId: template.id, themeId });
            this.close();
          });
          themes.append(button);
        }
        section.append(themes);
        fragment.append(section);
      }
      if (templates.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No valid Markdown templates are available.";
        fragment.append(empty);
      }
      this.contentEl.replaceChildren(fragment);
    } catch {
      const error = document.createElement("p");
      error.textContent = "Unable to load Markdown templates.";
      this.contentEl.replaceChildren(error);
    }
  }
}
