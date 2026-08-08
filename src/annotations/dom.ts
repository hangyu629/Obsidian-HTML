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
): void {
  const nodes = textNodes(root);
  let absoluteStart = 0;
  for (const node of nodes) {
    const length = node.textContent?.length ?? 0;
    const absoluteEnd = absoluteStart + length;
    const segments = annotations
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
