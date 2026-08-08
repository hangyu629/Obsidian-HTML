import { describe, expect, it } from "vitest";

import { classifyNavigation } from "../src/preview/navigation";

describe("classifyNavigation", () => {
  it("keeps fragment navigation inside the preview", () => {
    expect(classifyNavigation("#details", "pages/index.html")).toEqual({
      kind: "fragment"
    });
  });

  it.each([
    "https://example.com/docs?q=1#top",
    "http://localhost:3000/app",
    "mailto:hello@example.com",
    "tel:+12125550123"
  ])("allows external destination %s", (url) => {
    expect(classifyNavigation(url, "pages/index.html")).toEqual({
      kind: "external",
      url
    });
  });

  it("resolves a sibling HTML file and preserves its subpath", () => {
    expect(classifyNavigation("guide.html?mode=full#intro", "pages/index.html")).toEqual({
      kind: "vault",
      path: "pages/guide.html",
      subpath: "#intro"
    });
  });

  it("resolves parent-directory and root-relative Vault paths", () => {
    expect(classifyNavigation("../shared/about.html", "pages/topic/index.html")).toEqual({
      kind: "vault",
      path: "pages/shared/about.html",
      subpath: ""
    });
    expect(classifyNavigation("/shared/about.html", "pages/index.html")).toEqual({
      kind: "vault",
      path: "shared/about.html",
      subpath: ""
    });
  });

  it("decodes safe percent-encoded path segments", () => {
    expect(classifyNavigation("../My%20Page.html", "pages/index.html")).toEqual({
      kind: "vault",
      path: "My Page.html",
      subpath: ""
    });
  });

  it.each([
    "../../outside.html",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/page.html",
    "custom:payload",
    "folder\\page.html",
    "bad%00name.html",
    "https://example.com/%E0%A4%A"
  ])("blocks unsafe destination %s", (href) => {
    expect(classifyNavigation(href, "pages/index.html").kind).toBe("blocked");
  });

  it("blocks empty and whitespace-only links", () => {
    expect(classifyNavigation("  ", "pages/index.html")).toEqual({
      kind: "blocked",
      reason: "Empty link"
    });
  });
});

