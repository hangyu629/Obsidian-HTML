import { describe, expect, it } from "vitest";

import {
  buildReaderPreview,
  buildStandaloneReaderPage,
  isSavedReaderPage,
  SAVED_READER_META_NAME
} from "../src/reader/document-builder";
import type { ReadableArticle } from "../src/reader/extractor";

const article: ReadableArticle = {
  byline: "Research Desk",
  content: `
    <section>
      <p id="lead" onclick="alert(1)" style="color:red">
        A saved page should become a calm reading surface with durable references.
      </p>
      <img src="images/chart.png" srcset="images/chart.png 1x, javascript:alert(1) 2x" alt="Chart">
      <img src="data:image/png;base64,AAAA" alt="Inline">
      <a href="guide.html" onclick="steal()">Guide</a>
      <a href="javascript:alert(1)">Bad link</a>
      <iframe src="https://example.com/frame"></iframe>
      <form action="/submit"><button type="submit">Go</button></form>
      <table><tr><td>Cell</td></tr></table>
      <pre><code>const value = 42;</code></pre>
      <div aria-label="Callout">Important note</div>
    </section>
  `,
  dir: null,
  excerpt: "A practical guide to saved-page reading.",
  lang: "en",
  length: 248,
  siteName: "Research Journal",
  textContent:
    "A saved page should become a calm reading surface with durable references. Guide Important note Cell const value = 42.",
  title: "A durable reading workflow"
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("reader document builder", () => {
  it("builds a standalone reading page without active content", () => {
    const html = buildStandaloneReaderPage(article, "dark");
    const document = parse(html);

    expect(isSavedReaderPage(html)).toBe(true);
    expect(document.querySelector(`meta[name="${SAVED_READER_META_NAME}"]`)?.getAttribute("content")).toBe(
      "1"
    );
    expect(document.documentElement.getAttribute("data-reader-theme")).toBe("dark");
    expect(document.body.textContent).toContain("A durable reading workflow");
    expect(document.body.textContent).toContain("Research Desk");
    expect(document.body.textContent).toContain("Important note");
    expect(document.querySelector("img")?.getAttribute("src")).toBe("images/chart.png");
    expect(document.body.innerHTML).not.toMatch(
      /<script|<iframe|<form|onclick=|javascript:|style=|data-html-preview-bridge/i
    );
    expect(document.querySelector("table td")?.textContent).toBe("Cell");
    expect(document.querySelector("pre code")?.textContent).toContain("const value = 42;");
    expect(document.querySelectorAll("style")).toHaveLength(1);
  });

  it("creates a preview document that adds only the plugin bridge and Vault base", () => {
    const result = buildReaderPreview({
      annotations: [],
      article,
      knownVaultPaths: new Set(["Clippings/images/chart.png", "Clippings/guide.html"]),
      renderId: "reader-42",
      resourceUrl: "app://vault/Clippings/page.html?cache=1",
      sourcePath: "Clippings/page.html",
      theme: "light"
    });
    const preview = parse(result.html);
    const standalone = parse(result.standaloneHtml);

    expect(result.dependencies).toContain("Clippings/images/chart.png");
    expect(preview.querySelector("base")?.getAttribute("href")).toBe("app://vault/Clippings/");
    expect(preview.querySelector("script[data-html-preview-bridge='true']")).not.toBeNull();
    expect(preview.documentElement.getAttribute("data-reader-theme")).toBe("light");
    expect(standalone.querySelector("script[data-html-preview-bridge='true']")).toBeNull();
    expect(standalone.querySelector("base")).toBeNull();
  });
});
