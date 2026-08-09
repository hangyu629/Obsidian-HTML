import { Readability } from "@mozilla/readability";

import { resolveCleanupRule } from "../cleanup/locator";
import type { CleanupRule } from "../cleanup/types";

export interface ReaderExtractionInput {
  cleanupRules: readonly CleanupRule[];
  source: string;
  sourcePath: string;
}

export interface ReadableArticle {
  byline: string;
  content: string;
  dir: string | null;
  excerpt: string;
  lang: string | null;
  length: number;
  siteName: string;
  textContent: string;
  title: string;
}

export type ReaderExtractionResult =
  | {
      article: ReadableArticle;
      ok: true;
      unmatchedRuleIds: string[];
    }
  | {
      ok: false;
      reason: "no-article" | "too-short";
      unmatchedRuleIds: string[];
    };

export function extractReadableArticle(
  input: ReaderExtractionInput
): ReaderExtractionResult {
  const document = new DOMParser().parseFromString(input.source, "text/html");
  const unmatchedRuleIds: string[] = [];

  for (const rule of input.cleanupRules) {
    const match = resolveCleanupRule(document, rule);
    if (match) {
      match.remove();
    } else {
      unmatchedRuleIds.push(rule.id);
    }
  }

  const parsed = new Readability(document, { charThreshold: 140 }).parse();
  if (!parsed) {
    return { ok: false, reason: "no-article", unmatchedRuleIds };
  }

  const textContent = (parsed.textContent ?? "").replace(/\s+/g, " ").trim();
  if (textContent.length < 20) {
    return { ok: false, reason: "no-article", unmatchedRuleIds };
  }
  if (textContent.length < 120) {
    return { ok: false, reason: "too-short", unmatchedRuleIds };
  }

  return {
    article: {
      byline: parsed.byline ?? "",
      content: parsed.content ?? "",
      dir: parsed.dir ?? null,
      excerpt: parsed.excerpt ?? "",
      lang: parsed.lang ?? null,
      length: textContent.length,
      siteName: parsed.siteName ?? "",
      textContent,
      title: parsed.title?.trim() ?? ""
    },
    ok: true,
    unmatchedRuleIds
  };
}
