import { isSupportedCleanupSelector } from "./rule-validation";
import type { CleanupRule, ElementFingerprint } from "./types";

const PROTECTED_TAGS = new Set(["html", "head", "body"]);
const MAX_FALLBACK_CANDIDATES = 500;

function normalizeText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
}
function classOverlap(actual: DOMTokenList, expected: readonly string[]): number {
  if (expected.length === 0) {
    return 0;
  }
  let matches = 0;
  for (const className of expected) {
    if (actual.contains(className)) {
      matches += 1;
    }
  }
  return matches / expected.length;
}

export function isGeneratedElementId(id: string): boolean {
  return (
    /^[:].*[:]$/.test(id) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ||
    /^(react|ember|vue|headlessui|radix)[-_:]?[a-z]*\d{3,}$/i.test(id) ||
    /^[0-9a-f]{16,}$/i.test(id)
  );
}

export function scoreFingerprint(
  element: Element,
  fingerprint: ElementFingerprint
): number {
  if (element.tagName.toLowerCase() !== fingerprint.tag) {
    return -1;
  }

  let score = 0.2;
  if (fingerprint.id) {
    score += element.id === fingerprint.id ? 0.25 : -0.1;
  }

  const attributeEntries = Object.entries(fingerprint.attributes);
  if (attributeEntries.length > 0) {
    const matches = attributeEntries.filter(
      ([name, value]) => element.getAttribute(name) === value
    ).length;
    score += 0.2 * (matches / attributeEntries.length);
  }
  score += 0.15 * classOverlap(element.classList, fingerprint.classes);

  const actualText = normalizeText(element.textContent);
  if (fingerprint.text.length > 0) {
    if (actualText === fingerprint.text) {
      score += 0.25;
    } else if (
      actualText.includes(fingerprint.text) ||
      fingerprint.text.includes(actualText)
    ) {
      score += 0.15;
    }
  }

  let ancestor = element.parentElement;
  for (const expected of fingerprint.ancestors) {
    if (!ancestor) {
      break;
    }
    if (ancestor.tagName.toLowerCase() === expected.tag) {
      score += 0.05;
      score += 0.03 * classOverlap(ancestor.classList, expected.classes);
      if (expected.id && ancestor.id === expected.id) {
        score += 0.04;
      }
    }
    ancestor = ancestor.parentElement;
  }
  return Math.min(score, 1);
}

function chooseMatch(
  candidates: readonly Element[],
  fingerprint: ElementFingerprint,
  threshold: number
): Element | null {
  const scored = candidates
    .map((element) => ({ element, score: scoreFingerprint(element, fingerprint) }))
    .filter(({ score }) => score >= threshold)
    .sort((left, right) => right.score - left.score);
  const first = scored[0];
  if (!first) {
    return null;
  }
  const second = scored[1];
  if (second && first.score - second.score < 0.12) {
    return null;
  }
  return first.element;
}

export function resolveCleanupRule(
  document: Document,
  rule: CleanupRule
): Element | null {
  if (
    PROTECTED_TAGS.has(rule.fingerprint.tag) ||
    !isSupportedCleanupSelector(rule.selector)
  ) {
    return null;
  }

  let direct: Element[] = [];
  try {
    direct = [...document.querySelectorAll(rule.selector)].slice(0, 100);
  } catch {
    return null;
  }
  const directMatch = chooseMatch(
    direct,
    rule.fingerprint,
    rule.scope === "folder" ? 0.7 : 0.45
  );
  if (directMatch) {
    return directMatch;
  }

  const fallback = [...document.querySelectorAll(rule.fingerprint.tag)].slice(
    0,
    MAX_FALLBACK_CANDIDATES
  );
  return chooseMatch(
    fallback,
    rule.fingerprint,
    rule.scope === "folder" ? 0.75 : 0.62
  );
}
