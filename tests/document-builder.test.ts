import { describe, expect, it } from "vitest";

import { buildPreviewDocument } from "../src/preview/document-builder";

const knownVaultPaths = new Set([
  "pages/assets/app.js",
  "pages/assets/hero.png",
  "pages/assets/hero@2x.png",
  "pages/assets/style.css",
  "pages/guide.html"
]);

function build(source: string, allowScripts = true) {
  return buildPreviewDocument({
    allowScripts,
    knownVaultPaths,
    renderId: "render-42",
    resourceUrl: "app://vault/pages/index.html?cache=123",
    source,
    sourcePath: "pages/index.html"
  });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("buildPreviewDocument", () => {
  it("normalizes an HTML fragment without changing the source string", () => {
    const source = "<main><h1>Hello</h1></main>";

    const result = build(source);
    const document = parse(result.html);

    expect(source).toBe("<main><h1>Hello</h1></main>");
    expect(document.documentElement).not.toBeNull();
    expect(document.head).not.toBeNull();
    expect(document.body.querySelector("main h1")?.textContent).toBe("Hello");
    expect(result.html.startsWith("<!doctype html>")).toBe(true);
  });

  it("replaces author bases and injects the bridge before author scripts", () => {
    const result = build(`<!doctype html>
      <html><head>
        <base href="https://wrong.example/">
        <script>window.authorScript = true;</script>
      </head><body></body></html>`);
    const document = parse(result.html);
    const bases = document.head.querySelectorAll("base");
    const scripts = [...document.head.querySelectorAll("script")];

    expect(bases).toHaveLength(1);
    expect(bases[0]?.getAttribute("href")).toBe("app://vault/pages/");
    expect(document.head.firstElementChild?.tagName).toBe("BASE");
    expect(scripts[0]?.dataset.htmlPreviewBridge).toBe("true");
    expect(scripts[0]?.textContent).toContain("render-42");
    expect(scripts[1]?.textContent).toContain("authorScript");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "replaced-base", level: "warning" })
    );
  });

  it("keeps author scripts by default", () => {
    const result = build(`<script src="assets/app.js"></script><script>start()</script>`);
    const document = parse(result.html);
    const authorScripts = document.querySelectorAll("script:not([data-html-preview-bridge])");

    expect(authorScripts).toHaveLength(2);
    expect(result.dependencies).toContain("pages/assets/app.js");
  });

  it("removes author scripts when page JavaScript is disabled", () => {
    const result = build(`<script src="assets/app.js"></script><script>start()</script>`, false);
    const document = parse(result.html);

    expect(document.querySelectorAll("script[data-html-preview-bridge]")).toHaveLength(1);
    expect(document.querySelectorAll("script:not([data-html-preview-bridge])")).toHaveLength(0);
    expect(result.dependencies).not.toContain("pages/assets/app.js");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "scripts-disabled", level: "info" })
    );
  });

  it("extracts local resource dependencies including srcset candidates", () => {
    const result = build(`
      <link rel="stylesheet" href="assets/style.css">
      <img src="assets/hero.png"
           srcset="assets/hero.png 1x, assets/hero@2x.png 2x">
      <a href="guide.html">Guide</a>
      <img src="missing.png">
      <img src="https://example.com/remote.png">
      <img src="data:image/png;base64,AAAA">
    `);

    expect([...result.dependencies].sort()).toEqual([
      "pages/assets/hero.png",
      "pages/assets/hero@2x.png",
      "pages/assets/style.css"
    ]);
    expect(result.diagnostics).toContainEqual({
      code: "missing-resource",
      level: "warning",
      message: "Local resource was not found in the Vault: pages/missing.png",
      value: "missing.png"
    });
    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ value: "guide.html" })
    );
  });

  it("reports an invalid Vault resource URL and falls back to about:blank", () => {
    const result = buildPreviewDocument({
      allowScripts: true,
      knownVaultPaths,
      renderId: "render-1",
      resourceUrl: "not a url",
      source: "<p>hello</p>",
      sourcePath: "pages/index.html"
    });
    const document = parse(result.html);

    expect(document.querySelector("base")?.getAttribute("href")).toBe("about:blank");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-resource-url", level: "error" })
    );
  });
});

