import { describe, expect, it } from "vitest";

import {
  resolveMarkdownTemplate,
  type MarkdownTemplateSettings
} from "../src/markdown/rules";

const settings: MarkdownTemplateSettings = {
  autoEnhanced: true,
  defaultTemplateId: "book-editorial",
  defaultThemeId: "light",
  folderMappings: [
    { folder: "docs", templateId: "editorial", themeId: "dark" },
    { folder: "docs/reports", templateId: "report", themeId: "light" }
  ]
};
const available = new Set(["book-editorial", "editorial", "report"]);

describe("Markdown template rule resolution", () => {
  it("uses valid frontmatter before folder mappings", () => {
    expect(
      resolveMarkdownTemplate(
        "docs/reports/status.md",
        { "html-preview": { template: "editorial", theme: "forest" } },
        settings,
        available,
        "automatic"
      )
    ).toEqual({
      source: "frontmatter",
      templateId: "editorial",
      themeId: "forest"
    });
  });

  it("falls back from invalid frontmatter to the most specific folder", () => {
    expect(
      resolveMarkdownTemplate(
        "docs/reports/status.md",
        { "html-preview": { template: "missing" } },
        settings,
        available,
        "automatic"
      )
    ).toEqual({
      source: "folder",
      templateId: "report",
      themeId: "light"
    });
  });

  it("accepts a flat frontmatter key and normalizes nested paths", () => {
    expect(
      resolveMarkdownTemplate(
        "docs/notes/today.md",
        { "html-preview.template": "editorial", "html-preview.theme": "dark" },
        settings,
        available,
        "automatic"
      )
    ).toEqual({
      source: "frontmatter",
      templateId: "editorial",
      themeId: "dark"
    });
  });

  it("uses the global default only for manual opening", () => {
    expect(
      resolveMarkdownTemplate(
        "notes/today.md",
        {},
        settings,
        available,
        "automatic"
      )
    ).toBeNull();
    expect(
      resolveMarkdownTemplate(
        "notes/today.md",
        {},
        settings,
        available,
        "manual"
      )
    ).toEqual({
      source: "default",
      templateId: "book-editorial",
      themeId: "light"
    });
  });

  it("ignores invalid mappings and unavailable default templates", () => {
    expect(
      resolveMarkdownTemplate(
        "docs/page.md",
        { "html-preview": { template: "../escape" } },
        { ...settings, defaultTemplateId: "missing", folderMappings: [] },
        available,
        "manual"
      )
    ).toBeNull();
  });
});
