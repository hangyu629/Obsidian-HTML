import type { HtmlAnnotation } from "./types";

export const ANNOTATION_MODE_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-mode" as const;
export const ANNOTATION_SELECTED_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-selected" as const;

export function createAnnotationRuntimeScript(
  renderId: string,
  annotations: readonly HtmlAnnotation[] = []
): string {
  return `(() => {
    const renderId = ${JSON.stringify(renderId)};
    const annotations = ${JSON.stringify(annotations)};
    const modeType = ${JSON.stringify(ANNOTATION_MODE_MESSAGE_TYPE)};
    const selectedType = ${JSON.stringify(ANNOTATION_SELECTED_MESSAGE_TYPE)};
    let annotationMode = false;

    const style = document.createElement("style");
    style.dataset.htmlPreviewAnnotations = "true";
    style.textContent = "mark[data-obsidian-html-preview-annotation] { background: rgba(252, 211, 77, .4) !important; color: inherit !important; padding: 0 .08em !important; border-radius: 2px !important; cursor: help !important; } body[data-annotation-mode=\"true\"] { cursor: text !important; }";
    document.head.append(style);

    const textNodes = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent || node.textContent.length === 0) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest("script, style, mark[data-obsidian-html-preview-annotation]")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const nodes = [];
      let current;
      while ((current = walker.nextNode())) nodes.push(current);
      return nodes;
    };

    const resolveOffset = (offset) => {
      let remaining = offset;
      for (const node of textNodes()) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) return { node, offset: remaining };
        remaining -= length;
      }
      return null;
    };

    const rangeFromOffsets = (start, end) => {
      const startPoint = resolveOffset(start);
      const endPoint = resolveOffset(end);
      if (!startPoint || !endPoint) return null;
      const range = document.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      return range;
    };

    const wrapRange = (range, annotation) => {
      const nodes = textNodes().filter((node) => {
        const probe = document.createRange();
        probe.selectNodeContents(node);
        return range.compareBoundaryPoints(Range.END_TO_START, probe) < 0 &&
          range.compareBoundaryPoints(Range.START_TO_END, probe) > 0;
      });
      for (const original of nodes) {
        let node = original;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : (node.textContent?.length ?? 0);
        if (start === end) continue;
        if (start > 0) node = node.splitText(start);
        const length = end - start;
        if ((node.textContent?.length ?? 0) > length) node.splitText(length);
        const mark = document.createElement("mark");
        mark.dataset.obsidianHtmlPreviewAnnotation = annotation.id;
        mark.title = annotation.comment;
        node.parentNode?.replaceChild(mark, node);
        mark.append(node);
      }
    };

    for (const annotation of annotations) {
      const range = rangeFromOffsets(annotation.target.start, annotation.target.end);
      if (range) wrapRange(range, annotation);
    }

    const bodyStart = () => {
      const range = document.createRange();
      range.setStart(document.body, 0);
      return range;
    };

    const positionOf = (container, offset) => {
      const range = bodyStart();
      range.setEnd(container, offset);
      return range.toString().length;
    };

    document.addEventListener("mouseup", () => {
      if (!annotationMode) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const exact = range.toString().replace(/\s+/g, " ").trim();
      if (!exact) return;
      const start = positionOf(range.startContainer, range.startOffset);
      const end = positionOf(range.endContainer, range.endOffset);
      const fullText = document.body.innerText.replace(/\s+/g, " ");
      const prefix = fullText.slice(Math.max(0, start - 24), start);
      const suffix = fullText.slice(end, Math.min(fullText.length, end + 24));
      annotationMode = false;
      document.body.dataset.annotationMode = "false";
      window.parent.postMessage({
        annotation: { quote: exact, target: { start, end, exact, prefix, suffix } },
        renderId,
        type: selectedType
      }, "*");
    });

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.renderId !== renderId || data.type !== modeType) return;
      annotationMode = Boolean(data.enabled);
      document.body.dataset.annotationMode = annotationMode ? "true" : "false";
    });
  })();`;
}
