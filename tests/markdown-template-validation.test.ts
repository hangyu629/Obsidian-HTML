import { describe, expect, it } from "vitest";

import {
  parseTemplateManifest,
  validateTemplateLayout,
  validateTemplatePackage
} from "../src/markdown/templates/validation";
import type { TemplatePackageFiles } from "../src/markdown/templates/types";

const validManifest = {
  defaultTheme: "light",
  id: "editorial",
  name: "Editorial",
  themes: [
    { id: "light", name: "Light", stylesheet: "themes/light.css" },
    { id: "dark", name: "Dark", stylesheet: "themes/dark.css" }
  ],
  version: 1
};

const validLayout = `
  <article class="page-shell">
    <header><div data-slot="title"></div><div data-slot="properties"></div></header>
    <aside data-slot="toc"></aside>
    <main data-slot="content"></main>
    <img src="assets/cover.jpg" alt="Cover">
  </article>`;

function validFiles(
  overrides: Partial<TemplatePackageFiles> = {}
): TemplatePackageFiles {
  return {
    layout: validLayout,
    manifest: JSON.stringify(validManifest),
    styles: ".page-shell { color: var(--text-normal); }",
    themes: {
      dark: ":root { --page-accent: black; }",
      light: ":root { --page-accent: white; }"
    },
    ...overrides
  };
}

describe("Markdown template validation", () => {
  it("accepts a bounded manifest and normalizes only declared fields", () => {
    expect(parseTemplateManifest({ ...validManifest, unknown: true })).toEqual(
      validManifest
    );
  });

  it.each([
    { ...validManifest, id: "../outside" },
    { ...validManifest, id: "UPPER_CASE" },
    { ...validManifest, name: "" },
    { ...validManifest, version: 2 },
    {
      ...validManifest,
      themes: [{ id: "light", name: "Light", stylesheet: "../outside.css" }]
    },
    {
      ...validManifest,
      themes: [
        { id: "light", name: "One", stylesheet: "themes/one.css" },
        { id: "light", name: "Two", stylesheet: "themes/two.css" }
      ]
    }
  ])("rejects invalid manifest %#", (manifest) => {
    expect(parseTemplateManifest(manifest)).toBeNull();
  });

  it("requires one content slot and permits the documented optional slots", () => {
    const result = validateTemplateLayout(validLayout);

    expect(result).toEqual({
      html: validLayout,
      slots: new Set(["content", "properties", "title", "toc"])
    });
  });

  it.each([
    "<main></main>",
    "<main data-slot=\"unknown\"></main>",
    "<script data-slot=\"content\">alert(1)</script>",
    "<main data-slot=\"content\" onclick=\"alert(1)\"></main>",
    "<main data-slot=\"content\"><iframe src=\"https://example.com\"></iframe></main>",
    "<main data-slot=\"content\"><form action=\"/send\"></form></main>",
    "<main data-slot=\"content\"><meta http-equiv=\"refresh\" content=\"0\"></main>",
    "<main data-slot=\"content\"><img src=\"https://example.com/a.png\"></main>"
  ])("rejects unsafe or incomplete layout %s", (layout) => {
    expect(validateTemplateLayout(layout)).toBeNull();
  });

  it("rejects a package when a declared theme stylesheet is missing", () => {
    expect(
      validateTemplatePackage(
        validFiles({ themes: { light: ":root {}" } })
      )
    ).toBeNull();
  });

  it("returns a validated package with only declared themes", () => {
    const packageValue = validateTemplatePackage(validFiles());

    expect(packageValue).toEqual({
      layout: validLayout,
      manifest: validManifest,
      styles: ".page-shell { color: var(--text-normal); }",
      themes: {
        dark: ":root { --page-accent: black; }",
        light: ":root { --page-accent: white; }"
      }
    });
  });
});
