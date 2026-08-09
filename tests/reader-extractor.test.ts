import { describe, expect, it } from "vitest";

import { extractReadableArticle } from "../src/reader/extractor";
import type { CleanupRule } from "../src/cleanup/types";
import { validRule } from "./fixtures/cleanup-rules";

const articleParagraph = `
  A durable reading workflow keeps the original research context close at hand.
  The central article sentence explains how saved pages become useful reference
  material instead of disposable browser tabs. Readers can return to the source,
  compare claims, annotate important passages, and preserve the surrounding
  evidence without depending on the original website remaining online.
`;

const noisyArticle = `<!doctype html>
<html lang="en">
  <head>
    <title>A durable reading workflow</title>
    <meta name="author" content="Research Desk">
    <meta name="description" content="A practical guide to saved-page reading.">
  </head>
  <body>
    <header><nav>Home Products Subscribe Account</nav></header>
    <main class="layout">
      <article>
        <h1>A durable reading workflow</h1>
        <p>${articleParagraph}</p>
        <p>${articleParagraph}</p>
      </article>
      <aside class="sidebar" aria-label="Related content">Related articles</aside>
    </main>
    <footer>Terms Privacy Advertising</footer>
    <script>window.tracker = true;</script>
  </body>
</html>`;

describe("reader extractor", () => {
  it("extracts the main article after applying cleanup rules", () => {
    const unmatchedRule: CleanupRule = {
      ...validRule,
      fingerprint: {
        ...validRule.fingerprint,
        attributes: { "aria-label": "Sponsored content" },
        classes: ["sponsored"],
        text: "Sponsored links"
      },
      id: "fedcba9876543210fedcba9876543210",
      selector: "aside.sponsored"
    };

    const result = extractReadableArticle({
      cleanupRules: [validRule, unmatchedRule],
      source: noisyArticle,
      sourcePath: "Clippings/page.html"
    });

    expect(result.ok).toBe(true);
    expect(result.unmatchedRuleIds).toEqual([unmatchedRule.id]);
    if (!result.ok) return;
    expect(result.article.title).toBe("A durable reading workflow");
    expect(result.article.byline).toBe("Research Desk");
    expect(result.article.excerpt).toBe("A practical guide to saved-page reading.");
    expect(result.article.lang).toBe("en");
    expect(result.article.content).toContain("central article sentence");
    expect(result.article.content).not.toContain("Related articles");
    expect(result.article.textContent.length).toBeGreaterThan(120);
  });

  it("returns a typed failure for a navigation-only page", () => {
    const result = extractReadableArticle({
      cleanupRules: [],
      source: "<html><body><nav><a href='/'>Home</a></nav></body></html>",
      sourcePath: "Clippings/navigation.html"
    });

    expect(result).toEqual({
      ok: false,
      reason: "no-article",
      unmatchedRuleIds: []
    });
  });
});
