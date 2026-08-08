import { describe, expect, it } from "vitest";

import {
  isSupportedCleanupSelector,
  parseCleanupCandidate,
  parseCleanupDocument
} from "../src/cleanup/rule-validation";
import { validCandidate, validRule } from "./fixtures/cleanup-rules";

describe("cleanup rule validation", () => {
  it("accepts a bounded cleanup candidate", () => {
    expect(parseCleanupCandidate(validCandidate)).toEqual(validCandidate);
  });

  it.each([
    "",
    "body",
    "html",
    "aside, footer",
    "aside { display: none }",
    "aside:not(.keep)",
    "aside:nth-child(2)",
    `aside.${"x".repeat(510)}`
  ])("rejects unsupported selector %s", (selector) => {
    expect(isSupportedCleanupSelector(selector)).toBe(false);
    expect(parseCleanupCandidate({ ...validCandidate, selector })).toBeNull();
  });

  it("accepts a bounded structural selector", () => {
    expect(
      isSupportedCleanupSelector(
        "main.layout > aside.sidebar:nth-of-type(2) [aria-label=\"Links\"]"
      )
    ).toBe(true);
  });

  it("rejects oversized and malformed fingerprints", () => {
    expect(
      parseCleanupCandidate({
        ...validCandidate,
        fingerprint: { ...validCandidate.fingerprint, text: "x".repeat(161) }
      })
    ).toBeNull();
    expect(
      parseCleanupCandidate({
        ...validCandidate,
        fingerprint: {
          ...validCandidate.fingerprint,
          ancestors: Array.from({ length: 6 }, () => ({ tag: "div", classes: [] }))
        }
      })
    ).toBeNull();
    expect(
      parseCleanupCandidate({
        ...validCandidate,
        fingerprint: { ...validCandidate.fingerprint, tag: "BODY" }
      })
    ).toBeNull();
  });

  it("accepts a versioned cleanup document", () => {
    expect(parseCleanupDocument({ version: 1, rules: [validRule] })).toEqual({
      version: 1,
      rules: [validRule]
    });
  });

  it("rejects invalid IDs, paths, scopes, dates, and schema versions", () => {
    const invalidRules = [
      { ...validRule, id: "short" },
      { ...validRule, sourcePath: "../outside.html" },
      { ...validRule, sourcePath: "folder\\page.html" },
      { ...validRule, scope: "vault" },
      { ...validRule, createdAt: "not-a-date" }
    ];

    for (const rule of invalidRules) {
      expect(parseCleanupDocument({ version: 1, rules: [rule] })).toBeNull();
    }
    expect(parseCleanupDocument({ version: 2, rules: [] })).toBeNull();
  });
});
