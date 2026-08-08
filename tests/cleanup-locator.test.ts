import { describe, expect, it } from "vitest";

import {
  isGeneratedElementId,
  resolveCleanupRule,
  scoreFingerprint
} from "../src/cleanup/locator";
import { validRule } from "./fixtures/cleanup-rules";

describe("cleanup locator", () => {
  it.each([
    "550e8400-e29b-41d4-a716-446655440000",
    "react-123456789",
    ":r1:",
    "ember987654"
  ])("recognizes generated element ID %s", (id) => {
    expect(isGeneratedElementId(id)).toBe(true);
  });

  it.each(["sidebar", "main-navigation", "article-related"]) (
    "keeps stable element ID %s",
    (id) => {
      expect(isGeneratedElementId(id)).toBe(false);
    }
  );

  it("resolves a unique selector that matches its fingerprint", () => {
    document.body.innerHTML = `
      <main class="layout">
        <article>Article</article>
        <aside class="sidebar" aria-label="Related content">Related articles</aside>
      </main>`;

    expect(resolveCleanupRule(document, validRule)).toBe(
      document.querySelector("aside.sidebar")
    );
  });

  it("falls back to fingerprint scoring when classes change", () => {
    document.body.innerHTML = `
      <main class="layout">
        <aside class="generated-42" aria-label="Related content">Related articles</aside>
      </main>`;

    expect(resolveCleanupRule(document, validRule)).toBe(
      document.querySelector("aside")
    );
  });

  it("rejects an ambiguous folder-scoped match", () => {
    document.body.innerHTML = `
      <main class="layout">
        <aside class="sidebar" aria-label="Related content">Related articles</aside>
        <aside class="sidebar" aria-label="Related content">Related articles</aside>
      </main>`;
    const folderRule = {
      ...validRule,
      scope: "folder" as const,
      sourcePath: "Clippings"
    };

    expect(resolveCleanupRule(document, folderRule)).toBeNull();
  });

  it("never resolves protected document roots", () => {
    const bodyRule = {
      ...validRule,
      selector: "body",
      fingerprint: { ...validRule.fingerprint, tag: "body" }
    };

    expect(resolveCleanupRule(document, bodyRule)).toBeNull();
  });

  it("scores semantic matches above unrelated elements", () => {
    document.body.innerHTML = `
      <aside id="match" class="sidebar" aria-label="Related content">Related articles</aside>
      <aside id="other">Account settings</aside>`;
    const match = document.querySelector("#match");
    const other = document.querySelector("#other");

    expect(match && other).toBeTruthy();
    expect(scoreFingerprint(match!, validRule.fingerprint)).toBeGreaterThan(
      scoreFingerprint(other!, validRule.fingerprint)
    );
  });

  it("bounds fallback candidate scanning", () => {
    document.body.innerHTML = `${"<aside>noise</aside>".repeat(500)}
      <aside aria-label="Related content">Related articles</aside>`;
    const changedRule = { ...validRule, selector: "aside.no-longer-present" };

    expect(resolveCleanupRule(document, changedRule)).toBeNull();
  });
});
