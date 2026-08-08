import { describe, expect, it } from "vitest";

import { scopeTemplateCss } from "../src/markdown/css-scope";

describe("template CSS scoping", () => {
  it("prefixes grouped and descendant selectors", () => {
    const scoped = scopeTemplateCss(
      ".card, .card h2 { color: red; }",
      ".enhanced-root"
    );

    expect(scoped).toContain(".enhanced-root .card");
    expect(scoped).toContain(".enhanced-root .card h2");
  });

  it("scopes :root variables and nested media/support rules", () => {
    const scoped = scopeTemplateCss(
      `:root { --accent: red; }
       @media (min-width: 700px) { .card { display: grid; } }
       @supports (display: grid) { .grid { display: grid; } }`,
      ".enhanced-root"
    );

    expect(scoped).toContain(".enhanced-root");
    expect(scoped).toContain("@media");
    expect(scoped).toContain("@supports");
    expect(scoped).toContain(".enhanced-root .card");
    expect(scoped).toContain(".enhanced-root .grid");
  });

  it("preserves keyframes without treating from/to as selectors", () => {
    const scoped = scopeTemplateCss(
      "@keyframes fade { from { opacity: 0; } to { opacity: 1; } } .animated { animation: fade 1s; }",
      ".enhanced-root"
    );

    expect(scoped).toContain("@keyframes fade");
    expect(scoped).toContain("from");
    expect(scoped).toContain(".enhanced-root .animated");
  });

  it.each([
    "@import url('https://example.com/theme.css');",
    ".card { background: url(https://example.com/image.png); }",
    ".card { background: url(data:image/png;base64,abc); }"
  ])("rejects external CSS resource %s", (css) => {
    expect(() => scopeTemplateCss(css, ".enhanced-root")).toThrow(
      "external CSS resources"
    );
  });
});
