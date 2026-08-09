import type { HtmlAnnotationTarget } from "./types";

export interface AnnotationOffsets {
  end: number;
  start: number;
}

function normalizeAnnotationText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createNormalizedText(value: string): {
  ends: number[];
  starts: number[];
  text: string;
} {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  while (index < value.length) {
    if (!/\s/.test(value[index] ?? "")) {
      text += value[index];
      starts.push(index);
      ends.push(index + 1);
      index += 1;
      continue;
    }
    const start = index;
    while (index < value.length && /\s/.test(value[index] ?? "")) index += 1;
    if (text.length > 0 && index < value.length) {
      text += " ";
      starts.push(start);
      ends.push(index);
    }
  }
  return { ends, starts, text };
}

function matchingAnnotationContext(
  left: string,
  right: string,
  fromEnd: boolean
): number {
  const limit = Math.min(left.length, right.length);
  let matched = 0;
  for (let length = 1; length <= limit; length += 1) {
    const leftPart = fromEnd ? left.slice(-length) : left.slice(0, length);
    const rightPart = fromEnd ? right.slice(-length) : right.slice(0, length);
    if (leftPart === rightPart) matched = length;
  }
  return matched;
}

function annotationContextScore(
  fullText: string,
  start: number,
  end: number,
  target: HtmlAnnotationTarget
): number {
  const prefix = normalizeAnnotationText(fullText.slice(Math.max(0, start - 96), start));
  const suffix = normalizeAnnotationText(fullText.slice(end, Math.min(fullText.length, end + 96)));
  return matchingAnnotationContext(
    prefix,
    normalizeAnnotationText(target.prefix ?? ""),
    true
  ) + matchingAnnotationContext(
    suffix,
    normalizeAnnotationText(target.suffix ?? ""),
    false
  );
}

export function resolveAnnotationOffsets(
  fullText: string,
  target: HtmlAnnotationTarget
): AnnotationOffsets | null {
  const exact = normalizeAnnotationText(target.exact ?? "");
  if (!exact) return null;
  const contextLength = normalizeAnnotationText(target.prefix ?? "").length +
    normalizeAnnotationText(target.suffix ?? "").length;
  if (contextLength > 0 && target.start >= 0 && target.end >= target.start &&
    target.end <= fullText.length &&
    normalizeAnnotationText(fullText.slice(target.start, target.end)) === exact &&
    annotationContextScore(fullText, target.start, target.end, target) === contextLength) {
    return { end: target.end, start: target.start };
  }

  const model = createNormalizedText(fullText);
  const candidates: Array<AnnotationOffsets & { score: number }> = [];
  let normalizedStart = model.text.indexOf(exact);
  while (normalizedStart >= 0) {
    const normalizedEnd = normalizedStart + exact.length;
    const start = model.starts[normalizedStart];
    const end = model.ends[normalizedEnd - 1];
    if (typeof start === "number" && typeof end === "number") {
      candidates.push({
        end,
        score: annotationContextScore(fullText, start, end, target),
        start
      });
    }
    normalizedStart = model.text.indexOf(exact, normalizedStart + 1);
  }
  candidates.sort((left, right) =>
    right.score - left.score ||
    Math.abs(left.start - target.start) - Math.abs(right.start - target.start)
  );
  const best = candidates[0];
  const second = candidates[1];
  if (!best || second && best.score === second.score) return null;
  return { end: best.end, start: best.start };
}

export function createAnnotationLocatorRuntimeSource(): string {
  return [
    `const normalizeAnnotationText = ${normalizeAnnotationText.toString()};`,
    `const createNormalizedText = ${createNormalizedText.toString()};`,
    `const matchingAnnotationContext = ${matchingAnnotationContext.toString()};`,
    `const annotationContextScore = ${annotationContextScore.toString()};`,
    `const resolveAnnotationOffsets = ${resolveAnnotationOffsets.toString()};`
  ].join("\n");
}
