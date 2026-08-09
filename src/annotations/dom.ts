import {
  annotationDisplayColor,
  type HtmlAnnotation,
  type HtmlAnnotationTarget
} from "./types";

export interface AnnotationSelection {
  quote: string;
  target: HtmlAnnotationTarget;
}

function textNodes(root: HTMLElement): Text[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent || node.textContent.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    nodes.push(current as Text);
  }
  return nodes;
}

function visibleText(root: HTMLElement): string {
  return textNodes(root).map((node) => node.textContent ?? "").join("");
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedText(value: string): {
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

function matchingContext(left: string, right: string, fromEnd: boolean): number {
  const limit = Math.min(left.length, right.length);
  let matched = 0;
  for (let length = 1; length <= limit; length += 1) {
    const leftPart = fromEnd ? left.slice(-length) : left.slice(0, length);
    const rightPart = fromEnd ? right.slice(-length) : right.slice(0, length);
    if (leftPart === rightPart) matched = length;
  }
  return matched;
}

function targetContextScore(
  fullText: string,
  start: number,
  end: number,
  target: HtmlAnnotationTarget
): number {
  const prefix = normalize(fullText.slice(Math.max(0, start - 96), start));
  const suffix = normalize(fullText.slice(end, Math.min(fullText.length, end + 96)));
  return matchingContext(prefix, normalize(target.prefix ?? ""), true) +
    matchingContext(suffix, normalize(target.suffix ?? ""), false);
}

function hasContext(target: HtmlAnnotationTarget): boolean {
  return normalize(target.prefix ?? "").length > 0 ||
    normalize(target.suffix ?? "").length > 0;
}

export function resolveAnnotationTarget(
  fullText: string,
  target: HtmlAnnotationTarget
): HtmlAnnotationTarget | null {
  const exact = normalize(target.exact ?? "");
  if (!exact) return null;
  if (target.start >= 0 && target.end >= target.start && target.end <= fullText.length &&
    normalize(fullText.slice(target.start, target.end)) === exact) {
    const contextLength = normalize(target.prefix ?? "").length +
      normalize(target.suffix ?? "").length;
    if (hasContext(target) && targetContextScore(fullText, target.start, target.end, target) === contextLength) {
      return {
        ...target,
        prefix: fullText.slice(Math.max(0, target.start - 24), target.start),
        suffix: fullText.slice(target.end, Math.min(fullText.length, target.end + 24))
      };
    }
  }

  const model = normalizedText(fullText);
  const candidates: Array<{ end: number; score: number; start: number }> = [];
  let normalizedStart = model.text.indexOf(exact);
  while (normalizedStart >= 0) {
    const normalizedEnd = normalizedStart + exact.length;
    const start = model.starts[normalizedStart];
    const end = model.ends[normalizedEnd - 1];
    if (typeof start === "number" && typeof end === "number") {
      candidates.push({
        end,
        score: targetContextScore(fullText, start, end, target),
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
  if (!best) return null;
  if (second && best.score === second.score) {
    return null;
  }
  return {
    end: best.end,
    exact: target.exact,
    prefix: fullText.slice(Math.max(0, best.start - 24), best.start),
    start: best.start,
    suffix: fullText.slice(best.end, Math.min(fullText.length, best.end + 24))
  };
}

function isInside(root: HTMLElement, node: Node): boolean {
  return node === root || root.contains(node);
}

function positionOf(root: HTMLElement, container: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

export function captureAnnotationSelection(
  root: HTMLElement,
  selection: Selection | null = window.getSelection()
): AnnotationSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (
    !isInside(root, range.startContainer) ||
    !isInside(root, range.endContainer)
  ) {
    return null;
  }

  const quote = range.toString().replace(/\s+/g, " ").trim();
  if (!quote) {
    return null;
  }
  const start = positionOf(root, range.startContainer, range.startOffset);
  const end = positionOf(root, range.endContainer, range.endOffset);
  const fullText = root.textContent ?? "";
  return {
    quote,
    target: {
      end,
      exact: quote,
      prefix: fullText.slice(Math.max(0, start - 24), start),
      start,
      suffix: fullText.slice(end, Math.min(fullText.length, end + 24))
    }
  };
}

export function applyAnnotationHighlights(
  root: HTMLElement,
  annotations: readonly HtmlAnnotation[]
): HtmlAnnotation[] {
  const nodes = textNodes(root);
  const fullText = visibleText(root);
  const resolvedAnnotations = annotations
    .map((annotation) => {
      const target = resolveAnnotationTarget(fullText, annotation.target);
      return target ? { ...annotation, target } : null;
    })
    .filter((annotation): annotation is HtmlAnnotation => annotation !== null);
  let absoluteStart = 0;
  for (const node of nodes) {
    const length = node.textContent?.length ?? 0;
    const absoluteEnd = absoluteStart + length;
    const segments = resolvedAnnotations
      .map((annotation) => ({
        annotation,
        end: Math.min(length, annotation.target.end - absoluteStart),
        start: Math.max(0, annotation.target.start - absoluteStart)
      }))
      .filter(
        ({ annotation, end, start }) =>
          annotation.target.start < absoluteEnd &&
          annotation.target.end > absoluteStart &&
          start < end
      )
      .sort((left, right) => right.start - left.start);

    let nextBoundary = length;
    for (const segment of segments) {
      if (segment.end > nextBoundary) {
        continue;
      }
      let selected = node;
      if (segment.end < (selected.textContent?.length ?? 0)) {
        selected.splitText(segment.end);
      }
      if (segment.start > 0) {
        selected = selected.splitText(segment.start);
      }
      const mark = root.ownerDocument.createElement("mark");
      mark.dataset.obsidianHtmlPreviewAnnotation = segment.annotation.id;
      mark.dataset.annotationColor = annotationDisplayColor(segment.annotation);
      mark.title = segment.annotation.comment;
      selected.parentNode?.replaceChild(mark, selected);
      mark.append(selected);
      nextBoundary = segment.start;
    }
    absoluteStart = absoluteEnd;
  }
  return resolvedAnnotations;
}

export function clearAnnotationHighlights(root: HTMLElement): void {
  for (const mark of root.querySelectorAll("mark[data-obsidian-html-preview-annotation]")) {
    mark.replaceWith(...Array.from(mark.childNodes));
  }
  root.normalize();
}

export function annotationFromMark(
  root: HTMLElement,
  target: EventTarget | null
): string | null {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  const mark = element?.closest<HTMLElement>(
    "mark[data-obsidian-html-preview-annotation]"
  );
  return mark && root.contains(mark)
    ? mark.dataset.obsidianHtmlPreviewAnnotation ?? null
    : null;
}

export function focusAnnotationMark(root: HTMLElement, id: string): boolean {
  const mark = [...root.querySelectorAll<HTMLElement>(
    "mark[data-obsidian-html-preview-annotation]"
  )].find((candidate) => candidate.dataset.obsidianHtmlPreviewAnnotation === id);
  if (!mark) return false;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("is-annotation-focus");
  window.setTimeout(() => mark.classList.remove("is-annotation-focus"), 1_200);
  return true;
}
