import type { HtmlAnnotation } from "./types";

export const ANNOTATION_SAVE_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-save" as const;
export const ANNOTATION_DELETE_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-delete" as const;
export const ANNOTATION_RESULT_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-result" as const;
export const ANNOTATION_FOCUS_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-focus" as const;
export const ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE =
  "obsidian-html-preview:annotation-focus-result" as const;

export function createAnnotationRuntimeScript(
  renderId: string,
  annotations: readonly HtmlAnnotation[] = []
): string {
  const styleText = `
    body, body * { -webkit-user-select: text !important; user-select: text !important; }
    mark[data-obsidian-html-preview-annotation] { color: inherit !important; padding: 0 .08em !important; border-radius: 2px !important; cursor: pointer !important; }
    mark[data-annotation-color="yellow"] { background: rgba(238,199,92,.42) !important; }
    mark[data-annotation-color="green"] { background: rgba(104,184,126,.34) !important; }
    mark[data-annotation-color="blue"] { background: rgba(91,158,204,.34) !important; }
    mark[data-annotation-color="pink"] { background: rgba(213,111,137,.31) !important; }
    mark[data-annotation-color="violet"] { background: rgba(146,112,193,.31) !important; }
    mark.is-annotation-focus { box-shadow: 0 0 0 3px Canvas, 0 0 0 5px Highlight !important; }
    .obsidian-html-preview-annotation-ui, .obsidian-html-preview-annotation-ui * { box-sizing: border-box !important; -webkit-user-select: none !important; user-select: none !important; letter-spacing: 0 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
    .obsidian-html-preview-annotation-ui { position: fixed !important; z-index: 2147483646 !important; border: 1px solid rgba(120,124,118,.38) !important; border-radius: 8px !important; color: #252824 !important; background: #fff !important; box-shadow: 0 16px 38px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1) !important; }
    .annotation-selection-toolbar { display: flex !important; gap: 3px !important; align-items: center !important; min-height: 38px !important; padding: 4px !important; }
    .annotation-toolbar-button { height: 30px !important; padding: 0 10px !important; border: 0 !important; border-radius: 5px !important; color: #252824 !important; background: transparent !important; font-size: 12px !important; font-weight: 600 !important; }
    .annotation-toolbar-button:hover { background: #f0f1ee !important; }
    .annotation-color-palette { display: flex !important; gap: 8px !important; align-items: center !important; padding: 0 14px 12px !important; }
    .annotation-toolbar-palette { padding: 0 4px 0 10px !important; border-left: 1px solid #d9dcd5 !important; }
    .annotation-color-swatch { width: 22px !important; height: 22px !important; padding: 0 !important; border: 2px solid #fff !important; border-radius: 50% !important; outline: 1px solid #c8cbc5 !important; }
    .annotation-color-swatch[data-color="yellow"] { background: #e9c65d !important; }
    .annotation-color-swatch[data-color="green"] { background: #74b985 !important; }
    .annotation-color-swatch[data-color="blue"] { background: #6aa6cb !important; }
    .annotation-color-swatch[data-color="pink"] { background: #d77f97 !important; }
    .annotation-color-swatch[data-color="violet"] { background: #9980c2 !important; }
    .annotation-color-swatch[aria-pressed="true"] { outline: 2px solid #252824 !important; outline-offset: 1px !important; }
    .annotation-editor { width: min(360px, calc(100vw - 16px)) !important; overflow: hidden !important; }
    .annotation-editor-header, .annotation-editor-actions, .annotation-editor-commands { display: flex !important; align-items: center !important; }
    .annotation-editor-header { justify-content: space-between !important; min-height: 44px !important; padding: 8px 10px 6px 14px !important; font-size: 12px !important; }
    .annotation-editor-close { display: grid !important; place-items: center !important; width: 28px !important; height: 28px !important; padding: 0 !important; border: 0 !important; border-radius: 5px !important; color: #71766f !important; background: transparent !important; font-size: 19px !important; }
    .annotation-editor-quote { display: -webkit-box !important; overflow: hidden !important; margin: 0 14px 12px !important; padding: 1px 0 1px 10px !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; border-left: 3px solid rgba(238,199,92,.72) !important; color: #666b65 !important; font-family: Georgia, serif !important; font-size: 12px !important; font-style: normal !important; line-height: 1.55 !important; }
    .annotation-editor-comment { display: block !important; width: calc(100% - 28px) !important; min-height: 92px !important; margin: 0 14px !important; resize: vertical !important; border: 1px solid #d9dcd5 !important; border-radius: 6px !important; color: #252824 !important; background: #fafaf8 !important; padding: 10px 11px !important; font-size: 13px !important; line-height: 1.55 !important; }
    .annotation-editor-actions { justify-content: space-between !important; gap: 10px !important; padding: 12px 14px 14px !important; }
    .annotation-editor-commands { gap: 7px !important; margin-left: auto !important; }
    .annotation-editor-delete, .annotation-editor-secondary, .annotation-editor-primary { min-height: 30px !important; padding: 5px 10px !important; border-radius: 5px !important; font-size: 12px !important; font-weight: 600 !important; }
    .annotation-editor-delete { padding-inline: 2px !important; border: 0 !important; color: #a45151 !important; background: transparent !important; }
    .annotation-editor-secondary { border: 1px solid #c9ccc6 !important; color: #252824 !important; background: #fff !important; }
    .annotation-editor-primary { border: 1px solid #486b59 !important; color: #fff !important; background: #486b59 !important; }
    @media (prefers-color-scheme: dark) { .obsidian-html-preview-annotation-ui { border-color: #555b55 !important; color: #eceeeb !important; background: #272a27 !important; } .annotation-toolbar-button, .annotation-editor-comment, .annotation-editor-secondary { color: #eceeeb !important; } .annotation-toolbar-button:hover { background: #393d39 !important; } .annotation-color-swatch { border-color: #272a27 !important; } .annotation-editor-comment { border-color: #555b55 !important; background: #202220 !important; } .annotation-editor-secondary { border-color: #555b55 !important; background: #272a27 !important; } }
    @media (max-width: 640px) { .annotation-editor { top: auto !important; right: 8px !important; bottom: 8px !important; left: 8px !important; width: auto !important; } }
  `;

  return `(() => {
    const renderId = ${JSON.stringify(renderId)};
    const initialAnnotations = ${JSON.stringify(annotations)};
    const saveType = ${JSON.stringify(ANNOTATION_SAVE_MESSAGE_TYPE)};
    const deleteType = ${JSON.stringify(ANNOTATION_DELETE_MESSAGE_TYPE)};
    const resultType = ${JSON.stringify(ANNOTATION_RESULT_MESSAGE_TYPE)};
    const focusType = ${JSON.stringify(ANNOTATION_FOCUS_MESSAGE_TYPE)};
    const focusResultType = ${JSON.stringify(ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE)};
    const colors = ["yellow", "green", "blue", "pink", "violet"];
    const labels = { yellow: "黄色", green: "绿色", blue: "蓝色", pink: "粉色", violet: "紫色" };
    const annotationById = new Map();
    const pending = new Map();
    let surface = null;
    let requestSequence = 0;
    let lastColor = "yellow";

    const style = document.createElement("style");
    style.dataset.htmlPreviewAnnotations = "true";
    style.textContent = ${JSON.stringify(styleText)};
    document.head.append(style);

    const textNodes = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent || node.textContent.length === 0) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest("script, style, .obsidian-html-preview-annotation-ui")) return NodeFilter.FILTER_REJECT;
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
        const length = node.textContent ? node.textContent.length : 0;
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

    const markElements = (id) => Array.from(document.querySelectorAll("mark[data-obsidian-html-preview-annotation]"))
      .filter((mark) => mark.dataset.obsidianHtmlPreviewAnnotation === id);

    const styleMarks = (annotation) => {
      for (const mark of markElements(annotation.id)) {
        mark.dataset.annotationColor = annotation.color || "yellow";
        mark.title = annotation.comment || "";
      }
    };

    const wrapRange = (range, annotation) => {
      const nodes = textNodes().filter((node) => {
        if (node.parentElement && node.parentElement.closest("mark[data-obsidian-html-preview-annotation]")) return false;
        const probe = document.createRange();
        probe.selectNodeContents(node);
        return range.compareBoundaryPoints(Range.END_TO_START, probe) < 0 &&
          range.compareBoundaryPoints(Range.START_TO_END, probe) > 0;
      });
      for (const original of nodes) {
        let node = original;
        const start = original === range.startContainer ? range.startOffset : 0;
        const end = original === range.endContainer ? range.endOffset : (original.textContent ? original.textContent.length : 0);
        if (start >= end) continue;
        if (start > 0) node = node.splitText(start);
        const length = end - start;
        if ((node.textContent ? node.textContent.length : 0) > length) node.splitText(length);
        const mark = document.createElement("mark");
        mark.dataset.obsidianHtmlPreviewAnnotation = annotation.id;
        node.parentNode.replaceChild(mark, node);
        mark.append(node);
      }
      styleMarks(annotation);
    };

    const applyAnnotation = (annotation) => {
      annotation.color = colors.includes(annotation.color) ? annotation.color : "yellow";
      annotationById.set(annotation.id, annotation);
      if (markElements(annotation.id).length > 0) {
        styleMarks(annotation);
        return true;
      }
      const range = rangeFromOffsets(annotation.target.start, annotation.target.end);
      if (!range) return false;
      wrapRange(range, annotation);
      return true;
    };

    for (const annotation of initialAnnotations) applyAnnotation(annotation);

    const removeAnnotation = (id) => {
      for (const mark of markElements(id)) mark.replaceWith(...Array.from(mark.childNodes));
      document.body.normalize();
      annotationById.delete(id);
    };

    const closeSurface = () => {
      if (surface) surface.remove();
      surface = null;
    };

    const button = (text, className) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = className;
      element.textContent = text;
      return element;
    };

    const place = (element, anchor) => {
      const inset = 8;
      const gap = 10;
      const bounds = element.getBoundingClientRect();
      const width = bounds.width || (element.classList.contains("annotation-editor") ? 360 : 150);
      const height = bounds.height || (element.classList.contains("annotation-editor") ? 280 : 42);
      const left = Math.max(inset, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - inset));
      const below = anchor.bottom + gap;
      const top = below + height <= window.innerHeight - inset ? below : Math.max(inset, anchor.top - height - gap);
      element.style.left = Math.round(left) + "px";
      element.style.top = Math.round(top) + "px";
    };

    const mount = (element, anchor) => {
      closeSurface();
      surface = element;
      element.classList.add("obsidian-html-preview-annotation-ui");
      element.addEventListener("mousedown", (event) => event.preventDefault());
      document.body.append(element);
      place(element, anchor);
    };

    const palette = (selected, onSelect) => {
      const element = document.createElement("div");
      element.className = "annotation-color-palette";
      element.setAttribute("aria-label", "高亮颜色");
      for (const color of colors) {
        const swatch = button("", "annotation-color-swatch");
        swatch.dataset.color = color;
        swatch.setAttribute("aria-label", labels[color]);
        swatch.setAttribute("aria-pressed", color === selected ? "true" : "false");
        swatch.addEventListener("click", () => {
          for (const item of element.querySelectorAll("[data-color]")) item.setAttribute("aria-pressed", item.dataset.color === color ? "true" : "false");
          onSelect(color);
        });
        element.append(swatch);
      }
      return element;
    };

    const send = (type, payload, operation) => {
      const requestId = "annotation-" + Date.now().toString(36) + "-" + (++requestSequence).toString(36);
      pending.set(requestId, operation);
      window.parent.postMessage(Object.assign({ renderId, requestId, type }, payload), "*");
    };

    const showEditor = (draft, anchor, existing) => {
      const editor = document.createElement("div");
      editor.className = "annotation-editor";
      editor.setAttribute("role", "dialog");
      editor.setAttribute("aria-label", existing ? "编辑注释" : "添加注释");
      const header = document.createElement("div");
      header.className = "annotation-editor-header";
      const title = document.createElement("strong");
      title.textContent = existing ? "编辑注释" : "添加注释";
      const close = button("×", "annotation-editor-close");
      close.setAttribute("aria-label", "关闭");
      close.addEventListener("click", closeSurface);
      header.append(title, close);
      const quote = document.createElement("blockquote");
      quote.className = "annotation-editor-quote";
      quote.textContent = "“" + draft.quote + "”";
      const colorsElement = palette(draft.color, (color) => { draft.color = color; });
      const textarea = document.createElement("textarea");
      textarea.className = "annotation-editor-comment";
      textarea.placeholder = "写下你的想法…";
      textarea.setAttribute("aria-label", "注释内容");
      textarea.value = draft.comment || "";
      const actions = document.createElement("div");
      actions.className = "annotation-editor-actions";
      if (existing) {
        const remove = button("删除高亮", "annotation-editor-delete");
        remove.addEventListener("click", () => send(deleteType, { annotationId: existing.id }, { kind: "delete", annotation: existing }));
        actions.append(remove);
      } else {
        actions.append(document.createElement("span"));
      }
      const commands = document.createElement("div");
      commands.className = "annotation-editor-commands";
      const save = (comment) => send(saveType, { annotation: Object.assign({}, draft, { comment }) }, { kind: "save", draft });
      if (!existing) {
        const highlight = button("仅高亮", "annotation-editor-secondary");
        highlight.addEventListener("click", () => save(""));
        commands.append(highlight);
      }
      const submit = button(existing ? "保存修改" : "保存批注", "annotation-editor-primary");
      submit.addEventListener("click", () => save(textarea.value.trim()));
      commands.append(submit);
      actions.append(commands);
      editor.append(header, quote, colorsElement, textarea, actions);
      editor.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); closeSurface(); }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save(textarea.value.trim()); }
      });
      mount(editor, anchor);
      textarea.focus();
    };

    const bodyPosition = (container, offset) => {
      const range = document.createRange();
      range.setStart(document.body, 0);
      range.setEnd(container, offset);
      return range.toString().length;
    };

    const captureSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      if (!document.body.contains(range.startContainer) || !document.body.contains(range.endContainer)) return null;
      const exact = range.toString().replace(/\\s+/g, " ").trim();
      if (!exact) return null;
      const start = bodyPosition(range.startContainer, range.startOffset);
      const end = bodyPosition(range.endContainer, range.endOffset);
      const fullText = document.body.textContent || "";
      return {
        anchor: range.getBoundingClientRect ? range.getBoundingClientRect() : new DOMRect(),
        draft: {
          color: "yellow",
          comment: "",
          quote: exact,
          target: {
            end,
            exact,
            prefix: fullText.slice(Math.max(0, start - 24), start),
            start,
            suffix: fullText.slice(end, Math.min(fullText.length, end + 24))
          }
        }
      };
    };

    const showToolbar = (captured) => {
      const toolbar = document.createElement("div");
      toolbar.className = "annotation-selection-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "选中文字操作");
      const color = button("颜色", "annotation-toolbar-button");
      const comment = button("注释", "annotation-toolbar-button");
      color.addEventListener("click", () => {
        const existing = toolbar.querySelector(".annotation-toolbar-palette");
        if (existing) { existing.remove(); return; }
        const colorsElement = palette(lastColor, (selected) => {
          lastColor = selected;
          send(saveType, { annotation: Object.assign({}, captured.draft, { color: selected, comment: "" }) }, { kind: "save", draft: captured.draft });
        });
        colorsElement.classList.add("annotation-toolbar-palette");
        toolbar.append(colorsElement);
        place(toolbar, captured.anchor);
      });
      comment.addEventListener("click", () => showEditor(Object.assign({}, captured.draft, { color: "yellow" }), captured.anchor, null));
      toolbar.append(color, comment);
      mount(toolbar, captured.anchor);
    };

    document.addEventListener("mouseup", (event) => {
      if (event.target instanceof Element && event.target.closest(".obsidian-html-preview-annotation-ui")) return;
      const captured = captureSelection();
      if (captured) showToolbar(captured);
    });

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || event.target.closest(".obsidian-html-preview-annotation-ui")) return;
      const mark = event.target.closest("mark[data-obsidian-html-preview-annotation]");
      if (!mark) return;
      const annotation = annotationById.get(mark.dataset.obsidianHtmlPreviewAnnotation);
      if (annotation) showEditor(Object.assign({}, annotation), mark.getBoundingClientRect(), annotation);
    });

    window.addEventListener("message", (event) => {
      if (event.source && event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.renderId !== renderId) return;
      if (data.type === resultType) {
        const operation = pending.get(data.requestId);
        if (!operation) return;
        pending.delete(data.requestId);
        if (!data.ok) return;
        if (operation.kind === "delete") removeAnnotation(operation.annotation.id);
        if (operation.kind === "save" && data.annotation) applyAnnotation(data.annotation);
        closeSurface();
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (data.type !== focusType || typeof data.annotationId !== "string") return;
      const mark = markElements(data.annotationId)[0];
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        mark.classList.add("is-annotation-focus");
        window.setTimeout(() => mark.classList.remove("is-annotation-focus"), 1200);
      }
      window.parent.postMessage({ found: Boolean(mark), renderId, requestId: data.requestId, type: focusResultType }, "*");
    });
  })();`;
}
