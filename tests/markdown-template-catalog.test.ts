import { describe, expect, it } from "vitest";

import {
  MarkdownTemplateCatalog,
  markdownTemplatePath
} from "../src/markdown/templates/catalog";
import { BUILT_IN_TEMPLATE_ID } from "../src/markdown/templates/built-in";

class MemoryTemplateAdapter {
  readonly files = new Map<string, string>();

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`Missing file: ${path}`);
    return content;
  }

  async list(prefix: string): Promise<{ files: string[]; folders: string[] }> {
    const files = [...this.files.keys()].filter((path) => path.startsWith(prefix));
    const folders = new Set<string>();
    for (const path of files) {
      const remainder = path.slice(prefix.length);
      const slash = remainder.indexOf("/");
      if (slash > 0) folders.add(`${prefix}${remainder.slice(0, slash)}`);
    }
    return { files, folders: [...folders] };
  }
}

function seedEditorial(adapter: MemoryTemplateAdapter): void {
  const root = markdownTemplatePath("editorial");
  adapter.files.set(
    `${root}/template.json`,
    JSON.stringify({
      defaultTheme: "light",
      id: "editorial",
      name: "Editorial",
      themes: [{ id: "light", name: "Light", stylesheet: "themes/light.css" }],
      version: 1
    })
  );
  adapter.files.set(`${root}/layout.html`, `<main data-slot="content"></main>`);
  adapter.files.set(`${root}/styles.css`, ".page {}");
  adapter.files.set(`${root}/themes/light.css`, ":root {}");
}

describe("MarkdownTemplateCatalog", () => {
  it("lists valid Vault templates and always exposes the built-in template", async () => {
    const adapter = new MemoryTemplateAdapter();
    seedEditorial(adapter);
    const catalog = new MarkdownTemplateCatalog(adapter);

    expect(await catalog.list()).toEqual([
      {
        defaultTheme: "light",
        description: "Book-like single-column reading with a paper editorial cover.",
        id: BUILT_IN_TEMPLATE_ID,
        name: "Book Editorial",
        themeIds: ["light", "dark"],
        themeNames: { light: "Light paper", dark: "Dark forest" }
      },
      {
        defaultTheme: "light",
        description: "Wide research-report reading with a navy masthead and coral accents.",
        id: "magazine-research",
        name: "Magazine Research",
        themeIds: ["light", "dark"],
        themeNames: { light: "Light paper", dark: "Dark report" }
      },
      {
        defaultTheme: "light",
        description: "Searchable categorized command cards for operational reference notes.",
        id: "command-library",
        name: "Command Library",
        themeIds: ["light", "dark"],
        themeNames: { light: "Light library", dark: "Dark library" }
      },
      {
        defaultTheme: "light",
        description: undefined,
        id: "editorial",
        name: "Editorial",
        themeIds: ["light"],
        themeNames: { light: "Light" }
      }
    ]);
  });

  it("loads built-in templates before matching Vault packages", async () => {
    const adapter = new MemoryTemplateAdapter();
    seedEditorial(adapter);
    const root = markdownTemplatePath("magazine-research");
    adapter.files.set(
      `${root}/template.json`,
      JSON.stringify({
        defaultTheme: "light",
        id: "magazine-research",
        name: "Vault collision",
        themes: [{ id: "light", name: "Light", stylesheet: "themes/light.css" }],
        version: 1
      })
    );
    adapter.files.set(`${root}/layout.html`, `<main data-slot="content"></main>`);
    adapter.files.set(`${root}/styles.css`, ".page {}");
    adapter.files.set(`${root}/themes/light.css`, ":root {}");
    const catalog = new MarkdownTemplateCatalog(adapter);

    await expect(catalog.load("magazine-research")).resolves.toMatchObject({
      manifest: { id: "magazine-research", name: "Magazine Research" }
    });
    expect((await catalog.list()).map((template) => template.id)).toEqual([
      "book-editorial",
      "magazine-research",
      "command-library",
      "editorial"
    ]);
  });

  it("loads a validated package and its declared theme files", async () => {
    const adapter = new MemoryTemplateAdapter();
    seedEditorial(adapter);
    const catalog = new MarkdownTemplateCatalog(adapter);

    await expect(catalog.load("editorial")).resolves.toEqual({
      layout: `<main data-slot="content"></main>`,
      manifest: {
        defaultTheme: "light",
        id: "editorial",
        name: "Editorial",
        themes: [{ id: "light", name: "Light", stylesheet: "themes/light.css" }],
        version: 1
      },
      styles: ".page {}",
      themes: { light: ":root {}" }
    });
  });

  it("falls back to the built-in package for missing and corrupt templates", async () => {
    const adapter = new MemoryTemplateAdapter();
    adapter.files.set(
      `${markdownTemplatePath("broken")}/template.json`,
      "{not-json"
    );
    const catalog = new MarkdownTemplateCatalog(adapter);

    await expect(catalog.load("missing")).resolves.toMatchObject({
      manifest: { id: BUILT_IN_TEMPLATE_ID }
    });
    await expect(catalog.load("broken")).resolves.toMatchObject({
      manifest: { id: BUILT_IN_TEMPLATE_ID }
    });
    expect((await catalog.list()).map((item) => item.id)).toEqual([
      BUILT_IN_TEMPLATE_ID,
      "magazine-research",
      "command-library"
    ]);
  });
});
