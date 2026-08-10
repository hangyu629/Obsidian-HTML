import { Component, MarkdownRenderer } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderEnhancedMarkdown } from "../src/markdown/render-document";
import {
  BUILT_IN_TEMPLATE,
  builtInTemplateFor
} from "../src/markdown/templates/built-in";
import type { MarkdownTemplatePackage } from "../src/markdown/templates/types";

function template(layout = BUILT_IN_TEMPLATE.layout): MarkdownTemplatePackage {
  return {
    ...BUILT_IN_TEMPLATE,
    layout,
    styles: ".page { color: red; }",
    themes: { light: ":root { --accent: green; }" }
  };
}

describe("renderEnhancedMarkdown", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("uses Obsidian's native renderer in the content slot", async () => {
    const root = document.createElement("article");
    const component = new Component();
    const render = vi
      .spyOn(MarkdownRenderer, "render")
      .mockImplementation(async (_app, _source, element) => {
        element.innerHTML = "<h2>Rendered heading</h2><p>Native content</p>";
      });

    await renderEnhancedMarkdown({
      app: {} as never,
      component,
      root,
      source: "## Rendered heading\n\nNative content",
      sourcePath: "notes/example.md",
      template: template(
        `<header data-slot="title"></header><aside data-slot="toc"></aside><main class="page" data-slot="content"></main>`
      )
    });

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      "## Rendered heading\n\nNative content",
      root.querySelector("[data-slot=content]"),
      "notes/example.md",
      component
    );
    expect(root.querySelector("[data-slot=title]")?.textContent).toBe("example");
    expect(root.querySelector("[data-slot=content]")?.textContent).toContain(
      "Native content"
    );
    expect(root.querySelector("[data-slot=toc] a")?.getAttribute("href")).toBe(
      "#enhanced-heading-rendered-heading"
    );
  });

  it("scopes template and theme CSS and resolves template-local asset URLs", async () => {
    const root = document.createElement("article");
    await renderEnhancedMarkdown({
      app: {} as never,
      component: new Component(),
      resolveAsset: (path) => `app://vault/${path}`,
      root,
      source: "Content",
      sourcePath: "notes/example.md",
      template: template(
        `<main data-slot="content"></main><img src="assets/banner.png">`
      )
    });

    const style = root.querySelector("style[data-enhanced-markdown-template]");
    expect(style?.textContent).toContain(".page");
    expect(style?.textContent).toContain("--accent: green");
    expect(style?.textContent).not.toContain(":root");
    expect(root.querySelector("img")?.getAttribute("src")).toBe(
      "app://vault/.html-preview/markdown-templates/book-editorial/assets/banner.png"
    );
  });

  it("renders optional Properties data and removes unused optional slots", async () => {
    const root = document.createElement("article");
    await renderEnhancedMarkdown({
      app: {} as never,
      component: new Component(),
      frontmatter: { status: "draft", tags: ["docs"] },
      root,
      source: "Content",
      sourcePath: "notes/example.md",
      template: template(
        `<aside data-slot="properties"></aside><aside data-slot="toc"></aside><main data-slot="content"></main>`
      )
    });

    expect(root.querySelector("[data-slot=properties]")?.textContent).toContain(
      "status"
    );
    expect(root.querySelector("[data-slot=properties]")?.textContent).toContain(
      "draft"
    );
    expect(root.querySelector("[data-slot=toc]")).toBeNull();
  });

  it("does not mutate the Markdown source string", async () => {
    const source = "# Original\n\n[[Linked note]]";
    const root = document.createElement("article");
    await renderEnhancedMarkdown({
      app: {} as never,
      component: new Component(),
      root,
      source,
      sourcePath: "notes/example.md",
      template: template()
    });

    expect(source).toBe("# Original\n\n[[Linked note]]");
  });

  it("provides the editorial cover, themes, and core Markdown styling contract", () => {
    expect(BUILT_IN_TEMPLATE.manifest).toMatchObject({
      id: "book-editorial",
      name: "Book Editorial",
      themes: expect.arrayContaining([
        expect.objectContaining({ id: "light" }),
        expect.objectContaining({ id: "dark" })
      ])
    });
    expect(BUILT_IN_TEMPLATE.layout).toContain("book-editorial-cover");
    expect(BUILT_IN_TEMPLATE.layout).toContain('data-slot="toc"');
    for (const selector of [
      ".book-editorial-content h1",
      ".book-editorial-content blockquote",
      ".book-editorial-content .callout",
      ".book-editorial-content table",
      ".book-editorial-content pre",
      ".book-editorial-content .task-list-item-checkbox",
      ".book-editorial-content .math-block",
      ".book-editorial-content .footnotes"
    ]) {
      expect(BUILT_IN_TEMPLATE.styles).toContain(selector);
    }
  });

  it("provides the magazine research layout, themes, and core Markdown styling contract", () => {
    const template = builtInTemplateFor("magazine-research");

    expect(template?.manifest).toMatchObject({
      id: "magazine-research",
      name: "Magazine Research",
      themes: expect.arrayContaining([
        expect.objectContaining({ id: "light" }),
        expect.objectContaining({ id: "dark" })
      ])
    });
    expect(template?.layout).toContain("magazine-research-masthead");
    for (const slot of ["title", "properties", "toc", "content"]) {
      expect(template?.layout).toContain(`data-slot=\"${slot}\"`);
    }
    for (const selector of [
      ".magazine-research-content h1",
      ".magazine-research-content blockquote",
      ".magazine-research-content .callout",
      ".magazine-research-content table",
      ".magazine-research-content pre",
      ".magazine-research-content .task-list-item-checkbox",
      ".magazine-research-content .math-block",
      ".magazine-research-content .internal-embed",
      ".magazine-research-content .footnotes",
      "@media (max-width: 700px)"
    ]) {
      expect(template?.styles).toContain(selector);
    }
  });

  it("provides the command library layout, themes, and responsive card contract", () => {
    const template = builtInTemplateFor("command-library");

    expect(template?.manifest).toMatchObject({
      id: "command-library",
      name: "Command Library",
      themes: expect.arrayContaining([
        expect.objectContaining({ id: "light" }),
        expect.objectContaining({ id: "dark" })
      ])
    });
    for (const hook of [
      'data-command-library-search',
      'data-command-library-categories',
      'data-command-library-introduction',
      'data-command-library-empty',
      'data-slot="content"'
    ]) {
      expect(template?.layout).toContain(hook);
    }
    for (const selector of [
      ".command-library-page",
      ".command-library-card",
      ".command-library-category-button",
      ".command-library-copy",
      ".command-library-empty",
      ".command-library-search",
      "@media (max-width: 760px)"
    ]) {
      expect(template?.styles).toContain(selector);
    }
  });
});
