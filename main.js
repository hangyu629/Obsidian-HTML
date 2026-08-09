/* HTML Preview for Obsidian */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => HtmlPreviewPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian11 = require("obsidian");

// src/annotations/types.ts
var ANNOTATION_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "violet"
];
function annotationColor(value) {
  return typeof value === "string" && ANNOTATION_COLORS.includes(value) ? value : null;
}
function annotationDisplayColor(annotation) {
  return annotation.color ?? "yellow";
}

// src/annotations/annotation-store.ts
function validateSourcePath(path) {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) {
    throw new Error(`Invalid Vault path: ${path}`);
  }
}
function parentPath(path) {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}
function isAnnotation(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value;
  const target = candidate.target;
  return typeof candidate.id === "string" && typeof candidate.comment === "string" && typeof candidate.quote === "string" && typeof candidate.sourcePath === "string" && (candidate.color === void 0 || annotationColor(candidate.color) !== null) && typeof target === "object" && target !== null && !Array.isArray(target) && typeof target.start === "number" && typeof target.end === "number" && typeof target.exact === "string" && typeof target.prefix === "string" && typeof target.suffix === "string";
}
function parseDocument(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value;
  if (candidate.version !== 1 || !Array.isArray(candidate.annotations)) return null;
  if (!candidate.annotations.every(isAnnotation)) return null;
  return {
    annotations: candidate.annotations.map((annotation) => ({
      ...annotation,
      color: annotation.color ?? "yellow"
    })),
    version: 1
  };
}
function serialize(annotations) {
  return `${JSON.stringify({ annotations: [...annotations], version: 1 }, null, 2)}
`;
}
function annotationPagePath(sourcePath) {
  return `.html-preview/annotations/pages/${sourcePath}.json`;
}
var HtmlAnnotationStore = class {
  constructor(adapter) {
    this.adapter = adapter;
  }
  adapter;
  queue = Promise.resolve();
  async load(sourcePath) {
    validateSourcePath(sourcePath);
    await this.queue;
    return this.read(sourcePath);
  }
  addFileAnnotation(sourcePath, annotation) {
    return this.saveFileAnnotation(sourcePath, annotation);
  }
  saveFileAnnotation(sourcePath, annotation) {
    validateSourcePath(sourcePath);
    return this.mutate(async () => {
      const path = annotationPagePath(sourcePath);
      const annotations = await this.read(sourcePath);
      const next = annotations.filter((item) => item.id !== annotation.id);
      next.push({ ...annotation, sourcePath });
      await this.write(path, next);
    });
  }
  removeAnnotation(annotation) {
    validateSourcePath(annotation.sourcePath);
    return this.mutate(async () => {
      const path = annotationPagePath(annotation.sourcePath);
      const annotations = await this.read(annotation.sourcePath);
      await this.write(
        path,
        annotations.filter((item) => item.id !== annotation.id)
      );
    });
  }
  mutate(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => void 0, () => void 0);
    return result;
  }
  async write(path, annotations) {
    const directory = parentPath(path);
    if (directory) {
      const segments = directory.split("/");
      let current = "";
      for (const segment of segments) {
        current = current ? `${current}/${segment}` : segment;
        if (!await this.adapter.exists(current)) await this.adapter.mkdir(current);
      }
    }
    if (annotations.length === 0) {
      if (await this.adapter.exists(path)) await this.adapter.remove(path);
      return;
    }
    await this.adapter.write(path, serialize(annotations));
  }
  async read(sourcePath) {
    const path = annotationPagePath(sourcePath);
    if (!await this.adapter.exists(path)) return [];
    const parsed = parseDocument(JSON.parse(await this.adapter.read(path)));
    return parsed?.annotations ?? [];
  }
};

// src/annotations/annotation-service.ts
var AnnotationService = class {
  constructor(store) {
    this.store = store;
  }
  store;
  listeners = /* @__PURE__ */ new Map();
  views = /* @__PURE__ */ new Set();
  load(sourcePath) {
    return this.store.load(sourcePath);
  }
  async save(sourcePath, annotation) {
    await this.store.saveFileAnnotation(sourcePath, annotation);
    await this.syncViews(sourcePath, (view) => view.saveAnnotation?.(annotation));
    this.emit(sourcePath);
  }
  async remove(annotation) {
    await this.store.removeAnnotation(annotation);
    await this.syncViews(annotation.sourcePath, (view) => view.removeAnnotation?.(annotation.id));
    this.emit(annotation.sourcePath);
  }
  subscribe(sourcePath, listener) {
    let listeners = this.listeners.get(sourcePath);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      this.listeners.set(sourcePath, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.listeners.delete(sourcePath);
    };
  }
  registerView(view) {
    this.views.add(view);
    return () => this.views.delete(view);
  }
  async focus(sourcePath, id) {
    const candidates = [...this.views].filter((view) => view.sourcePath === sourcePath).reverse();
    for (const view of candidates) {
      if (await view.focusAnnotation(id)) return true;
    }
    return false;
  }
  async beginAnnotationRepair(sourcePath, id) {
    const candidates = [...this.views].filter((view) => view.sourcePath === sourcePath).reverse();
    for (const view of candidates) {
      if (await view.beginAnnotationRepair?.(id)) return true;
    }
    return false;
  }
  emit(sourcePath) {
    for (const listener of this.listeners.get(sourcePath) ?? []) listener();
  }
  async syncViews(sourcePath, callback) {
    for (const view of [...this.views].filter((candidate) => candidate.sourcePath === sourcePath)) {
      await callback(view);
    }
  }
};

// src/annotations/export.ts
function annotationExportPath(sourcePath) {
  return `${sourcePath.replace(/\.(?:html?|md)$/i, "")}.annotations.md`;
}
function quoteBlock(value) {
  return value.split("\n").map((line) => `> ${line}`).join("\n");
}
function exportAnnotationMarkdown(sourcePath, annotations) {
  const lines = [
    "# Annotations",
    "",
    `Source: \`${sourcePath}\``,
    "",
    annotations.length === 0 ? "No annotations were added to this file." : annotations.map((annotation, index) => {
      const comment = annotation.comment.trim() || "No comment.";
      return [
        `## Annotation ${index + 1}`,
        "",
        quoteBlock(annotation.quote),
        "",
        `- Color: ${annotation.color ?? "yellow"}`,
        `- Location: ${annotation.target.start}-${annotation.target.end}`,
        `- ID: \`${annotation.id}\``,
        "",
        "**Comment**",
        "",
        comment
      ].join("\n");
    }).join("\n\n")
  ];
  return `${lines.join("\n")}
`;
}

// src/annotations/search-modal.ts
var import_obsidian = require("obsidian");

// src/annotations/search.ts
var DEFAULT_ANNOTATION_SEARCH_QUERY = {
  color: "all",
  folder: "",
  kind: "all",
  query: ""
};
function filterAnnotations(annotations, query) {
  const needle = query.query.trim().toLocaleLowerCase();
  const folder = query.folder.trim().replace(/\/+$/, "");
  return annotations.filter((annotation) => {
    const hasComment = annotation.comment.trim().length > 0;
    const matchesText = !needle || [
      annotation.comment,
      annotation.quote,
      annotation.sourcePath
    ].some((value) => value.toLocaleLowerCase().includes(needle));
    const matchesFolder = !folder || annotation.sourcePath === folder || annotation.sourcePath.startsWith(`${folder}/`);
    const matchesColor = query.color === "all" || annotation.color === query.color;
    const matchesKind = query.kind === "all" || query.kind === "comments" && hasComment || query.kind === "highlights" && !hasComment;
    return matchesText && matchesFolder && matchesColor && matchesKind;
  });
}

// src/annotations/search-modal.ts
var AnnotationSearchModal = class extends import_obsidian.Modal {
  constructor(app, environment) {
    super(app);
    this.environment = environment;
  }
  environment;
  query = { ...DEFAULT_ANNOTATION_SEARCH_QUERY };
  onOpen() {
    this.titleEl.textContent = "\u641C\u7D22\u5168\u90E8\u6CE8\u91CA";
    this.render();
    void this.refresh();
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
  render(results = []) {
    const root = document.createElement("div");
    root.className = "annotation-search-modal";
    const controls = document.createElement("div");
    controls.className = "annotation-search-controls";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "annotation-search-input";
    input.placeholder = "\u641C\u7D22\u6458\u5F55\u3001\u6279\u6CE8\u6216\u6587\u4EF6";
    input.setAttribute("aria-label", "Search annotations");
    input.value = this.query.query;
    input.addEventListener("input", () => {
      this.query = { ...this.query, query: input.value };
      void this.refresh();
    });
    const folder = document.createElement("input");
    folder.type = "text";
    folder.className = "annotation-search-folder";
    folder.placeholder = "\u6587\u4EF6\u5939\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09";
    folder.setAttribute("aria-label", "Annotation folder");
    folder.value = this.query.folder;
    folder.addEventListener("change", () => {
      this.query = { ...this.query, folder: folder.value };
      void this.refresh();
    });
    const color = document.createElement("select");
    color.setAttribute("aria-label", "Annotation color filter");
    for (const [value, label] of [["all", "\u5168\u90E8\u989C\u8272"], ...ANNOTATION_COLORS.map((value2) => [value2, value2])]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      color.append(option);
    }
    color.value = this.query.color;
    color.addEventListener("change", () => {
      this.query = { ...this.query, color: color.value };
      void this.refresh();
    });
    const kind = document.createElement("select");
    kind.setAttribute("aria-label", "Annotation type filter");
    for (const [value, label] of [["all", "\u5168\u90E8\u7C7B\u578B"], ["comments", "\u6709\u6279\u6CE8"], ["highlights", "\u4EC5\u9AD8\u4EAE"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      kind.append(option);
    }
    kind.value = this.query.kind;
    kind.addEventListener("change", () => {
      this.query = { ...this.query, kind: kind.value };
      void this.refresh();
    });
    controls.append(input, folder, color, kind);
    root.append(controls);
    const list = document.createElement("div");
    list.className = "annotation-search-results";
    if (results.length === 0) {
      const empty = document.createElement("p");
      empty.className = "annotation-search-empty";
      empty.textContent = "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u6CE8\u91CA";
      list.append(empty);
    }
    for (const annotation of results) {
      const result = document.createElement("button");
      result.type = "button";
      result.className = "annotation-search-result";
      result.dataset.annotationColor = annotation.color ?? "yellow";
      const quote = document.createElement("strong");
      quote.textContent = annotation.quote;
      const detail = document.createElement("span");
      detail.textContent = annotation.comment.trim() || "\u4EC5\u9AD8\u4EAE";
      const path = document.createElement("small");
      path.textContent = annotation.sourcePath;
      result.append(quote, detail, path);
      result.addEventListener("click", () => {
        void this.environment.open(annotation.sourcePath, annotation.id).then((opened) => {
          if (opened) this.close();
        });
      });
      list.append(result);
    }
    root.append(list);
    this.contentEl.replaceChildren(root);
  }
  async refresh() {
    try {
      this.render(await this.environment.search(this.query));
    } catch {
      this.render();
    }
  }
};

// src/annotations/sidebar-view.ts
var import_obsidian3 = require("obsidian");

// src/annotations/sidebar-edit-modal.ts
var import_obsidian2 = require("obsidian");
var COLOR_LABELS = {
  blue: "\u84DD\u8272",
  green: "\u7EFF\u8272",
  pink: "\u7C89\u8272",
  violet: "\u7D2B\u8272",
  yellow: "\u9EC4\u8272"
};
var AnnotationSidebarEditModal = class extends import_obsidian2.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  options;
  onOpen() {
    this.titleEl.textContent = "\u7F16\u8F91\u6279\u6CE8";
    this.contentEl.replaceChildren();
    let selectedColor = this.options.annotation.color ?? "yellow";
    const root = document.createElement("div");
    root.className = "annotation-sidebar-modal";
    const meta = document.createElement("p");
    meta.className = "annotation-sidebar-modal-meta";
    meta.textContent = "\u8C03\u6574\u9AD8\u4EAE\u989C\u8272\u548C\u6279\u6CE8\u5185\u5BB9";
    const quote = document.createElement("blockquote");
    quote.className = "annotation-sidebar-modal-quote";
    quote.textContent = `\u201C${this.options.annotation.quote}\u201D`;
    const quoteCard = document.createElement("div");
    quoteCard.className = "annotation-sidebar-modal-quote-card";
    quoteCard.append(quote);
    const colorLabel = document.createElement("label");
    colorLabel.className = "annotation-sidebar-modal-label";
    colorLabel.textContent = "\u989C\u8272";
    const palette = document.createElement("div");
    palette.className = "annotation-sidebar-modal-palette";
    palette.setAttribute("aria-label", "Annotation color");
    for (const value of ANNOTATION_COLORS) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "annotation-sidebar-modal-swatch";
      swatch.dataset.annotationColorChoice = value;
      swatch.dataset.annotationColor = value;
      swatch.setAttribute("aria-label", COLOR_LABELS[value]);
      swatch.setAttribute("aria-pressed", String(value === selectedColor));
      swatch.addEventListener("click", () => {
        selectedColor = value;
        for (const candidate of palette.querySelectorAll("[data-annotation-color-choice]")) {
          candidate.setAttribute(
            "aria-pressed",
            String(candidate.dataset.annotationColorChoice === selectedColor)
          );
        }
      });
      palette.append(swatch);
    }
    const commentLabel = document.createElement("label");
    commentLabel.className = "annotation-sidebar-modal-label";
    commentLabel.textContent = "\u6279\u6CE8";
    const textarea = document.createElement("textarea");
    textarea.className = "annotation-sidebar-modal-textarea";
    textarea.setAttribute("aria-label", "Annotation comment");
    textarea.value = this.options.annotation.comment;
    const actions = document.createElement("div");
    actions.className = "annotation-sidebar-modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "annotation-sidebar-modal-secondary";
    cancel.textContent = "\u53D6\u6D88";
    cancel.addEventListener("click", () => this.close());
    const save = document.createElement("button");
    save.type = "button";
    save.className = "annotation-sidebar-modal-primary";
    save.textContent = "\u4FDD\u5B58";
    save.setAttribute("aria-label", "Save annotation");
    save.addEventListener("click", () => {
      save.disabled = true;
      cancel.disabled = true;
      for (const swatch of palette.querySelectorAll("button")) {
        swatch.disabled = true;
      }
      textarea.disabled = true;
      void this.options.onSave({
        ...this.options.annotation,
        color: selectedColor,
        comment: textarea.value.trim()
      }).then(() => this.close()).catch(() => {
        save.disabled = false;
        cancel.disabled = false;
        for (const swatch of palette.querySelectorAll("button")) {
          swatch.disabled = false;
        }
        textarea.disabled = false;
      });
    });
    actions.append(cancel, save);
    root.append(meta, quoteCard, colorLabel, palette, commentLabel, textarea, actions);
    this.contentEl.append(root);
    textarea.focus();
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
};

// src/annotations/sidebar-view.ts
var ANNOTATION_SIDEBAR_VIEW_TYPE = "html-preview-annotations";
var AnnotationSidebarView = class extends import_obsidian3.ItemView {
  constructor(leaf, environment) {
    super(leaf);
    this.environment = environment;
  }
  environment;
  annotations = [];
  filter = "all";
  sort = "document";
  loadToken = 0;
  sourcePath = null;
  unsubscribe = null;
  getViewType() {
    return ANNOTATION_SIDEBAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u6CE8\u91CA";
  }
  getIcon() {
    return "messages-square";
  }
  onload() {
    this.contentEl.classList.add("annotation-sidebar");
    this.render();
  }
  onunload() {
    this.loadToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }
  async setSource(sourcePath) {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.sourcePath = sourcePath;
    this.filter = "all";
    this.annotations = [];
    const token = ++this.loadToken;
    this.render();
    if (!sourcePath) return;
    this.unsubscribe = this.environment.annotationService.subscribe(
      sourcePath,
      () => {
        void this.refresh();
      }
    );
    try {
      const annotations = await this.environment.annotationService.load(sourcePath);
      if (token !== this.loadToken || this.sourcePath !== sourcePath) return;
      this.annotations = [...annotations].sort(
        (left, right) => left.target.start - right.target.start
      );
      this.render();
    } catch (error) {
      if (token !== this.loadToken) return;
      this.environment.showNotice(
        `\u65E0\u6CD5\u8BFB\u53D6\u6CE8\u91CA\uFF1A${error instanceof Error ? error.message : String(error)}`
      );
      this.render("\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u6587\u4EF6\u7684\u6CE8\u91CA");
    }
  }
  async refresh() {
    const sourcePath = this.sourcePath;
    if (!sourcePath) return;
    const token = ++this.loadToken;
    try {
      const annotations = await this.environment.annotationService.load(sourcePath);
      if (token !== this.loadToken || this.sourcePath !== sourcePath) return;
      this.annotations = [...annotations].sort(
        (left, right) => left.target.start - right.target.start
      );
      this.render();
    } catch (error) {
      if (token !== this.loadToken) return;
      this.environment.showNotice(
        `\u65E0\u6CD5\u5237\u65B0\u6CE8\u91CA\uFF1A${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  render(error) {
    const fragment = document.createDocumentFragment();
    const header = document.createElement("header");
    header.className = "annotation-sidebar-header";
    const title = document.createElement("h2");
    title.textContent = "\u672C\u6587\u6CE8\u91CA";
    const count = document.createElement("span");
    count.className = "annotation-sidebar-count";
    count.textContent = String(this.annotations.length);
    header.append(title, count);
    const search = document.createElement("button");
    search.type = "button";
    search.className = "clickable-icon annotation-sidebar-search";
    search.title = "\u641C\u7D22\u5168\u90E8\u6CE8\u91CA";
    search.setAttribute("aria-label", "Search all annotations");
    (0, import_obsidian3.setIcon)(search, "search");
    search.addEventListener("click", () => this.environment.searchAnnotations());
    header.append(search);
    fragment.append(header);
    if (!this.sourcePath) {
      fragment.append(this.empty("\u6253\u5F00 HTML \u6216 Markdown \u6587\u4EF6\u4EE5\u67E5\u770B\u6CE8\u91CA"));
      this.contentEl.replaceChildren(fragment);
      return;
    }
    const filters = document.createElement("div");
    filters.className = "annotation-sidebar-filters";
    filters.setAttribute("role", "toolbar");
    filters.setAttribute("aria-label", "\u7B5B\u9009\u6CE8\u91CA");
    for (const [value, label] of [
      ["all", "\u5168\u90E8"],
      ["comments", "\u6709\u6279\u6CE8"],
      ["highlights", "\u4EC5\u9AD8\u4EAE"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "annotation-sidebar-filter";
      button.setAttribute("aria-pressed", String(this.filter === value));
      button.addEventListener("click", () => {
        this.filter = value;
        this.render();
      });
      filters.append(button);
    }
    fragment.append(filters);
    const management = document.createElement("div");
    management.className = "annotation-sidebar-management";
    const sort = document.createElement("select");
    sort.className = "annotation-sidebar-sort";
    sort.setAttribute("aria-label", "Annotation sort order");
    for (const [value, label] of [
      ["document", "\u6587\u6863\u987A\u5E8F"],
      ["newest", "\u6700\u65B0\u4F18\u5148"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sort.append(option);
    }
    sort.value = this.sort;
    sort.addEventListener("change", () => {
      this.sort = sort.value === "newest" ? "newest" : "document";
      this.render();
    });
    const bulkDelete = document.createElement("button");
    bulkDelete.type = "button";
    bulkDelete.className = "annotation-sidebar-bulk-delete";
    bulkDelete.setAttribute("aria-label", "Delete filtered annotations");
    bulkDelete.textContent = "\u5220\u9664\u5F53\u524D\u7B5B\u9009";
    const bulkColor = document.createElement("select");
    bulkColor.className = "annotation-sidebar-bulk-color";
    bulkColor.setAttribute("aria-label", "Batch annotation color");
    const noColor = document.createElement("option");
    noColor.value = "";
    noColor.textContent = "\u6279\u91CF\u6539\u8272";
    bulkColor.append(noColor);
    for (const color of ["yellow", "green", "blue", "pink", "violet"]) {
      const option = document.createElement("option");
      option.value = color;
      option.textContent = color;
      bulkColor.append(option);
    }
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "annotation-sidebar-export";
    exportButton.setAttribute("aria-label", "Export annotations as Markdown");
    exportButton.title = "\u5BFC\u51FA\u5168\u90E8\u6CE8\u91CA\u4E3A Markdown";
    (0, import_obsidian3.setIcon)(exportButton, "file-down");
    const exportLabel = document.createElement("span");
    exportLabel.textContent = "\u5BFC\u51FA";
    exportButton.append(exportLabel);
    exportButton.addEventListener("click", () => {
      const sourcePath = this.sourcePath;
      if (!sourcePath) return;
      exportButton.disabled = true;
      void this.environment.exportAnnotations(sourcePath, this.annotations).catch((error2) => {
        this.environment.showNotice(
          error2 instanceof Error ? error2.message : String(error2)
        );
      }).finally(() => {
        exportButton.disabled = false;
      });
    });
    management.append(sort, bulkColor, exportButton, bulkDelete);
    fragment.append(management);
    if (error) {
      fragment.append(this.empty(error));
      this.contentEl.replaceChildren(fragment);
      return;
    }
    const visible = this.annotations.filter((annotation) => {
      const hasComment = annotation.comment.trim().length > 0;
      return this.filter === "all" || this.filter === "comments" && hasComment || this.filter === "highlights" && !hasComment;
    }).sort(
      (left, right) => this.sort === "newest" ? right.target.start - left.target.start : left.target.start - right.target.start
    );
    bulkDelete.disabled = visible.length === 0;
    bulkColor.disabled = visible.length === 0;
    bulkColor.addEventListener("change", () => {
      const sourcePath = this.sourcePath;
      if (!sourcePath) return;
      const color = bulkColor.value;
      bulkColor.value = "";
      if (!color) return;
      bulkColor.disabled = true;
      void Promise.all(visible.map(
        (annotation) => this.environment.saveAnnotation(sourcePath, { ...annotation, color })
      )).catch((error2) => {
        this.environment.showNotice(error2 instanceof Error ? error2.message : String(error2));
      }).finally(() => {
        bulkColor.disabled = false;
      });
    });
    bulkDelete.addEventListener("click", () => {
      bulkDelete.disabled = true;
      void Promise.all(visible.map((annotation) => this.environment.removeAnnotation(annotation))).catch((error2) => {
        this.environment.showNotice(
          error2 instanceof Error ? error2.message : String(error2)
        );
      });
    });
    if (visible.length === 0) {
      fragment.append(this.empty(
        this.annotations.length === 0 ? "\u5F53\u524D\u6587\u4EF6\u8FD8\u6CA1\u6709\u6CE8\u91CA" : "\u6CA1\u6709\u7B26\u5408\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u7684\u6CE8\u91CA"
      ));
      this.contentEl.replaceChildren(fragment);
      return;
    }
    const list = document.createElement("div");
    list.className = "annotation-sidebar-list";
    for (const annotation of visible) list.append(this.item(annotation));
    fragment.append(list);
    this.contentEl.replaceChildren(fragment);
  }
  item(annotation) {
    const sourcePath = this.sourcePath;
    const entry = document.createElement("div");
    entry.className = "annotation-sidebar-entry";
    const item = document.createElement("button");
    item.type = "button";
    item.className = "annotation-sidebar-item";
    item.dataset.annotationColor = annotationDisplayColor(annotation);
    const quote = document.createElement("span");
    quote.className = "annotation-sidebar-quote";
    quote.textContent = annotation.quote;
    item.append(quote);
    if (annotation.comment.trim()) {
      const note = document.createElement("div");
      note.className = "annotation-sidebar-note";
      const label = document.createElement("div");
      label.className = "annotation-sidebar-comment-label";
      label.textContent = "\u6279\u6CE8";
      const comment = document.createElement("div");
      comment.className = "annotation-sidebar-comment";
      comment.textContent = annotation.comment;
      note.append(label, comment);
      item.append(note);
    } else {
      const label = document.createElement("div");
      label.className = "annotation-sidebar-highlight-label";
      label.textContent = "\u4EC5\u9AD8\u4EAE";
      item.append(label);
    }
    item.addEventListener("click", async () => {
      if (!sourcePath) return;
      item.classList.remove("is-unresolved");
      const found = await this.environment.focusAnnotation(sourcePath, annotation.id);
      if (!found) {
        item.classList.add("is-unresolved");
        this.environment.showNotice("\u65E0\u6CD5\u5B9A\u4F4D\u8FD9\u6761\u6CE8\u91CA\uFF0C\u539F\u6587\u53EF\u80FD\u5DF2\u7ECF\u53D1\u751F\u53D8\u5316\u3002");
      }
    });
    const actions = document.createElement("div");
    actions.className = "annotation-sidebar-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "clickable-icon annotation-sidebar-action";
    edit.dataset.annotationAction = "edit";
    edit.setAttribute("aria-label", "Edit annotation");
    edit.title = "\u7F16\u8F91\u6279\u6CE8";
    (0, import_obsidian3.setIcon)(edit, "pencil");
    edit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sourcePath) return;
      new AnnotationSidebarEditModal(this.app, {
        annotation,
        onSave: (updated) => this.environment.saveAnnotation(sourcePath, updated)
      }).open();
    });
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "clickable-icon annotation-sidebar-action";
    copy.dataset.annotationAction = "copy";
    copy.setAttribute("aria-label", "Copy annotation");
    copy.title = "\u590D\u5236\u6458\u5F55\u548C\u6279\u6CE8";
    (0, import_obsidian3.setIcon)(copy, "copy");
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = annotation.comment.trim() ? `${annotation.quote}

${annotation.comment}` : annotation.quote;
      void this.environment.copyText(text).catch((error) => {
        this.environment.showNotice(error instanceof Error ? error.message : String(error));
      });
    });
    const repair = document.createElement("button");
    repair.type = "button";
    repair.className = "clickable-icon annotation-sidebar-action annotation-sidebar-repair";
    repair.dataset.annotationAction = "repair";
    repair.setAttribute("aria-label", "Repair annotation");
    repair.title = "\u91CD\u65B0\u5B9A\u4F4D\u6279\u6CE8";
    (0, import_obsidian3.setIcon)(repair, "locate-fixed");
    repair.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sourcePath) return;
      repair.disabled = true;
      void this.environment.repairAnnotation(sourcePath, annotation.id).then((started) => {
        if (!started) this.environment.showNotice("\u5F53\u524D\u89C6\u56FE\u65E0\u6CD5\u5F00\u59CB\u91CD\u65B0\u5B9A\u4F4D\u3002\u8BF7\u5148\u6253\u5F00\u539F\u6587\u9884\u89C8\u3002 ");
      }).catch((error) => {
        this.environment.showNotice(
          error instanceof Error ? error.message : String(error)
        );
      }).finally(() => {
        repair.disabled = false;
      });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "clickable-icon annotation-sidebar-action";
    remove.dataset.annotationAction = "delete";
    remove.setAttribute("aria-label", "Delete annotation");
    remove.title = "\u5220\u9664\u6279\u6CE8";
    (0, import_obsidian3.setIcon)(remove, "trash-2");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      remove.disabled = true;
      void this.environment.removeAnnotation(annotation).catch((error) => {
        remove.disabled = false;
        this.environment.showNotice(
          error instanceof Error ? error.message : String(error)
        );
      });
    });
    actions.append(edit, copy, repair, remove);
    entry.append(item, actions);
    return entry;
  }
  empty(message) {
    const empty = document.createElement("p");
    empty.className = "annotation-sidebar-empty";
    empty.textContent = message;
    return empty;
  }
};

// src/cleanup/rule-validation.ts
var MAX_SELECTOR_LENGTH = 512;
var SAFE_SELECTOR_CHARS = /^[a-zA-Z0-9_#.()\-\s>+~:[\]="']+$/;
var TAG_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
var FIELD_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
var RULE_ID_PATTERN = /^[0-9a-f]{32}$/;
function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function isBoundedString(value, maximum) {
  return typeof value === "string" && value.length <= maximum;
}
function parseClasses(value, maximum = 12) {
  if (!Array.isArray(value) || value.length > maximum) {
    return null;
  }
  const classes = [];
  for (const item of value) {
    if (!isBoundedString(item, 80) || !/^[a-zA-Z0-9_-]+$/.test(item)) {
      return null;
    }
    classes.push(item);
  }
  return classes;
}
function parseAncestor(value) {
  if (!isPlainObject(value) || !isBoundedString(value.tag, 32)) {
    return null;
  }
  if (!TAG_PATTERN.test(value.tag)) {
    return null;
  }
  const classes = parseClasses(value.classes, 6);
  if (!classes) {
    return null;
  }
  if (value.id !== void 0 && !isBoundedString(value.id, 128)) {
    return null;
  }
  return {
    classes,
    ...typeof value.id === "string" ? { id: value.id } : {},
    tag: value.tag
  };
}
function parseFingerprint(value) {
  if (!isPlainObject(value) || !isBoundedString(value.tag, 32)) {
    return null;
  }
  if (!TAG_PATTERN.test(value.tag) || !isBoundedString(value.text, 160)) {
    return null;
  }
  if (value.id !== void 0 && !isBoundedString(value.id, 128)) {
    return null;
  }
  const classes = parseClasses(value.classes);
  if (!classes || !isPlainObject(value.attributes)) {
    return null;
  }
  const attributeEntries = Object.entries(value.attributes);
  if (attributeEntries.length > 8) {
    return null;
  }
  const attributes = {};
  for (const [name, attributeValue] of attributeEntries) {
    if (!FIELD_PATTERN.test(name) || !isBoundedString(attributeValue, 160)) {
      return null;
    }
    attributes[name] = attributeValue;
  }
  if (!Array.isArray(value.ancestors) || value.ancestors.length > 5) {
    return null;
  }
  const ancestors = [];
  for (const ancestorValue of value.ancestors) {
    const ancestor = parseAncestor(ancestorValue);
    if (!ancestor) {
      return null;
    }
    ancestors.push(ancestor);
  }
  return {
    ancestors,
    attributes,
    classes,
    ...typeof value.id === "string" ? { id: value.id } : {},
    tag: value.tag,
    text: value.text
  };
}
function isSupportedCleanupSelector(selector) {
  const trimmed = selector.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SELECTOR_LENGTH || !SAFE_SELECTOR_CHARS.test(trimmed) || /[{},;@]/.test(trimmed) || /^(html|head|body)$/i.test(trimmed)) {
    return false;
  }
  const withoutNth = trimmed.replace(/:nth-of-type\([1-9][0-9]*\)/g, "");
  if (withoutNth.includes(":")) {
    return false;
  }
  const combinators = (trimmed.match(/[>+~]/g)?.length ?? 0) + trimmed.split(/\s+/).filter(Boolean).length - 1;
  return combinators <= 8;
}
function parseCleanupCandidate(value) {
  if (!isPlainObject(value) || typeof value.selector !== "string" || !isSupportedCleanupSelector(value.selector)) {
    return null;
  }
  const fingerprint = parseFingerprint(value.fingerprint);
  return fingerprint ? { fingerprint, selector: value.selector } : null;
}
function isNormalizedSourcePath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !value.startsWith("/") && !value.includes("\\") && !value.includes("\0") && !value.split("/").includes("..");
}
function parseRule(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  const candidate = parseCleanupCandidate(value);
  if (!candidate || typeof value.id !== "string" || !RULE_ID_PATTERN.test(value.id) || value.scope !== "file" && value.scope !== "folder" || !isNormalizedSourcePath(value.sourcePath) || typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    return null;
  }
  return {
    ...candidate,
    createdAt: value.createdAt,
    id: value.id,
    scope: value.scope,
    sourcePath: value.sourcePath
  };
}
function parseCleanupDocument(value) {
  if (!isPlainObject(value) || value.version !== 1 || !Array.isArray(value.rules) || value.rules.length > 500) {
    return null;
  }
  const rules = [];
  for (const ruleValue of value.rules) {
    const rule = parseRule(ruleValue);
    if (!rule) {
      return null;
    }
    rules.push(rule);
  }
  return { rules, version: 1 };
}

// src/cleanup/rule-store.ts
var FOLDER_RULES_PATH = ".html-preview/cleanup/folder-rules.json";
function cleanupPageRulePath(sourcePath) {
  return `.html-preview/cleanup/pages/${sourcePath}.json`;
}
function parentPath2(path) {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}
function validateSourcePath2(path) {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) {
    throw new Error(`Invalid Vault path: ${path}`);
  }
}
function serialize2(rules) {
  const document2 = { rules: [...rules], version: 1 };
  return `${JSON.stringify(document2, null, 2)}
`;
}
function mergeById(preferred, existing) {
  const merged = /* @__PURE__ */ new Map();
  for (const rule of preferred) {
    merged.set(rule.id, rule);
  }
  for (const rule of existing) {
    if (!merged.has(rule.id)) {
      merged.set(rule.id, rule);
    }
  }
  return [...merged.values()];
}
var CleanupRuleStore = class {
  constructor(adapter, onProblem = () => {
  }) {
    this.adapter = adapter;
    this.onProblem = onProblem;
  }
  adapter;
  onProblem;
  queue = Promise.resolve();
  async loadEffective(sourcePath) {
    validateSourcePath2(sourcePath);
    await this.queue;
    const [folderResult, fileResult] = await Promise.all([
      this.readDocument(FOLDER_RULES_PATH),
      this.readDocument(cleanupPageRulePath(sourcePath))
    ]);
    const folderRules = folderResult.rules.filter(
      (rule) => rule.scope === "folder" && (rule.sourcePath === "." || sourcePath.startsWith(`${rule.sourcePath}/`))
    );
    return mergeById(folderRules, fileResult.rules);
  }
  addFileRule(sourcePath, rule) {
    validateSourcePath2(sourcePath);
    return this.mutate(async () => {
      const path = cleanupPageRulePath(sourcePath);
      const result = await this.readForMutation(path);
      const fileRule = {
        ...rule,
        scope: "file",
        sourcePath
      };
      this.assertRules([fileRule]);
      const rules = result.rules.filter((item) => item.id !== fileRule.id);
      rules.push(fileRule);
      await this.writeDocument(path, rules);
    });
  }
  removeRule(rule) {
    return this.mutate(async () => {
      const path = rule.scope === "folder" ? FOLDER_RULES_PATH : cleanupPageRulePath(rule.sourcePath);
      const result = await this.readForMutation(path);
      await this.writeDocument(
        path,
        result.rules.filter((item) => item.id !== rule.id)
      );
    });
  }
  resetFileRules(sourcePath) {
    validateSourcePath2(sourcePath);
    return this.mutate(async () => {
      const path = cleanupPageRulePath(sourcePath);
      await this.readForMutation(path);
      await this.writeDocument(path, []);
    });
  }
  promoteToFolder(sourcePath, ruleId) {
    validateSourcePath2(sourcePath);
    return this.mutate(async () => {
      const filePath = cleanupPageRulePath(sourcePath);
      const fileResult = await this.readForMutation(filePath);
      const rule = fileResult.rules.find((item) => item.id === ruleId);
      if (!rule) {
        throw new Error(`Cleanup rule was not found: ${ruleId}`);
      }
      const folderResult = await this.readForMutation(FOLDER_RULES_PATH);
      const promoted = {
        ...rule,
        scope: "folder",
        sourcePath: parentPath2(sourcePath) || "."
      };
      this.assertRules([promoted]);
      const folderRules = folderResult.rules.filter(
        (item) => item.id !== promoted.id
      );
      folderRules.push(promoted);
      await this.writeDocument(FOLDER_RULES_PATH, folderRules);
      await this.writeDocument(
        filePath,
        fileResult.rules.filter((item) => item.id !== ruleId)
      );
      return promoted;
    });
  }
  migrateFile(oldPath, newPath) {
    validateSourcePath2(oldPath);
    validateSourcePath2(newPath);
    return this.mutate(async () => {
      const oldRulePath = cleanupPageRulePath(oldPath);
      if (!await this.adapter.exists(oldRulePath)) {
        return;
      }
      const sourceResult = await this.readForMutation(oldRulePath);
      const newRulePath = cleanupPageRulePath(newPath);
      const targetResult = await this.readForMutation(newRulePath);
      const movedRules = sourceResult.rules.map((rule) => ({
        ...rule,
        scope: "file",
        sourcePath: newPath
      }));
      await this.writeDocument(
        newRulePath,
        mergeById(movedRules, targetResult.rules)
      );
      await this.adapter.remove(oldRulePath);
    });
  }
  mutate(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => void 0,
      () => void 0
    );
    return result;
  }
  async readDocument(path) {
    if (!await this.adapter.exists(path)) {
      return { rules: [], valid: true };
    }
    let parsed;
    try {
      parsed = JSON.parse(await this.adapter.read(path));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.onProblem({ message: `Failed to parse cleanup data: ${detail}`, path });
      return { rules: [], valid: false };
    }
    const document2 = parseCleanupDocument(parsed);
    if (!document2) {
      this.onProblem({ message: "Unsupported or invalid cleanup data", path });
      return { rules: [], valid: false };
    }
    return { rules: document2.rules, valid: true };
  }
  async readForMutation(path) {
    const result = await this.readDocument(path);
    if (!result.valid) {
      throw new Error(`Cannot overwrite invalid cleanup data: ${path}`);
    }
    return result;
  }
  assertRules(rules) {
    if (!parseCleanupDocument({ rules, version: 1 })) {
      throw new Error("Invalid cleanup rule");
    }
  }
  async ensureParentDirectories(path) {
    const directory = parentPath2(path);
    if (!directory) {
      return;
    }
    const segments = directory.split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!await this.adapter.exists(current)) {
        await this.adapter.mkdir(current);
      }
    }
  }
  async writeDocument(path, rules) {
    this.assertRules(rules);
    await this.ensureParentDirectories(path);
    await this.adapter.write(path, serialize2(rules));
  }
};

// src/html-preview-view.ts
var import_obsidian6 = require("obsidian");

// src/annotations/runtime.ts
var ANNOTATION_SAVE_MESSAGE_TYPE = "obsidian-html-preview:annotation-save";
var ANNOTATION_DELETE_MESSAGE_TYPE = "obsidian-html-preview:annotation-delete";
var ANNOTATION_RESULT_MESSAGE_TYPE = "obsidian-html-preview:annotation-result";
var ANNOTATION_FOCUS_MESSAGE_TYPE = "obsidian-html-preview:annotation-focus";
var ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE = "obsidian-html-preview:annotation-focus-result";
var ANNOTATION_REANCHOR_MESSAGE_TYPE = "obsidian-html-preview:annotation-reanchor";
var ANNOTATION_REPAIR_MESSAGE_TYPE = "obsidian-html-preview:annotation-repair";
var ANNOTATION_SYNC_SAVE_MESSAGE_TYPE = "obsidian-html-preview:annotation-sync-save";
var ANNOTATION_SYNC_DELETE_MESSAGE_TYPE = "obsidian-html-preview:annotation-sync-delete";
function createAnnotationRuntimeScript(renderId, annotations = []) {
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
    .annotation-editor-comment { display: block !important; width: calc(100% - 28px) !important; min-height: 92px !important; margin: 0 14px !important; resize: vertical !important; border: 1px solid #d9dcd5 !important; border-radius: 6px !important; color: #252824 !important; background: #fafaf8 !important; padding: 10px 11px !important; font-size: 13px !important; line-height: 1.55 !important; -webkit-user-select: text !important; user-select: text !important; }
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
    const reanchorType = ${JSON.stringify(ANNOTATION_REANCHOR_MESSAGE_TYPE)};
    const repairType = ${JSON.stringify(ANNOTATION_REPAIR_MESSAGE_TYPE)};
    const syncSaveType = ${JSON.stringify(ANNOTATION_SYNC_SAVE_MESSAGE_TYPE)};
    const syncDeleteType = ${JSON.stringify(ANNOTATION_SYNC_DELETE_MESSAGE_TYPE)};
    const colors = ["yellow", "green", "blue", "pink", "violet"];
    const labels = { yellow: "\u9EC4\u8272", green: "\u7EFF\u8272", blue: "\u84DD\u8272", pink: "\u7C89\u8272", violet: "\u7D2B\u8272" };
    const annotationById = new Map();
    const pending = new Map();
    let surface = null;
    let requestSequence = 0;
    let lastColor = "yellow";
    let pendingRepairId = null;

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

    const visibleText = () => textNodes().map((node) => node.textContent || "").join("");

    const visiblePosition = (container, offset) => {
      let position = 0;
      const prefix = document.createRange();
      prefix.setStart(document.body, 0);
      prefix.setEnd(container, offset);
      for (const node of textNodes()) {
        const length = node.textContent ? node.textContent.length : 0;
        if (node === container) return position + Math.max(0, Math.min(offset, length));
        if (!prefix.intersectsNode(node)) return position;
        position += length;
      }
      return position;
    };

    const normalize = (value) => value.replace(/\\s+/g, " ").trim();

    const normalizedText = (value) => {
      let text = "";
      const starts = [];
      const ends = [];
      let index = 0;
      while (index < value.length) {
        if (!/\\s/.test(value[index])) {
          text += value[index];
          starts.push(index);
          ends.push(index + 1);
          index += 1;
          continue;
        }
        const start = index;
        while (index < value.length && /\\s/.test(value[index])) index += 1;
        if (text.length > 0 && index < value.length) {
          text += " ";
          starts.push(start);
          ends.push(index);
        }
      }
      return { ends, starts, text };
    };

    const matchingContext = (left, right, fromEnd) => {
      const limit = Math.min(left.length, right.length);
      let matched = 0;
      for (let length = 1; length <= limit; length += 1) {
        const leftPart = fromEnd ? left.slice(-length) : left.slice(0, length);
        const rightPart = fromEnd ? right.slice(-length) : right.slice(0, length);
        if (leftPart === rightPart) matched = length;
      }
      return matched;
    };

    const targetContextScore = (fullText, start, end, target) => {
      const prefix = normalize(fullText.slice(Math.max(0, start - 96), start));
      const suffix = normalize(fullText.slice(end, Math.min(fullText.length, end + 96)));
      return matchingContext(prefix, normalize(target.prefix || ""), true) +
        matchingContext(suffix, normalize(target.suffix || ""), false);
    };

    const resolveTarget = (target) => {
      const fullText = visibleText();
      const exact = normalize(target.exact || "");
      if (!exact) return null;
      if (target.start >= 0 && target.end >= target.start && target.end <= fullText.length &&
          normalize(fullText.slice(target.start, target.end)) === exact) {
        const targetPrefix = normalize(target.prefix || "");
        const targetSuffix = normalize(target.suffix || "");
        const contextLength = targetPrefix.length + targetSuffix.length;
        if (contextLength > 0 && targetContextScore(fullText, target.start, target.end, target) === contextLength) {
          return { end: target.end, start: target.start };
        }
      }

      const model = normalizedText(fullText);
      const candidates = [];
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
      candidates.sort((left, right) => right.score - left.score ||
        Math.abs(left.start - target.start) - Math.abs(right.start - target.start));
      const best = candidates[0];
      const second = candidates[1];
      if (!best || (second && best.score === second.score)) return null;
      return best;
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

    const postReanchor = (annotation) => {
      window.parent.postMessage({ annotation, renderId, type: reanchorType }, "*");
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
      const resolved = resolveTarget(annotation.target);
      if (!resolved) return false;
      const fullText = visibleText();
      const nextPrefix = fullText.slice(Math.max(0, resolved.start - 24), resolved.start);
      const nextSuffix = fullText.slice(resolved.end, Math.min(fullText.length, resolved.end + 24));
      const changed = annotation.target.start !== resolved.start ||
        annotation.target.end !== resolved.end ||
        annotation.target.prefix !== nextPrefix ||
        annotation.target.suffix !== nextSuffix;
      annotation.target.start = resolved.start;
      annotation.target.end = resolved.end;
      annotation.target.prefix = nextPrefix;
      annotation.target.suffix = nextSuffix;
      const range = rangeFromOffsets(resolved.start, resolved.end);
      if (!range) return false;
      wrapRange(range, annotation);
      if (changed) postReanchor(annotation);
      return true;
    };

    const applyInitialAnnotations = () => {
      for (const annotation of initialAnnotations) applyAnnotation(annotation);
    };
    if (document.body) applyInitialAnnotations();
    else document.addEventListener("DOMContentLoaded", applyInitialAnnotations, { once: true });

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
      document.body.append(element);
      place(element, anchor);
    };

    const palette = (selected, onSelect) => {
      const element = document.createElement("div");
      element.className = "annotation-color-palette";
      element.setAttribute("aria-label", "\u9AD8\u4EAE\u989C\u8272");
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

    const showEditor = (draft, anchor, existing, repairing = false) => {
      const editor = document.createElement("div");
      editor.className = "annotation-editor";
      editor.setAttribute("role", "dialog");
      editor.setAttribute("aria-label", repairing ? "\u91CD\u65B0\u5B9A\u4F4D\u6279\u6CE8" : (existing ? "\u7F16\u8F91\u6CE8\u91CA" : "\u6DFB\u52A0\u6CE8\u91CA"));
      const header = document.createElement("div");
      header.className = "annotation-editor-header";
      const title = document.createElement("strong");
      title.textContent = repairing ? "\u91CD\u65B0\u5B9A\u4F4D\u6279\u6CE8" : (existing ? "\u7F16\u8F91\u6CE8\u91CA" : "\u6DFB\u52A0\u6CE8\u91CA");
      const close = button("\xD7", "annotation-editor-close");
      close.setAttribute("aria-label", "\u5173\u95ED");
      close.addEventListener("click", closeSurface);
      header.append(title, close);
      if (repairing) {
        const hint = document.createElement("p");
        hint.className = "annotation-editor-repair-hint";
        hint.textContent = "\u5DF2\u66FF\u6362\u6458\u5F55\u4F4D\u7F6E\uFF0C\u4FDD\u5B58\u540E\u5C06\u66F4\u65B0\u8FD9\u6761\u6279\u6CE8\u3002";
        header.append(hint);
      }
      const quote = document.createElement("blockquote");
      quote.className = "annotation-editor-quote";
      quote.textContent = "\u201C" + draft.quote + "\u201D";
      const colorsElement = palette(draft.color, (color) => { draft.color = color; });
      const textarea = document.createElement("textarea");
      textarea.className = "annotation-editor-comment";
      textarea.placeholder = "\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5\u2026";
      textarea.setAttribute("aria-label", "\u6CE8\u91CA\u5185\u5BB9");
      textarea.value = draft.comment || "";
      const actions = document.createElement("div");
      actions.className = "annotation-editor-actions";
      if (existing) {
        const remove = button("\u5220\u9664\u9AD8\u4EAE", "annotation-editor-delete");
        remove.addEventListener("click", () => send(deleteType, { annotationId: existing.id }, { kind: "delete", annotation: existing }));
        actions.append(remove);
      } else {
        actions.append(document.createElement("span"));
      }
      const commands = document.createElement("div");
      commands.className = "annotation-editor-commands";
      const save = (comment) => send(saveType, { annotation: Object.assign({}, draft, { comment }) }, { kind: "save", draft });
      if (!existing) {
        const highlight = button("\u4EC5\u9AD8\u4EAE", "annotation-editor-secondary");
        highlight.addEventListener("click", () => save(""));
        commands.append(highlight);
      }
      const submit = button(existing ? "\u4FDD\u5B58\u4FEE\u6539" : "\u4FDD\u5B58\u6279\u6CE8", "annotation-editor-primary");
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

    const captureSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      if (!document.body.contains(range.startContainer) || !document.body.contains(range.endContainer)) return null;
      const exact = range.toString().replace(/\\s+/g, " ").trim();
      if (!exact) return null;
      const start = visiblePosition(range.startContainer, range.startOffset);
      const end = visiblePosition(range.endContainer, range.endOffset);
      const fullText = visibleText();
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
      const repairing = pendingRepairId
        ? annotationById.get(pendingRepairId)
        : null;
      if (repairing) {
        showEditor(Object.assign({}, repairing, captured.draft, {
          color: repairing.color || "yellow",
          comment: repairing.comment,
          id: repairing.id
        }), captured.anchor, repairing, true);
        return;
      }
      const toolbar = document.createElement("div");
      toolbar.className = "annotation-selection-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", "\u9009\u4E2D\u6587\u5B57\u64CD\u4F5C");
      toolbar.addEventListener("mousedown", (event) => event.preventDefault());
      const color = button("\u989C\u8272", "annotation-toolbar-button");
      const comment = button("\u6CE8\u91CA", "annotation-toolbar-button");
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
        if (operation.kind === "save" && data.annotation) {
          applyAnnotation(data.annotation);
          if (data.annotation.id === pendingRepairId) pendingRepairId = null;
        }
        closeSurface();
        window.getSelection()?.removeAllRanges();
        return;
      }
      if (data.type === syncSaveType && data.annotation) {
        applyAnnotation(data.annotation);
        return;
      }
      if (data.type === syncDeleteType && typeof data.annotationId === "string") {
        removeAnnotation(data.annotationId);
        return;
      }
      if (data.type === repairType && typeof data.annotationId === "string") {
        pendingRepairId = annotationById.has(data.annotationId) ? data.annotationId : null;
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

// src/diagnostics-modal.ts
var import_obsidian4 = require("obsidian");
var DiagnosticsModal = class extends import_obsidian4.Modal {
  constructor(app, diagnostics) {
    super(app);
    this.diagnostics = diagnostics;
  }
  diagnostics;
  onOpen() {
    this.titleEl.textContent = "HTML preview diagnostics";
    this.contentEl.replaceChildren();
    if (this.diagnostics.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No compatibility issues were detected.";
      this.contentEl.append(empty);
      return;
    }
    const list = document.createElement("ul");
    list.className = "html-preview-diagnostics";
    for (const diagnostic of this.diagnostics) {
      const item = document.createElement("li");
      item.className = `html-preview-diagnostic is-${diagnostic.level}`;
      item.textContent = diagnostic.message;
      list.append(item);
    }
    this.contentEl.append(list);
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
};

// src/cleanup/rules-modal.ts
var import_obsidian5 = require("obsidian");
var CleanupRulesModal = class extends import_obsidian5.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  options;
  onOpen() {
    this.titleEl.textContent = "Cleanup rules";
    this.contentEl.replaceChildren();
    this.contentEl.classList.add("html-preview-cleanup-manager");
    if (this.options.rules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "html-preview-cleanup-empty";
      empty.textContent = "This page has no cleanup rules.";
      this.contentEl.append(empty);
      return;
    }
    const list = document.createElement("ul");
    list.className = "html-preview-cleanup-rules";
    for (const rule of this.options.rules) {
      list.append(this.createRuleItem(rule));
    }
    this.contentEl.append(list);
    if (this.options.rules.some(
      (rule) => rule.scope === "file" && rule.sourcePath === this.options.sourcePath
    )) {
      const footer = document.createElement("div");
      footer.className = "html-preview-cleanup-footer";
      const reset = this.createButton(
        "trash-2",
        "Reset file rules",
        "reset-file",
        void 0,
        () => this.options.onReset()
      );
      const resetLabel = document.createElement("span");
      resetLabel.textContent = "Reset file rules";
      reset.append(resetLabel);
      footer.append(reset);
      this.contentEl.append(footer);
    }
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
  createRuleItem(rule) {
    const item = document.createElement("li");
    item.className = "html-preview-cleanup-rule";
    const details = document.createElement("div");
    details.className = "html-preview-cleanup-rule-details";
    const summary = document.createElement("code");
    summary.className = "html-preview-cleanup-selector";
    summary.textContent = rule.selector;
    const metadata = document.createElement("div");
    metadata.className = "html-preview-cleanup-rule-meta";
    const scope = document.createElement("span");
    scope.className = `html-preview-cleanup-scope is-${rule.scope}`;
    scope.textContent = rule.scope === "file" ? "File" : "Folder";
    metadata.append(scope);
    if (rule.scope === "folder") {
      const path = document.createElement("span");
      path.textContent = rule.sourcePath === "." ? "Vault root" : rule.sourcePath;
      metadata.append(path);
    }
    if (this.options.unmatchedRuleIds.has(rule.id)) {
      const unmatched = document.createElement("span");
      unmatched.className = "html-preview-cleanup-unmatched";
      unmatched.textContent = "Not matched on this page";
      metadata.append(unmatched);
    }
    details.append(summary, metadata);
    const actions = document.createElement("div");
    actions.className = "html-preview-cleanup-rule-actions";
    actions.append(
      this.createButton(
        "eye",
        "Restore cleanup rule",
        "restore",
        rule.id,
        () => this.options.onRestore(rule)
      )
    );
    if (rule.scope === "file" && rule.sourcePath === this.options.sourcePath) {
      actions.append(
        this.createButton(
          "folder-up",
          "Apply cleanup rule to folder",
          "promote",
          rule.id,
          () => this.options.onPromote(rule)
        )
      );
    }
    item.append(details, actions);
    return item;
  }
  createButton(icon, label, action, ruleId, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "clickable-icon";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.cleanupAction = action;
    if (ruleId) button.dataset.ruleId = ruleId;
    (0, import_obsidian5.setIcon)(button, icon);
    button.addEventListener("click", () => {
      button.disabled = true;
      void callback().then(() => this.close()).catch((error) => {
        button.disabled = false;
        this.options.onError(
          error instanceof Error ? error.message : String(error)
        );
      });
    });
    return button;
  }
};

// src/cleanup/runtime.ts
var CLEANUP_MODE_MESSAGE_TYPE = "obsidian-html-preview:cleanup-mode";
var CLEANUP_MODE_STATE_MESSAGE_TYPE = "obsidian-html-preview:cleanup-mode-state";
var CLEANUP_SELECTED_MESSAGE_TYPE = "obsidian-html-preview:cleanup-selected";
var CLEANUP_UNMATCHED_MESSAGE_TYPE = "obsidian-html-preview:cleanup-unmatched";
function createCleanupCandidate(element) {
  const normalizedText2 = (value) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const tag = element.tagName.toLowerCase();
  if (tag === "html" || tag === "head" || tag === "body" || element.closest("[data-html-preview-cleanup-ui]")) {
    return null;
  }
  const generatedId = (id) => /^[:].*[:]$/.test(id) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) || /^(react|ember|vue|headlessui|radix)[-_:]?[a-z]*\d{3,}$/i.test(id) || /^[0-9a-f]{16,}$/i.test(id);
  const stableId = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(element.id) && !generatedId(element.id) ? element.id : void 0;
  const stableAttributes = ["data-testid", "data-test", "aria-label", "role"];
  const attributes = {};
  for (const name of stableAttributes) {
    const value = element.getAttribute(name);
    if (value && value.length <= 160) {
      attributes[name] = value;
    }
  }
  const classes = [...element.classList].filter((value) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(value)).slice(0, 12);
  let selector = "";
  if (stableId && document.querySelectorAll(`#${stableId}`).length === 1) {
    selector = `#${stableId}`;
  }
  if (!selector) {
    for (const name of stableAttributes) {
      const value = attributes[name];
      if (!value || !/^[a-zA-Z0-9 _-]{1,80}$/.test(value)) {
        continue;
      }
      const candidate = `${tag}[${name}="${value}"]`;
      if (document.querySelectorAll(candidate).length === 1) {
        selector = candidate;
        break;
      }
    }
  }
  if (!selector && classes.length > 0) {
    const candidate = `${tag}${classes.slice(0, 3).map((value) => `.${value}`).join("")}`;
    if (document.querySelectorAll(candidate).length === 1) {
      selector = candidate;
    }
  }
  if (!selector) {
    const parts = [];
    let current = element;
    while (current && current.tagName.toLowerCase() !== "body" && parts.length < 6) {
      const currentTag = current.tagName.toLowerCase();
      const siblings = current.parentElement ? [...current.parentElement.children].filter(
        (sibling) => sibling.tagName === current.tagName
      ) : [];
      const index = Math.max(1, siblings.indexOf(current) + 1);
      parts.unshift(`${currentTag}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    selector = parts.join(" > ");
  }
  const ancestors = [];
  let parent = element.parentElement;
  while (parent && parent.tagName.toLowerCase() !== "body" && ancestors.length < 5) {
    const parentClasses = [...parent.classList].filter((value) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(value)).slice(0, 6);
    const parentId = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(parent.id) && !generatedId(parent.id) ? parent.id : void 0;
    ancestors.push({
      classes: parentClasses,
      ...parentId ? { id: parentId } : {},
      tag: parent.tagName.toLowerCase()
    });
    parent = parent.parentElement;
  }
  return {
    fingerprint: {
      ancestors,
      attributes,
      classes,
      ...stableId ? { id: stableId } : {},
      tag,
      text: normalizedText2(element.textContent)
    },
    selector
  };
}
function installCleanupRuntime(config, candidateFactory = createCleanupCandidate) {
  const hiddenAttribute = "data-obsidian-html-preview-hidden";
  const targetAttribute = "data-obsidian-html-preview-target";
  const uiAttribute = "data-html-preview-cleanup-ui";
  const modeMessageType = "obsidian-html-preview:cleanup-mode";
  const modeStateMessageType = "obsidian-html-preview:cleanup-mode-state";
  const selectedMessageType = "obsidian-html-preview:cleanup-selected";
  const unmatchedMessageType = "obsidian-html-preview:cleanup-unmatched";
  const cachedStopImmediate = Event.prototype.stopImmediatePropagation;
  let cleanupMode = false;
  let currentTarget = null;
  let touchTarget = null;
  let controls = null;
  let mutationTimer = null;
  let unmatched = /* @__PURE__ */ new Set();
  const style = document.createElement("style");
  style.setAttribute(uiAttribute, "true");
  style.textContent = `
    [${hiddenAttribute}] { display: none !important; }
    [${targetAttribute}] { outline: 3px solid #7c5cff !important; outline-offset: -3px !important; cursor: crosshair !important; }
    [${uiAttribute}] { font: 13px system-ui, sans-serif !important; }
  `;
  document.head.append(style);
  const normalize2 = (value) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const classScore = (element, expected) => {
    if (expected.length === 0) return 0;
    return expected.filter((name) => element.classList.contains(name)).length / expected.length;
  };
  const score = (element, rule) => {
    const fingerprint = rule.fingerprint;
    if (element.tagName.toLowerCase() !== fingerprint.tag) return -1;
    let value = 0.2;
    if (fingerprint.id) value += element.id === fingerprint.id ? 0.25 : -0.1;
    const attributes = Object.entries(fingerprint.attributes);
    if (attributes.length > 0) {
      value += 0.2 * (attributes.filter(([name, expected]) => element.getAttribute(name) === expected).length / attributes.length);
    }
    value += 0.15 * classScore(element, fingerprint.classes);
    const text = normalize2(element.textContent);
    if (fingerprint.text && text === fingerprint.text) value += 0.25;
    else if (fingerprint.text && (text.includes(fingerprint.text) || fingerprint.text.includes(text))) value += 0.15;
    let ancestor = element.parentElement;
    for (const expected of fingerprint.ancestors) {
      if (!ancestor) break;
      if (ancestor.tagName.toLowerCase() === expected.tag) {
        value += 0.05 + 0.03 * classScore(ancestor, expected.classes);
      }
      ancestor = ancestor.parentElement;
    }
    return Math.min(value, 1);
  };
  const choose = (elements, rule, threshold) => {
    const ranked = elements.map((element) => ({ element, score: score(element, rule) })).filter((item) => item.score >= threshold).sort((left, right) => right.score - left.score);
    if (!ranked[0]) return null;
    if (ranked[1] && ranked[0].score - ranked[1].score < 0.12) return null;
    return ranked[0].element;
  };
  const resolve = (rule) => {
    let direct = [];
    try {
      direct = [...document.querySelectorAll(rule.selector)].slice(0, 100);
    } catch {
      return null;
    }
    const directMatch = choose(direct, rule, rule.scope === "folder" ? 0.7 : 0.45);
    if (directMatch) return directMatch;
    return choose(
      [...document.querySelectorAll(rule.fingerprint.tag)].slice(0, 500),
      rule,
      rule.scope === "folder" ? 0.75 : 0.62
    );
  };
  const applyRules = () => {
    const nextUnmatched = /* @__PURE__ */ new Set();
    for (const rule of config.rules) {
      const element = resolve(rule);
      if (element && !element.closest(`[${uiAttribute}]`)) {
        element.setAttribute(hiddenAttribute, rule.id);
      } else {
        nextUnmatched.add(rule.id);
      }
    }
    unmatched = nextUnmatched;
  };
  const reportUnmatched = () => {
    if (unmatched.size > 0) {
      window.parent.postMessage(
        {
          renderId: config.renderId,
          ruleIds: [...unmatched],
          type: unmatchedMessageType
        },
        "*"
      );
    }
  };
  const clearTarget = () => {
    currentTarget?.removeAttribute(targetAttribute);
    currentTarget = null;
  };
  const setTarget = (element) => {
    clearTarget();
    if (!element || !candidateFactory(element)) return;
    currentTarget = element;
    currentTarget.setAttribute(targetAttribute, "true");
  };
  const removeControls = () => {
    controls?.remove();
    controls = null;
    touchTarget = null;
  };
  const submit = (element) => {
    const candidate = candidateFactory(element);
    if (!candidate) return;
    element.setAttribute(hiddenAttribute, "pending");
    clearTarget();
    removeControls();
    window.parent.postMessage(
      {
        candidate,
        renderId: config.renderId,
        type: selectedMessageType
      },
      "*"
    );
  };
  const showTouchControls = (element) => {
    removeControls();
    touchTarget = element;
    controls = document.createElement("div");
    controls.setAttribute(uiAttribute, "true");
    controls.style.cssText = "position:fixed;z-index:2147483647;right:12px;bottom:12px;display:flex;gap:8px;padding:8px;background:#202127;color:white;border-radius:6px";
    const hide = document.createElement("button");
    hide.type = "button";
    hide.textContent = "Hide";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    hide.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.isTrusted && touchTarget) submit(touchTarget);
    });
    cancel.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearTarget();
      removeControls();
    });
    controls.append(hide, cancel);
    document.body.append(controls);
  };
  const onMessage = (event) => {
    const data = event.data;
    if (event.source !== window.parent || !data || data.type !== modeMessageType || data.renderId !== config.renderId || typeof data.enabled !== "boolean") {
      return;
    }
    cachedStopImmediate.call(event);
    cleanupMode = data.enabled;
    if (!cleanupMode) {
      clearTarget();
      removeControls();
    }
  };
  const onPointerOver = (event) => {
    if (!cleanupMode) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest(`[${uiAttribute}]`)) return;
    setTarget(element);
  };
  const onClick = (event) => {
    if (!cleanupMode) return;
    event.preventDefault();
    cachedStopImmediate.call(event);
    if (!event.isTrusted) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element || element.closest(`[${uiAttribute}]`) || !candidateFactory(element)) return;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      setTarget(element);
      showTouchControls(element);
    } else {
      submit(element);
    }
  };
  const onKeyDown = (event) => {
    if (cleanupMode && event.key === "Escape") {
      cleanupMode = false;
      clearTarget();
      removeControls();
      window.parent.postMessage(
        {
          enabled: false,
          renderId: config.renderId,
          type: modeStateMessageType
        },
        "*"
      );
    }
  };
  applyRules();
  reportUnmatched();
  window.addEventListener("message", onMessage, true);
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  const observer = new MutationObserver(() => {
    if (unmatched.size === 0) return;
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      applyRules();
    }, 50);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    window.removeEventListener("message", onMessage, true);
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearTarget();
    removeControls();
    style.remove();
    for (const element of document.querySelectorAll(`[${hiddenAttribute}]`)) {
      element.removeAttribute(hiddenAttribute);
    }
  };
}
function serializeRuntimeConfig(config) {
  return JSON.stringify(config).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
function createCleanupRuntimeScript(renderId, rules) {
  return `(${installCleanupRuntime.toString()})(${serializeRuntimeConfig({
    renderId,
    rules
  })}, (${createCleanupCandidate.toString()}));`;
}

// src/preview/bridge-script.ts
var NAVIGATION_MESSAGE_TYPE = "obsidian-html-preview:navigate";
function createRenderId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function createBridgeScript(renderId, cleanupRules = [], annotations = []) {
  const messageType = JSON.stringify(NAVIGATION_MESSAGE_TYPE);
  const serializedRenderId = JSON.stringify(renderId);
  const cleanupRuntime = createCleanupRuntimeScript(renderId, cleanupRules);
  const annotationRuntime = createAnnotationRuntimeScript(renderId, annotations);
  return `(() => {
    const messageType = ${messageType};
    const renderId = ${serializedRenderId};
    const bridgeScript = document.currentScript;
    ${cleanupRuntime}
    ${annotationRuntime}
    document.addEventListener("click", (event) => {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      window.parent.postMessage({ type: messageType, renderId, href }, "*");
    }, true);
    bridgeScript?.remove();
  })();`;
}

// src/preview/navigation.ts
var EXTERNAL_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:", "mailto:", "tel:"]);
var PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
function hasValidEncoding(value) {
  if (/%(?![\da-fA-F]{2})/.test(value)) {
    return false;
  }
  try {
    decodeURI(value);
    return true;
  } catch {
    return false;
  }
}
function blocked(reason) {
  return { kind: "blocked", reason };
}
function decodePath(path) {
  try {
    const decoded = decodeURIComponent(path);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}
function resolveVaultPath(rawPath, sourcePath) {
  const decodedPath = decodePath(rawPath);
  if (decodedPath === null || decodedPath.includes("\\")) {
    return null;
  }
  const absolute = decodedPath.startsWith("/");
  const sourceSegments = sourcePath.split("/").filter(Boolean);
  sourceSegments.pop();
  const segments = absolute ? [] : sourceSegments;
  for (const segment of decodedPath.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join("/") : null;
}
function classifyNavigation(rawHref, sourcePath) {
  const href = rawHref.trim();
  if (href.length === 0) {
    return blocked("Empty link");
  }
  if (href.startsWith("#")) {
    return { kind: "fragment" };
  }
  if (href.includes("\\") || !hasValidEncoding(href)) {
    return blocked("Malformed link");
  }
  if (PROTOCOL_PATTERN.test(href)) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return blocked("Malformed URL");
    }
    if (!EXTERNAL_PROTOCOLS.has(url.protocol.toLowerCase())) {
      return blocked(`Blocked protocol: ${url.protocol}`);
    }
    return { kind: "external", url: href };
  }
  const hashIndex = href.indexOf("#");
  const subpath = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const rawPath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const path = resolveVaultPath(rawPath, sourcePath);
  return path === null ? blocked("Link resolves outside the Vault or is malformed") : { kind: "vault", path, subpath };
}

// src/preview/document-builder.ts
var RESOURCE_SELECTORS = [
  ["[src]", "src"],
  ["link[href]", "href"],
  ["[poster]", "poster"],
  ["object[data]", "data"]
];
function getBaseUrl(resourceUrl, diagnostics) {
  try {
    return new URL(".", resourceUrl).href;
  } catch {
    diagnostics.push({
      code: "invalid-resource-url",
      level: "error",
      message: `Could not derive a resource base URL from: ${resourceUrl}`,
      value: resourceUrl
    });
    return "about:blank";
  }
}
function isLocalReference(value) {
  const reference = value.trim();
  return reference.length > 0 && !reference.startsWith("#") && !reference.startsWith("//") && !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(reference);
}
function collectReference(value, input, dependencies, diagnostics, diagnosedMissing) {
  if (!isLocalReference(value)) {
    return;
  }
  const decision = classifyNavigation(value, input.sourcePath);
  if (decision.kind !== "vault") {
    return;
  }
  if (input.knownVaultPaths.has(decision.path)) {
    dependencies.add(decision.path);
    return;
  }
  if (diagnosedMissing.has(decision.path)) {
    return;
  }
  diagnosedMissing.add(decision.path);
  diagnostics.push({
    code: "missing-resource",
    level: "warning",
    message: `Local resource was not found in the Vault: ${decision.path}`,
    value
  });
}
function collectDependencies(document2, input, diagnostics) {
  const dependencies = /* @__PURE__ */ new Set();
  const diagnosedMissing = /* @__PURE__ */ new Set();
  for (const [selector, attribute] of RESOURCE_SELECTORS) {
    for (const element of document2.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (value !== null) {
        collectReference(value, input, dependencies, diagnostics, diagnosedMissing);
      }
    }
  }
  for (const element of document2.querySelectorAll("[srcset]")) {
    const srcset = element.getAttribute("srcset")?.trim();
    if (!srcset || srcset.startsWith("data:")) {
      continue;
    }
    for (const candidate of srcset.split(",")) {
      const value = candidate.trim().split(/\s+/, 1)[0];
      if (value) {
        collectReference(value, input, dependencies, diagnostics, diagnosedMissing);
      }
    }
  }
  return dependencies;
}
function installBase(document2, href, diagnostics) {
  const authorBases = [...document2.querySelectorAll("base")];
  if (authorBases.length > 0) {
    diagnostics.push({
      code: "replaced-base",
      level: "warning",
      message: "The document base URL was replaced with its Vault folder."
    });
    for (const base2 of authorBases) {
      base2.remove();
    }
  }
  const base = document2.createElement("base");
  base.href = href;
  document2.head.prepend(base);
}
function installBridge(document2, renderId, cleanupRules, annotations) {
  const script = document2.createElement("script");
  script.dataset.htmlPreviewBridge = "true";
  script.textContent = createBridgeScript(renderId, cleanupRules, annotations ?? []);
  document2.head.insertBefore(script, document2.head.children[1] ?? null);
}
function buildPreviewDocument(input) {
  const diagnostics = [];
  const parser = new DOMParser();
  const document2 = parser.parseFromString(input.source, "text/html");
  if (!input.allowScripts) {
    const authorScripts = [...document2.querySelectorAll("script")];
    for (const script of authorScripts) {
      script.remove();
    }
    if (authorScripts.length > 0) {
      diagnostics.push({
        code: "scripts-disabled",
        level: "info",
        message: `Removed ${authorScripts.length} page script(s) because JavaScript is disabled.`
      });
    }
  }
  const dependencies = collectDependencies(document2, input, diagnostics);
  installBase(document2, getBaseUrl(input.resourceUrl, diagnostics), diagnostics);
  installBridge(document2, input.renderId, input.cleanupRules, input.annotations ?? []);
  return {
    dependencies,
    diagnostics,
    html: `<!doctype html>
${document2.documentElement.outerHTML}`
  };
}

// src/html-preview-view.ts
var HTML_PREVIEW_VIEW_TYPE = "html-preview";
var SANDBOX_FLAGS = "allow-scripts allow-forms allow-modals allow-popups allow-downloads";
var SCRIPT_FREE_SANDBOX_FLAGS = "allow-forms allow-modals allow-popups allow-downloads";
var nextViewId = 0;
function isNavigationMessage(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value;
  return candidate.type === NAVIGATION_MESSAGE_TYPE && typeof candidate.renderId === "string" && typeof candidate.href === "string" && candidate.href.length <= 8192;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseCleanupSelection(value) {
  if (!isRecord(value) || value.type !== CLEANUP_SELECTED_MESSAGE_TYPE) {
    return null;
  }
  return parseCleanupCandidate(value.candidate);
}
function parseUnmatchedRuleIds(value) {
  if (!isRecord(value) || value.type !== CLEANUP_UNMATCHED_MESSAGE_TYPE || !Array.isArray(value.ruleIds) || value.ruleIds.length > 500) {
    return null;
  }
  const ruleIds = value.ruleIds;
  return ruleIds.every(
    (item) => typeof item === "string" && /^[0-9a-f]{32}$/.test(item)
  ) ? ruleIds : null;
}
function parseCleanupModeState(value) {
  return isRecord(value) && value.type === CLEANUP_MODE_STATE_MESSAGE_TYPE && typeof value.enabled === "boolean" ? value.enabled : null;
}
var HtmlPreviewView = class extends import_obsidian6.FileView {
  constructor(leaf, environment) {
    super(leaf);
    this.environment = environment;
  }
  environment;
  activeRenderId = "";
  activeAnnotations = [];
  annotationSubscription = null;
  annotationViewRegistration = null;
  activeRules = [];
  suppressAnnotationRenders = 0;
  cleanupAction = null;
  cleanupMode = false;
  diagnostics = [];
  frame = null;
  viewId = `html-preview-${++nextViewId}`;
  focusSequence = 0;
  pendingFocus = /* @__PURE__ */ new Map();
  renderToken = 0;
  undoStack = [];
  unmatchedRuleIds = /* @__PURE__ */ new Set();
  unsubscribe = null;
  getViewType() {
    return HTML_PREVIEW_VIEW_TYPE;
  }
  getIcon() {
    return "file-code-2";
  }
  onload() {
    super.onload();
    this.contentEl.classList.add("html-preview-view");
    this.addAction("rotate-cw", "Reload preview", () => {
      void this.reload();
    });
    this.cleanupAction = this.addAction("eraser", "Clean up page", () => {
      this.toggleCleanupMode();
    });
    this.updateCleanupAction();
    this.addAction("undo-2", "Undo cleanup", () => {
      void this.undoCleanup();
    });
    this.addAction("list-x", "Manage cleanup rules", () => {
      this.openCleanupManager();
    });
    this.addAction("external-link", "Open outside Obsidian", () => {
      this.openCurrentExternally();
    });
    this.addAction("circle-alert", "Preview diagnostics", () => {
      new DiagnosticsModal(this.app, this.diagnostics).open();
    });
    this.registerDomEvent(window, "message", (event) => {
      void this.handleMessage(event);
    });
  }
  async onLoadFile(file) {
    await super.onLoadFile(file);
    if (this.file?.path !== file.path) {
      this.undoStack = [];
      this.setCleanupMode(false, false);
    }
    this.file = file;
    this.subscribe(file.path);
    await this.render();
  }
  async onUnloadFile(file) {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.resolvePendingFocus(false);
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.suppressAnnotationRenders = 0;
    this.unmatchedRuleIds.clear();
    this.undoStack = [];
    this.setCleanupMode(false, false);
    this.frame = null;
    this.contentEl.replaceChildren();
    if (this.file?.path === file.path) {
      this.file = null;
    }
    await super.onUnloadFile(file);
  }
  async onRename(file) {
    await super.onRename(file);
    this.file = file;
    this.undoStack = [];
    this.setCleanupMode(false, false);
    this.subscribe(file.path);
    await this.render();
  }
  onunload() {
    this.renderToken += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.resolvePendingFocus(false);
    this.activeRenderId = "";
    this.activeAnnotations = [];
    this.activeRules = [];
    this.unmatchedRuleIds.clear();
    this.undoStack = [];
    this.setCleanupMode(false, false);
    this.frame = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }
  async reload() {
    await this.render();
  }
  subscribe(sourcePath) {
    this.unsubscribe?.();
    this.annotationSubscription?.();
    this.annotationViewRegistration?.();
    this.unsubscribe = this.environment.coordinator.subscribe(
      this.viewId,
      sourcePath,
      /* @__PURE__ */ new Set(),
      () => {
        void this.render();
      }
    );
    this.annotationSubscription = this.environment.annotationService.subscribe(
      sourcePath,
      () => {
        if (this.suppressAnnotationRenders > 0) {
          this.suppressAnnotationRenders -= 1;
          return;
        }
        void this.render();
      }
    );
    this.annotationViewRegistration = this.environment.annotationService.registerView({
      beginAnnotationRepair: (id) => this.beginAnnotationRepair(id),
      removeAnnotation: (id) => this.syncRemovedAnnotation(id),
      saveAnnotation: (annotation) => this.syncSavedAnnotation(annotation),
      sourcePath,
      focusAnnotation: (id) => this.focusAnnotation(id)
    });
  }
  async render() {
    const file = this.file;
    if (!file) {
      this.showState("No HTML file is open.");
      return;
    }
    const previousScroll = this.frame?.contentWindow ? {
      x: this.frame.contentWindow.scrollX,
      y: this.frame.contentWindow.scrollY
    } : null;
    const token = ++this.renderToken;
    const renderId = this.environment.createRenderId?.() ?? createRenderId();
    const allowScripts = this.environment.getSettings().allowScripts;
    try {
      const [source, cleanupRules, annotations] = await Promise.all([
        this.app.vault.cachedRead(file),
        this.loadCleanupRules(file.path, allowScripts),
        this.environment.annotationService.load(file.path)
      ]);
      if (token !== this.renderToken || this.file?.path !== file.path) {
        return;
      }
      const result = buildPreviewDocument({
        allowScripts,
        cleanupRules,
        annotations,
        knownVaultPaths: this.environment.getKnownVaultPaths(),
        renderId,
        resourceUrl: this.app.vault.getResourcePath(file),
        source,
        sourcePath: file.path
      });
      if (token !== this.renderToken) {
        return;
      }
      const frame = document.createElement("iframe");
      frame.className = "html-preview-frame";
      frame.setAttribute(
        "sandbox",
        allowScripts ? SANDBOX_FLAGS : SCRIPT_FREE_SANDBOX_FLAGS
      );
      frame.setAttribute("title", `Preview of ${file.name}`);
      frame.srcdoc = result.html;
      this.frame = frame;
      this.activeRenderId = renderId;
      this.activeAnnotations = annotations;
      this.activeRules = cleanupRules;
      this.unmatchedRuleIds.clear();
      this.diagnostics = result.diagnostics;
      frame.addEventListener("load", () => {
        if (this.frame === frame && previousScroll && (previousScroll.x !== 0 || previousScroll.y !== 0)) {
          frame.contentWindow?.scrollTo(previousScroll.x, previousScroll.y);
        }
        if (this.frame === frame && this.cleanupMode) {
          this.postCleanupMode();
        }
      });
      this.contentEl.replaceChildren(frame);
      this.environment.coordinator.update(
        this.viewId,
        file.path,
        result.dependencies
      );
    } catch (error) {
      if (token !== this.renderToken) {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      this.diagnostics = [
        { level: "error", message: `The HTML file could not be read: ${detail}` }
      ];
      this.frame = null;
      this.activeRenderId = "";
      this.activeAnnotations = [];
      this.activeRules = [];
      this.showState("Unable to preview this HTML file");
    }
  }
  async handleMessage(event) {
    if (this.frame === null || event.source !== this.frame.contentWindow || !isRecord(event.data) || event.data.renderId !== this.activeRenderId || this.file === null) {
      return;
    }
    const candidate = parseCleanupSelection(event.data);
    if (candidate) {
      if (!this.cleanupMode) {
        return;
      }
      await this.saveCleanupRule(candidate, this.file.path, this.activeRenderId);
      return;
    }
    const annotationSave = parseAnnotationSave(event.data);
    if (annotationSave) {
      await this.saveAnnotation(annotationSave, this.file.path);
      return;
    }
    const annotationDelete = parseAnnotationDelete(event.data);
    if (annotationDelete) {
      await this.deleteAnnotation(annotationDelete);
      return;
    }
    const focusResult = parseAnnotationFocusResult(event.data);
    if (focusResult) {
      const pending = this.pendingFocus.get(focusResult.requestId);
      if (pending) {
        window.clearTimeout(pending.timeout);
        this.pendingFocus.delete(focusResult.requestId);
        pending.resolve(focusResult.found);
      }
      return;
    }
    const reanchoredAnnotation = parseReanchoredAnnotation(event.data);
    if (reanchoredAnnotation) {
      await this.persistRecoveredAnnotation(reanchoredAnnotation);
      return;
    }
    const cleanupModeState = parseCleanupModeState(event.data);
    if (cleanupModeState !== null) {
      this.setCleanupMode(cleanupModeState, false);
      return;
    }
    const unmatchedRuleIds = parseUnmatchedRuleIds(event.data);
    if (unmatchedRuleIds) {
      this.unmatchedRuleIds = new Set(unmatchedRuleIds);
      return;
    }
    if (!isNavigationMessage(event.data)) {
      return;
    }
    const decision = classifyNavigation(event.data.href, this.file.path);
    if (decision.kind === "external") {
      this.environment.openExternal(decision.url);
      return;
    }
    if (decision.kind === "vault") {
      if (!this.environment.getKnownVaultPaths().has(decision.path)) {
        this.diagnostics.push({
          level: "warning",
          message: `Linked Vault file was not found: ${decision.path}`
        });
        return;
      }
      await this.app.workspace.openLinkText(
        `${decision.path}${decision.subpath}`,
        this.file.path,
        false
      );
      return;
    }
    if (decision.kind === "blocked") {
      this.diagnostics.push({ level: "warning", message: decision.reason });
    }
  }
  async saveAnnotation(message, sourcePath) {
    const annotation = {
      ...message.annotation,
      id: message.annotation.id ?? this.environment.createAnnotationId?.() ?? createRenderId(),
      sourcePath
    };
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(sourcePath, annotation);
      this.activeAnnotations = [
        ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
        annotation
      ];
      this.postAnnotationResult(message.requestId, true, annotation);
      this.environment.showNotice(
        message.annotation.id ? "Annotation updated." : "Annotation added."
      );
    } catch (error) {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
      this.postAnnotationResult(message.requestId, false);
      this.environment.showNotice(
        `Could not save annotation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async deleteAnnotation(message) {
    const annotation = this.activeAnnotations.find(
      (item) => item.id === message.annotationId
    );
    if (!annotation) {
      this.postAnnotationResult(message.requestId, false);
      return;
    }
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.remove(annotation);
      this.activeAnnotations = this.activeAnnotations.filter(
        (item) => item.id !== annotation.id
      );
      this.postAnnotationResult(message.requestId, true);
      this.environment.showNotice("Annotation deleted.");
    } catch (error) {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
      this.postAnnotationResult(message.requestId, false);
      this.environment.showNotice(
        `Could not delete annotation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  postAnnotationResult(requestId, ok, annotation) {
    this.frame?.contentWindow?.postMessage(
      {
        ...annotation ? { annotation } : {},
        ok,
        renderId: this.activeRenderId,
        requestId,
        type: ANNOTATION_RESULT_MESSAGE_TYPE
      },
      "*"
    );
  }
  async persistRecoveredAnnotation(annotation) {
    const current = this.activeAnnotations.find((item) => item.id === annotation.id);
    if (!current || current.target.start === annotation.target.start && current.target.end === annotation.target.end && current.target.prefix === annotation.target.prefix && current.target.suffix === annotation.target.suffix) {
      return;
    }
    try {
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(annotation.sourcePath, annotation);
      this.activeAnnotations = [
        ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
        annotation
      ];
    } catch {
      if (this.suppressAnnotationRenders > 0) {
        this.suppressAnnotationRenders -= 1;
      }
    }
  }
  syncSavedAnnotation(annotation) {
    if (!this.frame?.contentWindow || !this.activeRenderId) return;
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = [
      ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
      annotation
    ];
    this.frame.contentWindow.postMessage(
      {
        annotation,
        renderId: this.activeRenderId,
        type: ANNOTATION_SYNC_SAVE_MESSAGE_TYPE
      },
      "*"
    );
  }
  syncRemovedAnnotation(id) {
    if (!this.frame?.contentWindow || !this.activeRenderId) return;
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = this.activeAnnotations.filter((item) => item.id !== id);
    this.frame.contentWindow.postMessage(
      {
        annotationId: id,
        renderId: this.activeRenderId,
        type: ANNOTATION_SYNC_DELETE_MESSAGE_TYPE
      },
      "*"
    );
  }
  async focusAnnotation(id) {
    if (!this.environment.getSettings().allowScripts || !this.frame?.contentWindow || !this.activeRenderId) return false;
    const requestId = `focus-${++this.focusSequence}`;
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        this.pendingFocus.delete(requestId);
        resolve(false);
      }, 1500);
      this.pendingFocus.set(requestId, { resolve, timeout });
      this.frame?.contentWindow?.postMessage(
        {
          annotationId: id,
          renderId: this.activeRenderId,
          requestId,
          type: ANNOTATION_FOCUS_MESSAGE_TYPE
        },
        "*"
      );
    });
  }
  beginAnnotationRepair(id) {
    if (!this.environment.getSettings().allowScripts || !this.frame?.contentWindow || !this.activeRenderId || !this.activeAnnotations.some((annotation) => annotation.id === id)) {
      return false;
    }
    this.frame.contentWindow.postMessage(
      {
        annotationId: id,
        renderId: this.activeRenderId,
        type: ANNOTATION_REPAIR_MESSAGE_TYPE
      },
      "*"
    );
    this.environment.showNotice("\u8BF7\u9009\u62E9\u65B0\u7684\u6587\u672C\u6765\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u6761\u6279\u6CE8\u3002");
    return true;
  }
  resolvePendingFocus(found) {
    for (const pending of this.pendingFocus.values()) {
      window.clearTimeout(pending.timeout);
      pending.resolve(found);
    }
    this.pendingFocus.clear();
  }
  async loadCleanupRules(sourcePath, allowScripts) {
    if (!allowScripts) {
      return [];
    }
    try {
      return await this.environment.cleanupStore.loadEffective(sourcePath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not load cleanup rules: ${detail}`);
      return [];
    }
  }
  toggleCleanupMode() {
    if (!this.environment.getSettings().allowScripts) {
      this.environment.showNotice(
        "Enable page JavaScript in HTML Preview settings to use cleanup."
      );
      return;
    }
    this.setCleanupMode(!this.cleanupMode, true);
  }
  setCleanupMode(enabled, notifyFrame) {
    this.cleanupMode = enabled;
    this.updateCleanupAction();
    if (notifyFrame) {
      this.postCleanupMode();
    }
  }
  updateCleanupAction() {
    this.cleanupAction?.classList.toggle("is-active", this.cleanupMode);
    this.cleanupAction?.setAttribute("aria-pressed", String(this.cleanupMode));
  }
  postCleanupMode() {
    if (!this.frame?.contentWindow || !this.activeRenderId) {
      return;
    }
    this.frame.contentWindow.postMessage(
      {
        enabled: this.cleanupMode,
        renderId: this.activeRenderId,
        type: CLEANUP_MODE_MESSAGE_TYPE
      },
      "*"
    );
  }
  async saveCleanupRule(candidate, sourcePath, renderId) {
    if (!this.environment.getSettings().allowScripts) {
      return;
    }
    const rule = {
      ...candidate,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      id: this.environment.createRuleId?.() ?? createRenderId(),
      scope: "file",
      sourcePath
    };
    try {
      await this.environment.cleanupStore.addFileRule(sourcePath, rule);
      if (this.file?.path !== sourcePath || this.activeRenderId !== renderId) {
        return;
      }
      this.undoStack.push(rule);
      await this.render();
    } catch (error) {
      if (this.file?.path !== sourcePath || this.activeRenderId !== renderId) {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not save the cleanup rule: ${detail}`);
      await this.render();
    }
  }
  async undoCleanup() {
    const rule = this.undoStack.pop();
    if (!rule) {
      this.environment.showNotice("There is no cleanup action to undo in this view.");
      return;
    }
    try {
      await this.environment.cleanupStore.removeRule(rule);
      await this.render();
    } catch (error) {
      this.undoStack.push(rule);
      const detail = error instanceof Error ? error.message : String(error);
      this.environment.showNotice(`Could not undo the cleanup rule: ${detail}`);
    }
  }
  openCleanupManager() {
    const sourcePath = this.file?.path;
    if (!sourcePath) {
      return;
    }
    new CleanupRulesModal(this.app, {
      onError: (message) => {
        this.environment.showNotice(`Could not update cleanup rules: ${message}`);
      },
      onPromote: async (rule) => {
        const promoted = await this.environment.cleanupStore.promoteToFolder(
          sourcePath,
          rule.id
        );
        this.undoStack = this.undoStack.map(
          (item) => item.id === promoted.id ? promoted : item
        );
        await this.render();
      },
      onReset: async () => {
        await this.environment.cleanupStore.resetFileRules(sourcePath);
        this.undoStack = this.undoStack.filter(
          (rule) => rule.scope !== "file" || rule.sourcePath !== sourcePath
        );
        await this.render();
      },
      onRestore: async (rule) => {
        await this.environment.cleanupStore.removeRule(rule);
        this.undoStack = this.undoStack.filter((item) => item.id !== rule.id);
        await this.render();
      },
      rules: this.activeRules,
      sourcePath,
      unmatchedRuleIds: this.unmatchedRuleIds
    }).open();
  }
  openCurrentExternally() {
    if (this.file) {
      this.environment.openExternal(this.app.vault.getResourcePath(this.file));
    }
  }
  showState(message) {
    const state = document.createElement("div");
    state.className = "html-preview-state";
    const text = document.createElement("p");
    text.textContent = message;
    state.append(text);
    this.contentEl.replaceChildren(state);
    this.frame = null;
  }
};
function validRequestId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}
function validAnnotationId(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}
function parseAnnotationSave(value) {
  if (!isRecord(value) || value.type !== ANNOTATION_SAVE_MESSAGE_TYPE || !validRequestId(value.requestId) || !isRecord(value.annotation)) return null;
  const annotation = value.annotation;
  const target = annotation.target;
  const color = annotationColor(annotation.color);
  if (color === null || typeof annotation.comment !== "string" || annotation.comment.length > 1e4 || typeof annotation.quote !== "string" || annotation.quote.length === 0 || annotation.quote.length > 2e4 || annotation.id !== void 0 && !validAnnotationId(annotation.id) || !isRecord(target) || !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) || typeof target.start !== "number" || typeof target.end !== "number" || target.start < 0 || target.end <= target.start || target.end > 1e7 || typeof target.exact !== "string" || target.exact !== annotation.quote || typeof target.prefix !== "string" || target.prefix.length > 256 || typeof target.suffix !== "string" || target.suffix.length > 256) return null;
  return {
    annotation: {
      color,
      comment: annotation.comment,
      ...annotation.id ? { id: annotation.id } : {},
      quote: annotation.quote,
      target: {
        end: target.end,
        exact: target.exact,
        prefix: target.prefix,
        start: target.start,
        suffix: target.suffix
      }
    },
    requestId: value.requestId
  };
}
function parseAnnotationDelete(value) {
  return isRecord(value) && value.type === ANNOTATION_DELETE_MESSAGE_TYPE && validRequestId(value.requestId) && validAnnotationId(value.annotationId) ? { annotationId: value.annotationId, requestId: value.requestId } : null;
}
function parseReanchoredAnnotation(value) {
  if (!isRecord(value) || value.type !== ANNOTATION_REANCHOR_MESSAGE_TYPE || !isRecord(value.annotation)) {
    return null;
  }
  const annotation = value.annotation;
  const target = annotation.target;
  const color = annotationColor(annotation.color);
  if (color === null || !validAnnotationId(annotation.id) || typeof annotation.sourcePath !== "string" || annotation.sourcePath.length === 0 || typeof annotation.comment !== "string" || annotation.comment.length > 1e4 || typeof annotation.quote !== "string" || annotation.quote.length === 0 || annotation.quote.length > 2e4 || !isRecord(target) || !Number.isSafeInteger(target.start) || !Number.isSafeInteger(target.end) || typeof target.start !== "number" || typeof target.end !== "number" || target.start < 0 || target.end <= target.start || target.end > 1e7 || typeof target.exact !== "string" || target.exact !== annotation.quote || typeof target.prefix !== "string" || target.prefix.length > 256 || typeof target.suffix !== "string" || target.suffix.length > 256) return null;
  return {
    color,
    comment: annotation.comment,
    id: annotation.id,
    quote: annotation.quote,
    sourcePath: annotation.sourcePath,
    target: {
      end: target.end,
      exact: target.exact,
      prefix: target.prefix,
      start: target.start,
      suffix: target.suffix
    }
  };
}
function parseAnnotationFocusResult(value) {
  return isRecord(value) && value.type === ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE && validRequestId(value.requestId) && typeof value.found === "boolean" ? { found: value.found, requestId: value.requestId } : null;
}

// src/preview/preview-coordinator.ts
var PreviewCoordinator = class {
  constructor(delayMs = 250) {
    this.delayMs = delayMs;
  }
  delayMs;
  subscriptions = /* @__PURE__ */ new Map();
  subscribe(viewId, sourcePath, dependencies, refresh) {
    this.remove(viewId);
    const subscription = {
      dependencies: new Set(dependencies),
      refresh,
      sourcePath,
      timer: null
    };
    this.subscriptions.set(viewId, subscription);
    return () => {
      if (this.subscriptions.get(viewId) === subscription) {
        this.remove(viewId);
      }
    };
  }
  update(viewId, sourcePath, dependencies) {
    const subscription = this.subscriptions.get(viewId);
    if (!subscription) {
      return;
    }
    subscription.sourcePath = sourcePath;
    subscription.dependencies = new Set(dependencies);
  }
  notify(path) {
    for (const subscription of this.subscriptions.values()) {
      if (path !== subscription.sourcePath && !subscription.dependencies.has(path)) {
        continue;
      }
      if (subscription.timer !== null) {
        clearTimeout(subscription.timer);
      }
      subscription.timer = setTimeout(() => {
        subscription.timer = null;
        subscription.refresh();
      }, this.delayMs);
    }
  }
  dispose() {
    for (const viewId of [...this.subscriptions.keys()]) {
      this.remove(viewId);
    }
  }
  remove(viewId) {
    const subscription = this.subscriptions.get(viewId);
    if (!subscription) {
      return;
    }
    if (subscription.timer !== null) {
      clearTimeout(subscription.timer);
    }
    this.subscriptions.delete(viewId);
  }
};

// src/settings.ts
var import_obsidian7 = require("obsidian");
var DEFAULT_SETTINGS = {
  allowScripts: true,
  autoEnhanced: true,
  defaultTemplateId: "book-editorial",
  defaultThemeId: "light",
  folderMappings: []
};
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeTemplateId(value) {
  return value === "minimal" ? "book-editorial" : value;
}
function normalizeMappings(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 128).filter(isRecord2).map((mapping) => ({
    folder: typeof mapping.folder === "string" ? mapping.folder.trim() : "",
    templateId: typeof mapping.templateId === "string" ? normalizeTemplateId(mapping.templateId.trim()) : "",
    themeId: typeof mapping.themeId === "string" ? mapping.themeId.trim() : void 0
  })).filter((mapping) => mapping.folder.length > 0 && mapping.templateId.length > 0);
}
function normalizeSettings(value) {
  const stored = isRecord2(value) ? value : {};
  return {
    allowScripts: typeof stored.allowScripts === "boolean" ? stored.allowScripts : true,
    autoEnhanced: typeof stored.autoEnhanced === "boolean" ? stored.autoEnhanced : true,
    defaultTemplateId: typeof stored.defaultTemplateId === "string" && stored.defaultTemplateId.length > 0 ? normalizeTemplateId(stored.defaultTemplateId) : DEFAULT_SETTINGS.defaultTemplateId,
    defaultThemeId: typeof stored.defaultThemeId === "string" && stored.defaultThemeId.length > 0 ? stored.defaultThemeId : DEFAULT_SETTINGS.defaultThemeId,
    folderMappings: normalizeMappings(stored.folderMappings)
  };
}
var HtmlPreviewSettingTab = class extends import_obsidian7.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  plugin;
  display() {
    this.containerEl.replaceChildren();
    new import_obsidian7.Setting(this.containerEl).setName("Allow page JavaScript").setDesc(
      "Enabled by default. Required for page cleanup. Scripts run in an isolated frame but can still make network requests."
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.allowScripts).onChange(async (value) => {
        this.plugin.settings.allowScripts = value;
        await this.plugin.saveSettings();
        this.plugin.refreshOpenPreviews();
      })
    );
    new import_obsidian7.Setting(this.containerEl).setName("Open Markdown in Enhanced Preview by default").setDesc("Open Markdown notes in Enhanced Preview automatically when they are opened.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoEnhanced).onChange(async (value) => {
        this.plugin.settings.autoEnhanced = value;
        await this.plugin.saveSettings();
      })
    );
    const templates = this.plugin.listMarkdownTemplates();
    this.addDefaultTemplateSetting(templates);
    this.addDefaultThemeSetting(templates);
    new import_obsidian7.Setting(this.containerEl).setName("Folder template mappings").setDesc("The most specific matching folder wins when a note has no frontmatter override.").addButton(
      (button) => button.setButtonText("Add mapping").onClick(async () => {
        this.plugin.settings.folderMappings = [
          ...this.plugin.settings.folderMappings,
          { folder: "", templateId: "book-editorial", themeId: "light" }
        ];
        await this.plugin.saveSettings();
        this.display();
      })
    );
    this.plugin.settings.folderMappings.forEach((mapping, index) => {
      const update = async (changes) => {
        this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.map(
          (current, currentIndex) => currentIndex === index ? {
            ...current,
            ...changes,
            templateId: normalizeTemplateId(changes.templateId ?? current.templateId)
          } : current
        );
        await this.plugin.saveSettings();
      };
      const row = new import_obsidian7.Setting(this.containerEl).setName(`Folder mapping ${index + 1}`).addDropdown(
        (dropdown) => {
          dropdown.addOption("", "Vault root");
          for (const folder of this.plugin.listMarkdownFolders()) {
            dropdown.addOption(folder, folder);
          }
          dropdown.setValue(mapping.folder);
          dropdown.onChange((value) => void update({ folder: value }));
        }
      ).addExtraButton(
        (button) => button.setIcon("trash").setTooltip("Remove mapping").onClick(async () => {
          this.plugin.settings.folderMappings = this.plugin.settings.folderMappings.filter(
            (_current, currentIndex) => currentIndex !== index
          );
          await this.plugin.saveSettings();
          this.display();
        })
      );
      this.addFolderTemplateSelectors(row.settingEl, mapping, templates, update);
    });
  }
  addDefaultTemplateSetting(templates) {
    const setting = new import_obsidian7.Setting(this.containerEl).setName("Default Markdown template").setDesc("Used when opening enhanced reading manually without a matching rule.");
    setting.addDropdown((dropdown) => {
      for (const template of templates) dropdown.addOption(template.id, template.name);
      dropdown.setValue(this.plugin.settings.defaultTemplateId);
      dropdown.onChange(async (value) => {
        const template = templates.find((item) => item.id === value);
        if (!template) return;
        this.plugin.settings.defaultTemplateId = template.id;
        this.plugin.settings.defaultThemeId = template.defaultTheme;
        await this.plugin.saveSettings();
        this.display();
      });
      dropdown.selectEl.dataset.defaultTemplate = "true";
    });
  }
  addDefaultThemeSetting(templates) {
    const selected = templates.find((template) => template.id === this.plugin.settings.defaultTemplateId);
    const setting = new import_obsidian7.Setting(this.containerEl).setName("Default Markdown theme");
    setting.addDropdown((dropdown) => {
      for (const themeId of selected?.themeIds ?? ["light"]) {
        dropdown.addOption(themeId, selected?.themeNames?.[themeId] ?? themeId);
      }
      dropdown.setValue(selected?.themeIds.includes(this.plugin.settings.defaultThemeId) ? this.plugin.settings.defaultThemeId : selected?.defaultTheme ?? "light");
      dropdown.onChange(async (value) => {
        this.plugin.settings.defaultThemeId = value;
        await this.plugin.saveSettings();
      });
      dropdown.selectEl.dataset.defaultTheme = "true";
    });
  }
  addFolderTemplateSelectors(setting, mapping, templates, update) {
    if (templates.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "No Markdown templates available";
      setting.append(empty);
      return;
    }
    const fallbackTemplate = templates[0];
    if (!fallbackTemplate) return;
    const selectedTemplate = templates.find((template) => template.id === mapping.templateId) ?? fallbackTemplate;
    const templateSelect = document.createElement("select");
    templateSelect.dataset.folderTemplate = "true";
    for (const template of templates) {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.append(option);
    }
    templateSelect.value = selectedTemplate.id;
    templateSelect.addEventListener("change", () => {
      const template = templates.find((item) => item.id === templateSelect.value);
      if (!template) return;
      void update({ templateId: template.id, themeId: template.defaultTheme }).then(() => {
        this.display();
      });
    });
    const themeSelect = document.createElement("select");
    themeSelect.dataset.folderTheme = "true";
    for (const themeId of selectedTemplate.themeIds) {
      const option = document.createElement("option");
      option.value = themeId;
      option.textContent = selectedTemplate.themeNames?.[themeId] ?? themeId;
      themeSelect.append(option);
    }
    themeSelect.value = selectedTemplate.themeIds.includes(mapping.themeId ?? "") ? mapping.themeId ?? selectedTemplate.defaultTheme : selectedTemplate.defaultTheme;
    themeSelect.addEventListener("change", () => {
      void update({ themeId: themeSelect.value });
    });
    setting.append(templateSelect, themeSelect);
  }
};

// src/markdown/enhanced-markdown-view.ts
var import_obsidian9 = require("obsidian");

// src/annotations/contextual-ui.ts
var COLOR_LABELS2 = {
  blue: "\u84DD\u8272",
  green: "\u7EFF\u8272",
  pink: "\u7C89\u8272",
  violet: "\u7D2B\u8272",
  yellow: "\u9EC4\u8272"
};
var lastUsedColor = "yellow";
var AnnotationContextualUi = class {
  constructor(host, callbacks) {
    this.host = host;
    this.callbacks = callbacks;
  }
  host;
  callbacks;
  surface = null;
  showSelection(selection, anchor, existing) {
    this.close();
    const initial = {
      color: existing ? annotationDisplayColor(existing) : "yellow",
      comment: existing?.comment ?? "",
      ...existing?.id ? { id: existing.id } : {},
      quote: selection.quote,
      target: selection.target
    };
    if (existing) {
      this.showEditor(initial, anchor, existing, true);
      return;
    }
    const toolbar = this.createSurface("div", "annotation-selection-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "\u9009\u4E2D\u6587\u5B57\u64CD\u4F5C");
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());
    const color = this.button("\u989C\u8272", "annotation-toolbar-button");
    const comment = this.button("\u6CE8\u91CA", "annotation-toolbar-button");
    color.addEventListener("click", () => {
      const existing2 = toolbar.querySelector(".annotation-toolbar-palette");
      if (existing2) {
        existing2.remove();
        return;
      }
      const palette = this.createPalette(existing2 ? initial.color : lastUsedColor, async (selected) => {
        lastUsedColor = selected;
        const saved = await this.save({
          ...initial,
          color: selected,
          comment: initial.comment
        });
        if (saved) this.close();
      });
      palette.classList.add("annotation-toolbar-palette");
      toolbar.append(palette);
      this.place(toolbar, anchor);
    });
    comment.addEventListener("click", () => {
      this.showEditor(
        {
          ...initial,
          color: existing ? initial.color : "yellow"
        },
        anchor,
        existing
      );
    });
    toolbar.append(color, comment);
    this.mount(toolbar, anchor);
  }
  showAnnotation(annotation, anchor) {
    this.showEditor(
      {
        color: annotationDisplayColor(annotation),
        comment: annotation.comment,
        id: annotation.id,
        quote: annotation.quote,
        target: annotation.target
      },
      anchor,
      annotation
    );
  }
  close() {
    this.surface?.remove();
    this.surface = null;
  }
  destroy() {
    this.close();
  }
  showEditor(initial, anchor, existing, repairing = false) {
    this.close();
    const draft = { ...initial };
    const editor = this.createSurface("div", "annotation-editor");
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", repairing ? "\u91CD\u65B0\u5B9A\u4F4D\u6279\u6CE8" : existing ? "\u7F16\u8F91\u6CE8\u91CA" : "\u6DFB\u52A0\u6CE8\u91CA");
    const header = document.createElement("div");
    header.className = "annotation-editor-header";
    const title = document.createElement("strong");
    title.textContent = repairing ? "\u91CD\u65B0\u5B9A\u4F4D\u6279\u6CE8" : existing ? "\u7F16\u8F91\u6CE8\u91CA" : "\u6DFB\u52A0\u6CE8\u91CA";
    const close = this.button("\xD7", "annotation-editor-close");
    close.setAttribute("aria-label", "\u5173\u95ED");
    close.addEventListener("click", () => this.close());
    header.append(title, close);
    if (repairing) {
      const hint = document.createElement("p");
      hint.className = "annotation-editor-repair-hint";
      hint.textContent = "\u5DF2\u66FF\u6362\u6458\u5F55\u4F4D\u7F6E\uFF0C\u4FDD\u5B58\u540E\u5C06\u66F4\u65B0\u8FD9\u6761\u6279\u6CE8\u3002";
      header.append(hint);
    }
    const quote = document.createElement("blockquote");
    quote.className = "annotation-editor-quote";
    quote.textContent = `\u201C${initial.quote}\u201D`;
    const palette = this.createPalette(draft.color, (selected) => {
      draft.color = selected;
      this.selectSwatch(palette, selected);
    });
    const textarea = document.createElement("textarea");
    textarea.className = "annotation-editor-comment";
    textarea.placeholder = "\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5\u2026";
    textarea.setAttribute("aria-label", "\u6CE8\u91CA\u5185\u5BB9");
    textarea.value = initial.comment;
    const actions = document.createElement("div");
    actions.className = "annotation-editor-actions";
    if (existing) {
      const remove = this.button("\u5220\u9664\u9AD8\u4EAE", "annotation-editor-delete");
      remove.addEventListener("click", () => {
        void this.remove(existing);
      });
      actions.append(remove);
    } else {
      actions.append(document.createElement("span"));
    }
    const commands = document.createElement("div");
    commands.className = "annotation-editor-commands";
    if (!existing) {
      const highlight = this.button("\u4EC5\u9AD8\u4EAE", "annotation-editor-secondary");
      highlight.addEventListener("click", () => {
        void this.saveAndClose({ ...draft, comment: "" });
      });
      commands.append(highlight);
    }
    const submit = this.button(
      existing ? "\u4FDD\u5B58\u4FEE\u6539" : "\u4FDD\u5B58\u6279\u6CE8",
      "annotation-editor-primary"
    );
    const saveComment = () => {
      void this.saveAndClose({ ...draft, comment: textarea.value.trim() });
    };
    submit.addEventListener("click", saveComment);
    commands.append(submit);
    actions.append(commands);
    editor.append(header, quote, palette, textarea, actions);
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveComment();
      }
    });
    this.mount(editor, anchor);
    textarea.focus();
  }
  createPalette(selected, onSelect) {
    const palette = document.createElement("div");
    palette.className = "annotation-color-palette";
    palette.setAttribute("aria-label", "\u9AD8\u4EAE\u989C\u8272");
    for (const color of ANNOTATION_COLORS) {
      const swatch = this.button("", "annotation-color-swatch");
      swatch.dataset.color = color;
      swatch.setAttribute("aria-label", COLOR_LABELS2[color]);
      swatch.setAttribute("aria-pressed", color === selected ? "true" : "false");
      swatch.addEventListener("click", () => {
        this.selectSwatch(palette, color);
        void onSelect(color);
      });
      palette.append(swatch);
    }
    return palette;
  }
  selectSwatch(palette, selected) {
    for (const swatch of palette.querySelectorAll("[data-color]")) {
      swatch.setAttribute(
        "aria-pressed",
        swatch.dataset.color === selected ? "true" : "false"
      );
    }
  }
  createSurface(tag, className) {
    const surface = document.createElement(tag);
    surface.className = `annotation-contextual-surface ${className}`;
    return surface;
  }
  button(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }
  mount(surface, anchor) {
    this.surface = surface;
    this.host.append(surface);
    this.place(surface, anchor);
  }
  place(surface, anchor) {
    const inset = 8;
    const gap = 10;
    const bounds = surface.getBoundingClientRect();
    const width = bounds.width || (surface.classList.contains("annotation-editor") ? 360 : 150);
    const height = bounds.height || (surface.classList.contains("annotation-editor") ? 280 : 42);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centered = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.max(inset, Math.min(centered, viewportWidth - width - inset));
    const below = anchor.bottom + gap;
    const top = below + height <= viewportHeight - inset ? below : Math.max(inset, anchor.top - height - gap);
    surface.style.left = `${Math.round(left)}px`;
    surface.style.top = `${Math.round(top)}px`;
  }
  async save(draft) {
    try {
      return await this.callbacks.onSave(draft);
    } catch {
      return false;
    }
  }
  async saveAndClose(draft) {
    if (await this.save(draft)) this.close();
  }
  async remove(annotation) {
    try {
      if (await this.callbacks.onDelete(annotation)) this.close();
    } catch {
    }
  }
};

// src/annotations/dom.ts
function textNodes(root) {
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
  const nodes = [];
  let current;
  while (current = walker.nextNode()) {
    nodes.push(current);
  }
  return nodes;
}
function visibleText(root) {
  return textNodes(root).map((node) => node.textContent ?? "").join("");
}
function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}
function normalizedText(value) {
  let text = "";
  const starts = [];
  const ends = [];
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
function matchingContext(left, right, fromEnd) {
  const limit = Math.min(left.length, right.length);
  let matched = 0;
  for (let length = 1; length <= limit; length += 1) {
    const leftPart = fromEnd ? left.slice(-length) : left.slice(0, length);
    const rightPart = fromEnd ? right.slice(-length) : right.slice(0, length);
    if (leftPart === rightPart) matched = length;
  }
  return matched;
}
function targetContextScore(fullText, start, end, target) {
  const prefix = normalize(fullText.slice(Math.max(0, start - 96), start));
  const suffix = normalize(fullText.slice(end, Math.min(fullText.length, end + 96)));
  return matchingContext(prefix, normalize(target.prefix ?? ""), true) + matchingContext(suffix, normalize(target.suffix ?? ""), false);
}
function hasContext(target) {
  return normalize(target.prefix ?? "").length > 0 || normalize(target.suffix ?? "").length > 0;
}
function resolveAnnotationTarget(fullText, target) {
  const exact = normalize(target.exact ?? "");
  if (!exact) return null;
  if (target.start >= 0 && target.end >= target.start && target.end <= fullText.length && normalize(fullText.slice(target.start, target.end)) === exact) {
    const contextLength = normalize(target.prefix ?? "").length + normalize(target.suffix ?? "").length;
    if (hasContext(target) && targetContextScore(fullText, target.start, target.end, target) === contextLength) {
      return {
        ...target,
        prefix: fullText.slice(Math.max(0, target.start - 24), target.start),
        suffix: fullText.slice(target.end, Math.min(fullText.length, target.end + 24))
      };
    }
  }
  const model = normalizedText(fullText);
  const candidates = [];
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
  candidates.sort(
    (left, right) => right.score - left.score || Math.abs(left.start - target.start) - Math.abs(right.start - target.start)
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
function isInside(root, node) {
  return node === root || root.contains(node);
}
function positionOf(root, container, offset) {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}
function captureAnnotationSelection(root, selection = window.getSelection()) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!isInside(root, range.startContainer) || !isInside(root, range.endContainer)) {
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
function applyAnnotationHighlights(root, annotations) {
  const nodes = textNodes(root);
  const fullText = visibleText(root);
  const resolvedAnnotations = annotations.map((annotation) => {
    const target = resolveAnnotationTarget(fullText, annotation.target);
    return target ? { ...annotation, target } : null;
  }).filter((annotation) => annotation !== null);
  let absoluteStart = 0;
  for (const node of nodes) {
    const length = node.textContent?.length ?? 0;
    const absoluteEnd = absoluteStart + length;
    const segments = resolvedAnnotations.map((annotation) => ({
      annotation,
      end: Math.min(length, annotation.target.end - absoluteStart),
      start: Math.max(0, annotation.target.start - absoluteStart)
    })).filter(
      ({ annotation, end, start }) => annotation.target.start < absoluteEnd && annotation.target.end > absoluteStart && start < end
    ).sort((left, right) => right.start - left.start);
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
function clearAnnotationHighlights(root) {
  for (const mark of root.querySelectorAll("mark[data-obsidian-html-preview-annotation]")) {
    mark.replaceWith(...Array.from(mark.childNodes));
  }
  root.normalize();
}
function annotationFromMark(root, target) {
  if (!(target instanceof Node)) return null;
  const element = target instanceof Element ? target : target.parentElement;
  const mark = element?.closest(
    "mark[data-obsidian-html-preview-annotation]"
  );
  return mark && root.contains(mark) ? mark.dataset.obsidianHtmlPreviewAnnotation ?? null : null;
}
function focusAnnotationMark(root, id) {
  const mark = [...root.querySelectorAll(
    "mark[data-obsidian-html-preview-annotation]"
  )].find((candidate) => candidate.dataset.obsidianHtmlPreviewAnnotation === id);
  if (!mark) return false;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("is-annotation-focus");
  window.setTimeout(() => mark.classList.remove("is-annotation-focus"), 1200);
  return true;
}

// src/markdown/render-document.ts
var import_obsidian8 = require("obsidian");

// src/markdown/css-scope.ts
function assertNoExternalResources(css) {
  if (/\@import\b/i.test(css)) {
    throw new Error("Template CSS cannot use external CSS resources");
  }
  const urls = css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi);
  for (const match of urls) {
    const value = match[2]?.trim().toLowerCase() ?? "";
    if (/^(https?:|\/\/|data:)/.test(value)) {
      throw new Error("Template CSS cannot use external CSS resources");
    }
  }
}
function splitCssBlocks(css) {
  const blocks = [];
  let start = 0;
  let headerStart = 0;
  let quote = "";
  let comment = false;
  let parentheses = 0;
  for (let index = 0; index < css.length; index += 1) {
    const character = css[index] ?? "";
    const next = css[index + 1] ?? "";
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(") {
      parentheses += 1;
      continue;
    }
    if (character === ")") {
      parentheses = Math.max(0, parentheses - 1);
      continue;
    }
    if (parentheses > 0) {
      continue;
    }
    if (character === "{") {
      let depth = 1;
      let end = index + 1;
      let nestedQuote = "";
      let nestedComment = false;
      for (; end < css.length; end += 1) {
        const nested = css[end] ?? "";
        const nestedNext = css[end + 1] ?? "";
        if (nestedComment) {
          if (nested === "*" && nestedNext === "/") {
            nestedComment = false;
            end += 1;
          }
          continue;
        }
        if (!nestedQuote && nested === "/" && nestedNext === "*") {
          nestedComment = true;
          end += 1;
          continue;
        }
        if (nestedQuote) {
          if (nested === "\\") {
            end += 1;
          } else if (nested === nestedQuote) {
            nestedQuote = "";
          }
          continue;
        }
        if (nested === "'" || nested === '"') {
          nestedQuote = nested;
        } else if (nested === "{") {
          depth += 1;
        } else if (nested === "}" && --depth === 0) {
          break;
        }
      }
      if (depth !== 0) {
        return [css];
      }
      if (headerStart < index) {
        blocks.push(css.slice(start, headerStart));
      }
      blocks.push({
        body: css.slice(index + 1, end),
        header: css.slice(headerStart, index)
      });
      start = end + 1;
      headerStart = start;
      index = end;
    }
  }
  if (start < css.length) {
    blocks.push(css.slice(start));
  }
  return blocks;
}
function splitSelectors(selectors) {
  const result = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = "";
  for (let index = 0; index < selectors.length; index += 1) {
    const character = selectors[index] ?? "";
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
    } else if (character === "'" || character === '"') quote = character;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "," && parentheses === 0 && brackets === 0) {
      result.push(selectors.slice(start, index));
      start = index + 1;
    }
  }
  result.push(selectors.slice(start));
  return result;
}
function scopeSelector(selector, rootSelector) {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed === ":root" || trimmed === "html" || trimmed === "body") {
    return rootSelector;
  }
  if (trimmed.startsWith(":root")) {
    return `${rootSelector}${trimmed.slice(5)}`;
  }
  return `${rootSelector} ${trimmed}`;
}
function scopeRules(css, rootSelector) {
  return splitCssBlocks(css).map((part) => {
    if (typeof part === "string") return part;
    const header = part.header.trim();
    if (!header) return `{${part.body}}`;
    if (/^@(?:media|supports|container|layer|document)\b/i.test(header)) {
      return `${part.header}{${scopeRules(part.body, rootSelector)}}`;
    }
    if (/^@(?:keyframes|-webkit-keyframes)\b/i.test(header)) {
      return `${part.header}{${part.body}}`;
    }
    if (header.startsWith("@")) {
      return `${part.header}{${part.body}}`;
    }
    return `${splitSelectors(part.header).map((selector) => scopeSelector(selector, rootSelector)).join(", ")}{${part.body}}`;
  }).join("");
}
function scopeTemplateCss(css, rootSelector) {
  assertNoExternalResources(css);
  if (!rootSelector.trim()) {
    throw new Error("A template CSS root selector is required");
  }
  return scopeRules(css, rootSelector);
}

// src/markdown/templates/built-in.ts
var BUILT_IN_TEMPLATE_ID = "book-editorial";
var BUILT_IN_TEMPLATE = {
  layout: `
    <article class="book-editorial-page">
      <header class="book-editorial-cover">
        <div class="book-editorial-kicker">Enhanced reading</div>
        <div class="book-editorial-title" data-slot="title"></div>
      </header>
      <div class="book-editorial-shell">
        <section class="book-editorial-properties" data-slot="properties"></section>
        <nav class="book-editorial-toc" data-slot="toc"></nav>
        <main class="book-editorial-content" data-slot="content"></main>
      </div>
    </article>`,
  manifest: {
    defaultTheme: "light",
    description: "Book-like single-column reading with a paper editorial cover.",
    id: BUILT_IN_TEMPLATE_ID,
    name: "Book Editorial",
    themes: [
      { id: "light", name: "Light paper", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark forest", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `
    * { box-sizing: border-box; }
    .book-editorial-page {
      min-height: 100%;
      overflow-x: hidden;
      background: var(--book-bg);
      color: var(--book-ink);
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      line-height: 1.72;
      -webkit-font-smoothing: antialiased;
    }
    .book-editorial-page a { color: var(--book-brass); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .book-editorial-page a:hover { color: var(--book-stamp); }
    .book-editorial-cover {
      padding: clamp(4rem, 12vw, 7.5rem) 1.5rem 4rem;
      border-bottom: 1px solid var(--book-rule);
      background: var(--book-cover);
      text-align: center;
    }
    .book-editorial-kicker,
    .book-editorial-toc::before,
    .book-editorial-properties::before {
      display: block;
      color: var(--book-brass);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: .68rem;
      font-weight: 600;
      letter-spacing: .2em;
      line-height: 1.4;
      text-transform: uppercase;
    }
    .book-editorial-kicker { margin-bottom: 1.25rem; }
    .book-editorial-title {
      max-width: 44rem;
      margin: 0 auto;
      font-size: clamp(2.15rem, 6vw, 4.2rem);
      font-weight: 600;
      letter-spacing: 0;
      line-height: 1.1;
      text-wrap: balance;
    }
    .book-editorial-shell { width: min(720px, calc(100% - 3rem)); margin: 0 auto; }
    .book-editorial-properties {
      padding: 2rem 0 1.75rem;
      border-bottom: 1px solid var(--book-rule);
    }
    .book-editorial-properties::before { content: "Properties"; margin-bottom: .8rem; }
    .book-editorial-properties dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem 1.25rem; margin: 0; font-size: .86rem; }
    .book-editorial-properties dt { color: var(--book-ink-muted); font-family: ui-monospace, monospace; font-size: .7rem; letter-spacing: .05em; text-transform: uppercase; }
    .book-editorial-properties dd { margin: 0; color: var(--book-ink); overflow-wrap: anywhere; }
    .book-editorial-toc {
      padding: 2.7rem 0 2.4rem;
      border-bottom: 1px solid var(--book-rule);
    }
    .book-editorial-toc::before { content: "Contents"; margin-bottom: 1rem; }
    .book-editorial-toc ul { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
    .book-editorial-toc li { position: relative; padding-left: 1.25rem; font-size: .92rem; }
    .book-editorial-toc li::before { position: absolute; left: 0; color: var(--book-brass); content: "\xB7"; }
    .book-editorial-toc li[data-level="1"] { padding-left: 0; font-weight: 700; }
    .book-editorial-toc li[data-level="1"]::before { content: ""; }
    .book-editorial-content { padding: 3.5rem 0 6rem; font-size: 1.04rem; }
    .book-editorial-content > :first-child { margin-top: 0; }
    .book-editorial-content h1,
    .book-editorial-content h2,
    .book-editorial-content h3,
    .book-editorial-content h4,
    .book-editorial-content h5,
    .book-editorial-content h6 { color: var(--book-ink); font-weight: 600; line-height: 1.25; text-wrap: balance; }
    .book-editorial-content h1 { margin: 0 0 1.4rem; font-size: 2.25rem; }
    .book-editorial-content h2 { margin: 3.6rem 0 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--book-rule); font-size: 1.8rem; }
    .book-editorial-content h3 { margin: 2.6rem 0 .85rem; font-size: 1.4rem; }
    .book-editorial-content h4,
    .book-editorial-content h5,
    .book-editorial-content h6 { margin: 1.8rem 0 .7rem; font-size: 1.08rem; }
    .book-editorial-content p { margin: 0 0 1.2rem; }
    .book-editorial-content > p:first-of-type::first-letter { float: left; padding: .08em .09em 0 0; color: var(--book-brass); font-size: 3.5rem; line-height: .82; }
    .book-editorial-content strong { color: var(--book-ink); font-weight: 700; }
    .book-editorial-content mark { padding: .05em .2em; background: var(--book-brass-bg); color: inherit; }
    .book-editorial-content ul,
    .book-editorial-content ol { margin: 0 0 1.35rem; padding-left: 1.45rem; }
    .book-editorial-content li { margin: .35rem 0; }
    .book-editorial-content li.task-list-item { list-style: none; margin-left: -1.35rem; }
    .book-editorial-content .task-list-item-checkbox { margin-right: .55rem; accent-color: var(--book-brass); }
    .book-editorial-content blockquote {
      margin: 1.8rem 0;
      padding: .35rem 0 .35rem 1.25rem;
      border-left: 2px solid var(--book-brass);
      color: var(--book-ink-muted);
      font-style: italic;
    }
    .book-editorial-content .callout { margin: 1.7rem 0; border: 1px solid var(--book-rule); border-left: 3px solid var(--book-brass); border-radius: 3px; background: var(--book-raised); box-shadow: none; }
    .book-editorial-content .callout-title { color: var(--book-brass); font-family: ui-monospace, monospace; font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; }
    .book-editorial-content .callout-content { color: var(--book-ink); }
    .book-editorial-content table { display: block; width: 100%; margin: 1.7rem 0; overflow-x: auto; border-collapse: collapse; font-size: .92rem; }
    .book-editorial-content th,
    .book-editorial-content td { min-width: 8rem; padding: .65rem .8rem; border-bottom: 1px solid var(--book-rule); text-align: left; vertical-align: top; }
    .book-editorial-content th { border-bottom-color: var(--book-brass); color: var(--book-brass); font-family: ui-monospace, monospace; font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; }
    .book-editorial-content pre { margin: 1.7rem 0; padding: 1.15rem 1.25rem; overflow-x: auto; border: 1px solid var(--book-rule); border-radius: 3px; background: var(--book-code-bg); color: var(--book-code-ink); font-size: .84rem; line-height: 1.6; }
    .book-editorial-content code { padding: .12em .3em; border-radius: 2px; background: var(--book-code-bg); color: var(--book-code-ink); font-family: ui-monospace, monospace; font-size: .84em; }
    .book-editorial-content pre code { padding: 0; background: transparent; color: inherit; }
    .book-editorial-content hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--book-rule); }
    .book-editorial-content img,
    .book-editorial-content .internal-embed { max-width: 100%; height: auto; }
    .book-editorial-content .internal-embed { margin: 1.5rem 0; }
    .book-editorial-content .math-block,
    .book-editorial-content mjx-container[display="true"] { margin: 1.7rem 0; overflow-x: auto; }
    .book-editorial-content .footnotes { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--book-rule); color: var(--book-ink-muted); font-size: .86rem; }
    .book-editorial-content .footnotes ol { padding-left: 1.3rem; }
    @media (max-width: 600px) {
      .book-editorial-shell { width: min(100% - 2rem, 720px); }
      .book-editorial-content { padding-top: 2.5rem; font-size: 1rem; }
      .book-editorial-title { font-size: clamp(2rem, 11vw, 3rem); }
    }
  `,
  themes: {
    light: `:root {
      color-scheme: light;
      --book-bg: #E7EAE1;
      --book-raised: #F1F3EC;
      --book-cover: #DEE3D6;
      --book-ink: #1E2420;
      --book-ink-muted: #565F56;
      --book-rule: #C6CBBD;
      --book-brass: #8C6A22;
      --book-brass-bg: rgba(140,106,34,.12);
      --book-stamp: #9C3324;
      --book-code-bg: #DDE2D6;
      --book-code-ink: #29352A;
    }`,
    dark: `:root {
      color-scheme: dark;
      --book-bg: #141813;
      --book-raised: #1C211B;
      --book-cover: #10140F;
      --book-ink: #E9E6DA;
      --book-ink-muted: #A6AC9C;
      --book-rule: #333B30;
      --book-brass: #D1A94A;
      --book-brass-bg: rgba(209,169,74,.15);
      --book-stamp: #E07A5F;
      --book-code-bg: #20281F;
      --book-code-ink: #E5E8D9;
    }`
  }
};
var MAGAZINE_RESEARCH_TEMPLATE = {
  layout: `
    <article class="magazine-research-page">
      <header class="magazine-research-masthead">
        <div class="magazine-research-index">FIELD<br>REPORT</div>
        <div class="magazine-research-title-block">
          <div class="magazine-research-kicker">Enhanced reading</div>
          <div class="magazine-research-title" data-slot="title"></div>
        </div>
      </header>
      <div class="magazine-research-information">
        <nav class="magazine-research-toc" data-slot="toc"></nav>
        <section class="magazine-research-properties" data-slot="properties"></section>
      </div>
      <main class="magazine-research-content" data-slot="content"></main>
    </article>`,
  manifest: {
    defaultTheme: "light",
    description: "Wide research-report reading with a navy masthead and coral accents.",
    id: "magazine-research",
    name: "Magazine Research",
    themes: [
      { id: "light", name: "Light paper", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark report", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `
    * { box-sizing: border-box; }
    .magazine-research-page { min-height: 100%; overflow-x: hidden; background: var(--magazine-canvas); color: var(--magazine-ink); font-family: "Iowan Old Style", "Songti SC", Palatino, Georgia, serif; line-height: 1.82; }
    .magazine-research-masthead { display: grid; grid-template-columns: 5.6rem minmax(0, 1fr); min-height: 19rem; background: var(--magazine-navy); color: var(--magazine-paper); }
    .magazine-research-index { padding: 1.6rem 1.1rem; border-right: 1px solid var(--magazine-mast-rule); color: var(--magazine-sage); font-family: ui-monospace, monospace; font-size: .66rem; font-weight: 700; letter-spacing: .14em; line-height: 1.55; }
    .magazine-research-title-block { display: flex; flex-direction: column; justify-content: flex-end; padding: 2rem clamp(1.5rem, 7vw, 5rem) 2.7rem; }
    .magazine-research-kicker, .magazine-research-toc::before, .magazine-research-properties::before { display: block; color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .66rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .magazine-research-kicker { margin-bottom: auto; }
    .magazine-research-title { max-width: 44rem; font-size: clamp(2.3rem, 6vw, 4.3rem); font-weight: 600; letter-spacing: 0; line-height: 1.08; text-wrap: balance; }
    .magazine-research-information { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(17rem, 1fr); max-width: 1100px; margin: 0 auto; border: 1px solid var(--magazine-rule); border-top: 0; background: var(--magazine-information); }
    .magazine-research-toc, .magazine-research-properties { padding: 1.5rem clamp(1.35rem, 4vw, 2.5rem); }
    .magazine-research-toc { border-right: 1px solid var(--magazine-rule); }
    .magazine-research-toc::before { content: "Contents"; margin-bottom: .8rem; }
    .magazine-research-properties::before { content: "Properties"; margin-bottom: .8rem; }
    .magazine-research-toc ul { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
    .magazine-research-toc li { padding-left: 1.25rem; font-size: .9rem; }
    .magazine-research-toc li::before { float: left; width: 1.25rem; margin-left: -1.25rem; color: var(--magazine-coral); content: "\xB7"; }
    .magazine-research-toc li[data-level="1"] { padding-left: 0; font-weight: 700; }
    .magazine-research-toc li[data-level="1"]::before { content: ""; }
    .magazine-research-properties dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem 1rem; margin: 0; font-size: .82rem; }
    .magazine-research-properties dt { color: var(--magazine-muted); font-family: ui-monospace, monospace; font-size: .66rem; letter-spacing: .06em; text-transform: uppercase; }
    .magazine-research-properties dd { margin: 0; overflow-wrap: anywhere; }
    .magazine-research-content { width: min(735px, calc(100% - 3rem)); margin: 0 auto; padding: 4rem 0 6rem; font-size: 1.05rem; }
    .magazine-research-content > :first-child { margin-top: 0; }
    .magazine-research-content h1, .magazine-research-content h2, .magazine-research-content h3, .magazine-research-content h4, .magazine-research-content h5, .magazine-research-content h6 { color: var(--magazine-ink); font-weight: 600; line-height: 1.22; text-wrap: balance; }
    .magazine-research-content h1 { margin: 0 0 1.5rem; font-size: 2.35rem; }
    .magazine-research-content h2 { margin: 3.8rem 0 1.15rem; padding-top: 1rem; border-top: 1px solid var(--magazine-rule); font-size: 1.9rem; }
    .magazine-research-content h3 { margin: 2.7rem 0 .9rem; font-size: 1.45rem; }
    .magazine-research-content h4, .magazine-research-content h5, .magazine-research-content h6 { margin: 2rem 0 .7rem; font-size: 1.08rem; }
    .magazine-research-content p { margin: 0 0 1.25rem; }
    .magazine-research-content > p:first-of-type::first-letter { float: left; padding: .08em .1em 0 0; color: var(--magazine-coral); font-size: 3.9rem; line-height: .78; }
    .magazine-research-content a { color: var(--magazine-link); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .magazine-research-content strong { color: var(--magazine-ink); }
    .magazine-research-content mark { padding: .05em .2em; background: var(--magazine-highlight); color: inherit; }
    .magazine-research-content ul, .magazine-research-content ol { margin: 0 0 1.35rem; padding-left: 1.45rem; }
    .magazine-research-content li { margin: .35rem 0; }
    .magazine-research-content li.task-list-item { list-style: none; margin-left: -1.35rem; }
    .magazine-research-content .task-list-item-checkbox { margin-right: .55rem; accent-color: var(--magazine-coral); }
    .magazine-research-content blockquote { margin: 1.9rem 0; padding: 1rem 1.25rem; border-left: 3px solid var(--magazine-sage); background: var(--magazine-raised); color: var(--magazine-muted); font-size: 1.08rem; }
    .magazine-research-content .callout { margin: 1.8rem 0; border: 1px solid var(--magazine-rule); border-left: 4px solid var(--magazine-coral); border-radius: 3px; background: var(--magazine-raised); box-shadow: none; }
    .magazine-research-content .callout-title { color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .74rem; letter-spacing: .08em; text-transform: uppercase; }
    .magazine-research-content table { display: block; width: 100%; margin: 1.8rem 0; overflow-x: auto; border-collapse: collapse; font-size: .9rem; }
    .magazine-research-content th, .magazine-research-content td { min-width: 8rem; padding: .7rem .8rem; border-bottom: 1px solid var(--magazine-rule); text-align: left; vertical-align: top; }
    .magazine-research-content th { color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .67rem; letter-spacing: .08em; text-transform: uppercase; }
    .magazine-research-content pre { margin: 1.8rem 0; padding: 1.2rem; overflow-x: auto; background: var(--magazine-code-bg); color: var(--magazine-code-ink); font-size: .84rem; line-height: 1.6; }
    .magazine-research-content code { padding: .12em .3em; background: var(--magazine-inline-code); color: var(--magazine-code-inline); font-family: ui-monospace, monospace; font-size: .84em; }
    .magazine-research-content pre code { padding: 0; background: transparent; color: inherit; }
    .magazine-research-content hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--magazine-rule); }
    .magazine-research-content img, .magazine-research-content .internal-embed { max-width: 100%; height: auto; }
    .magazine-research-content .internal-embed { margin: 1.5rem 0; }
    .magazine-research-content .math-block, .magazine-research-content mjx-container[display="true"] { margin: 1.7rem 0; overflow-x: auto; }
    .magazine-research-content .footnotes { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--magazine-rule); color: var(--magazine-muted); font-size: .86rem; }
    @media (max-width: 700px) { .magazine-research-masthead { grid-template-columns: 3.6rem minmax(0, 1fr); min-height: 15rem; } .magazine-research-index { padding: 1.25rem .7rem; font-size: .58rem; } .magazine-research-title-block { padding: 1.5rem 1.35rem 2rem; } .magazine-research-information { grid-template-columns: 1fr; } .magazine-research-toc { border-right: 0; border-bottom: 1px solid var(--magazine-rule); } .magazine-research-content { width: min(100% - 2rem, 735px); padding-top: 2.7rem; font-size: 1rem; } }
  `,
  themes: {
    light: `:root { color-scheme: light; --magazine-canvas: #DFE3DF; --magazine-paper: #FBFAF7; --magazine-navy: #15233A; --magazine-ink: #263248; --magazine-muted: #66706D; --magazine-coral: #E7654E; --magazine-sage: #A9BCA9; --magazine-information: #EFF2EC; --magazine-raised: #F4F5F0; --magazine-rule: #D4D8D0; --magazine-link: #A74A3C; --magazine-highlight: rgba(231, 101, 78, .17); --magazine-code-bg: #15233A; --magazine-code-ink: #E8EEE6; --magazine-inline-code: #E5EAE2; --magazine-code-inline: #2C514A; --magazine-mast-rule: rgba(255,255,255,.2); }`,
    dark: `:root { color-scheme: dark; --magazine-canvas: #0E151F; --magazine-paper: #151F2B; --magazine-navy: #0A111A; --magazine-ink: #E8E6DE; --magazine-muted: #B5C0B9; --magazine-coral: #F08A72; --magazine-sage: #9DB79F; --magazine-information: #17222E; --magazine-raised: #1C2935; --magazine-rule: #34444A; --magazine-link: #F3A08B; --magazine-highlight: rgba(240, 138, 114, .2); --magazine-code-bg: #0A111A; --magazine-code-ink: #E8EDE6; --magazine-inline-code: #22313C; --magazine-code-inline: #D9E7DD; --magazine-mast-rule: rgba(232,230,222,.2); }`
  }
};
var BUILT_IN_TEMPLATES = [
  BUILT_IN_TEMPLATE,
  MAGAZINE_RESEARCH_TEMPLATE
];
function builtInTemplateFor(templateId) {
  return BUILT_IN_TEMPLATES.find((template) => template.manifest.id === templateId);
}

// src/markdown/templates/types.ts
var TEMPLATE_SLOTS = [
  "content",
  "properties",
  "title",
  "toc"
];

// src/markdown/templates/validation.ts
var ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
var MAX_NAME_LENGTH = 160;
var DANGEROUS_TAGS = /* @__PURE__ */ new Set([
  "embed",
  "form",
  "iframe",
  "meta",
  "object",
  "script"
]);
var ALLOWED_SLOTS = new Set(TEMPLATE_SLOTS);
function isPlainObject2(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function boundedString(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
function isRelativeTemplatePath(value) {
  return value.length > 0 && !value.startsWith("/") && !value.startsWith("\\") && !value.startsWith("//") && !value.includes("\\") && !value.split("/").includes("..") && !/^[a-z][a-z\d+.-]*:/i.test(value);
}
function parseTheme(value) {
  if (!isPlainObject2(value)) {
    return null;
  }
  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id) || !boundedString(value.name, MAX_NAME_LENGTH) || typeof value.stylesheet !== "string" || !isRelativeTemplatePath(value.stylesheet)) {
    return null;
  }
  return { id: value.id, name: value.name, stylesheet: value.stylesheet };
}
function parseTemplateManifest(value) {
  if (!isPlainObject2(value) || value.version !== 1 || typeof value.id !== "string" || !ID_PATTERN.test(value.id) || !boundedString(value.name, MAX_NAME_LENGTH) || !Array.isArray(value.themes) || value.themes.length === 0 || value.themes.length > 32 || typeof value.defaultTheme !== "string" || !ID_PATTERN.test(value.defaultTheme)) {
    return null;
  }
  const themes = [];
  const ids = /* @__PURE__ */ new Set();
  for (const themeValue of value.themes) {
    const theme = parseTheme(themeValue);
    if (!theme || ids.has(theme.id)) {
      return null;
    }
    ids.add(theme.id);
    themes.push(theme);
  }
  if (!ids.has(value.defaultTheme)) {
    return null;
  }
  return {
    defaultTheme: value.defaultTheme,
    description: typeof value.description === "string" ? value.description : void 0,
    id: value.id,
    name: value.name,
    themes,
    version: 1
  };
}
function isSafeResourceReference(value) {
  if (value.startsWith("#")) {
    return true;
  }
  return isRelativeTemplatePath(value);
}
function validateTemplateLayout(layout) {
  if (!boundedString(layout, 2e5)) {
    return null;
  }
  const document2 = new DOMParser().parseFromString(layout, "text/html");
  const slots = /* @__PURE__ */ new Set();
  for (const element of document2.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) {
      return null;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        return null;
      }
      if (["src", "href", "action", "poster", "data"].includes(name)) {
        if (!isSafeResourceReference(attribute.value)) {
          return null;
        }
      }
      if (name === "http-equiv" && attribute.value.toLowerCase() === "refresh") {
        return null;
      }
    }
    const slot = element.getAttribute("data-slot");
    if (slot !== null) {
      if (!ALLOWED_SLOTS.has(slot) || slots.has(slot)) {
        return null;
      }
      slots.add(slot);
    }
  }
  if (!slots.has("content")) {
    return null;
  }
  return { html: layout, slots };
}
function validateTemplatePackage(files) {
  let manifestValue;
  try {
    manifestValue = JSON.parse(files.manifest);
  } catch {
    return null;
  }
  const manifest = parseTemplateManifest(manifestValue);
  const layout = validateTemplateLayout(files.layout);
  if (!manifest || !layout || typeof files.styles !== "string") {
    return null;
  }
  const themes = {};
  for (const theme of manifest.themes) {
    const stylesheet = files.themes[theme.id];
    if (typeof stylesheet !== "string") {
      return null;
    }
    themes[theme.id] = stylesheet;
  }
  return {
    layout: layout.html,
    manifest,
    styles: files.styles,
    themes
  };
}

// src/markdown/templates/catalog.ts
var MARKDOWN_TEMPLATE_ROOT = ".html-preview/markdown-templates";
function markdownTemplatePath(templateId) {
  return `${MARKDOWN_TEMPLATE_ROOT}/${templateId}`;
}
function isTemplateId(value) {
  return /^[a-z][a-z0-9-]{0,63}$/.test(value);
}
function pathJoin(root, relative) {
  return `${root}/${relative}`;
}
var MarkdownTemplateCatalog = class {
  constructor(adapter) {
    this.adapter = adapter;
  }
  adapter;
  async list() {
    const summaries = BUILT_IN_TEMPLATES.map((template) => ({
      defaultTheme: template.manifest.defaultTheme,
      description: template.manifest.description,
      id: template.manifest.id,
      name: template.manifest.name,
      themeIds: template.manifest.themes.map((theme) => theme.id),
      themeNames: Object.fromEntries(
        template.manifest.themes.map((theme) => [theme.id, theme.name])
      )
    }));
    const root = `${MARKDOWN_TEMPLATE_ROOT}/`;
    let listing;
    try {
      listing = await this.adapter.list(root);
    } catch {
      return summaries;
    }
    const ids = listing.folders.filter((folder) => folder.startsWith(root)).map((folder) => folder.slice(root.length).replace(/\/$/, "")).filter(isTemplateId).filter((id) => !builtInTemplateFor(id)).filter((id, index, values) => values.indexOf(id) === index).sort();
    for (const id of ids) {
      const packageValue = await this.loadPackage(id);
      if (!packageValue || packageValue.manifest.id !== id) {
        continue;
      }
      summaries.push({
        defaultTheme: packageValue.manifest.defaultTheme,
        description: packageValue.manifest.description,
        id,
        name: packageValue.manifest.name,
        themeIds: packageValue.manifest.themes.map((theme) => theme.id),
        themeNames: Object.fromEntries(
          packageValue.manifest.themes.map((theme) => [theme.id, theme.name])
        )
      });
    }
    return summaries;
  }
  async load(templateId) {
    const builtIn = builtInTemplateFor(templateId);
    if (builtIn) return builtIn;
    if (!isTemplateId(templateId)) {
      return BUILT_IN_TEMPLATE;
    }
    return await this.loadPackage(templateId) ?? BUILT_IN_TEMPLATE;
  }
  async loadPackage(templateId) {
    const root = markdownTemplatePath(templateId);
    try {
      const manifestText = await this.adapter.read(pathJoin(root, "template.json"));
      const manifestValue = parseTemplateManifest(JSON.parse(manifestText));
      if (!manifestValue || manifestValue.id !== templateId) {
        return null;
      }
      const themes = {};
      for (const theme of manifestValue.themes) {
        themes[theme.id] = await this.adapter.read(pathJoin(root, theme.stylesheet));
      }
      const files = {
        layout: await this.adapter.read(pathJoin(root, "layout.html")),
        manifest: manifestText,
        styles: await this.adapter.read(pathJoin(root, "styles.css")),
        themes
      };
      return validateTemplatePackage(files);
    } catch {
      return null;
    }
  }
};

// src/markdown/render-document.ts
var nextRootId = 0;
function escapeCssString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function slugify(value) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "section";
}
function sourceTitle(sourcePath) {
  const name = sourcePath.split("/").pop() ?? sourcePath;
  return name.replace(/\.md$/i, "");
}
function renderProperties(slot, frontmatter) {
  const list = document.createElement("dl");
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === "position") continue;
    const term = document.createElement("dt");
    term.textContent = key;
    const detail = document.createElement("dd");
    detail.textContent = Array.isArray(value) ? value.map((item) => String(item)).join(", ") : String(value ?? "");
    list.append(term, detail);
  }
  if (list.children.length > 0) slot.append(list);
  else slot.remove();
}
function renderToc(slot, content) {
  const headings = [...content.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  if (headings.length === 0) {
    slot.remove();
    return;
  }
  const used = /* @__PURE__ */ new Set();
  const list = document.createElement("ul");
  for (const heading of headings) {
    const base = `enhanced-heading-${slugify(heading.textContent ?? "")}`;
    let id = base;
    let suffix = 2;
    while (used.has(id) || document.getElementById(id)) {
      id = `${base}-${suffix++}`;
    }
    used.add(id);
    heading.id = id;
    const item = document.createElement("li");
    item.dataset.level = heading.tagName.slice(1);
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = heading.textContent ?? "";
    item.append(link);
    list.append(item);
  }
  slot.append(list);
}
function isLocalTemplateReference(value) {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("/") && !trimmed.startsWith("//") && !/^[a-z][a-z\d+.-]*:/i.test(trimmed);
}
function resolveTemplateAssets(root, templateId, resolveAsset, dependencies) {
  if (!resolveAsset) return;
  const packageRoot = markdownTemplatePath(templateId);
  for (const element of root.querySelectorAll("[src], [href], [poster], [data]")) {
    for (const attribute of ["src", "href", "poster", "data"]) {
      const value = element.getAttribute(attribute);
      if (!value || !isLocalTemplateReference(value)) continue;
      const path = `${packageRoot}/${value}`;
      const resolved = resolveAsset(path);
      if (resolved) {
        element.setAttribute(attribute, resolved);
        dependencies.add(path);
      }
    }
  }
}
function resolveCssAssets(css, templateId, resolveAsset, dependencies) {
  if (!resolveAsset) return css;
  const packageRoot = markdownTemplatePath(templateId);
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (full, quote, value) => {
    if (!isLocalTemplateReference(value)) return full;
    const path = `${packageRoot}/${value.trim()}`;
    const resolved = resolveAsset(path);
    if (!resolved) return full;
    dependencies.add(path);
    return `url(${quote}${resolved}${quote})`;
  });
}
async function renderEnhancedMarkdown(input) {
  const template = input.template.manifest.id ? input.template : BUILT_IN_TEMPLATE;
  const parsed = new DOMParser().parseFromString(template.layout, "text/html");
  const content = parsed.querySelector('[data-slot="content"]');
  if (!content) {
    return renderEnhancedMarkdown({ ...input, template: BUILT_IN_TEMPLATE });
  }
  const rootId = `enhanced-markdown-${++nextRootId}`;
  const rootSelector = `[data-enhanced-markdown-root="${escapeCssString(rootId)}"]`;
  input.root.classList.add("enhanced-markdown-root");
  input.root.setAttribute("data-enhanced-markdown-root", rootId);
  const dependencies = /* @__PURE__ */ new Set();
  const nodes = [...parsed.body.childNodes].map((node) => node.cloneNode(true));
  input.root.replaceChildren(...nodes);
  const contentSlot = input.root.querySelector('[data-slot="content"]');
  if (!contentSlot || !(contentSlot instanceof HTMLElement)) {
    return { dependencies, rootSelector };
  }
  const titleSlot = input.root.querySelector('[data-slot="title"]');
  if (titleSlot instanceof HTMLElement) {
    titleSlot.textContent = sourceTitle(input.sourcePath);
  }
  const propertiesSlot = input.root.querySelector('[data-slot="properties"]');
  if (propertiesSlot instanceof HTMLElement) {
    renderProperties(propertiesSlot, input.frontmatter ?? {});
  }
  await import_obsidian8.MarkdownRenderer.render(
    input.app,
    input.source,
    contentSlot,
    input.sourcePath,
    input.component
  );
  const tocSlot = input.root.querySelector('[data-slot="toc"]');
  if (tocSlot instanceof HTMLElement) renderToc(tocSlot, contentSlot);
  const themeId = input.themeId ?? template.manifest.defaultTheme;
  const theme = template.themes[themeId] ?? template.themes[template.manifest.defaultTheme] ?? "";
  const css = resolveCssAssets(`${template.styles}
${theme}`, template.manifest.id, input.resolveAsset, dependencies);
  const style = document.createElement("style");
  style.dataset.enhancedMarkdownTemplate = "true";
  style.textContent = scopeTemplateCss(css, rootSelector);
  input.root.prepend(style);
  resolveTemplateAssets(input.root, template.manifest.id, input.resolveAsset, dependencies);
  return { dependencies, rootSelector };
}

// src/markdown/enhanced-markdown-view.ts
var ENHANCED_MARKDOWN_VIEW_TYPE = "enhanced-markdown";
var nextViewId2 = 0;
var EnhancedMarkdownView = class extends import_obsidian9.FileView {
  constructor(leaf, environment) {
    super(leaf);
    this.environment = environment;
  }
  environment;
  activeAnnotations = [];
  annotationSubscription = null;
  annotationUi = null;
  annotationViewRegistration = null;
  suppressAnnotationRenders = 0;
  viewId = `enhanced-markdown-${++nextViewId2}`;
  environmentSubscription = null;
  renderComponent = null;
  renderToken = 0;
  sessionMode = "manual";
  sessionSelection = null;
  returnMode = "preview";
  pendingRepairId = null;
  getViewType() {
    return ENHANCED_MARKDOWN_VIEW_TYPE;
  }
  getIcon() {
    return "book-open-check";
  }
  getState() {
    return {
      file: this.file?.path,
      mode: this.sessionMode,
      templateId: this.sessionSelection?.templateId,
      themeId: this.sessionSelection?.themeId
    };
  }
  async setState(state) {
    if (state.mode === "automatic" || state.mode === "manual") {
      this.sessionMode = state.mode;
    }
    if (state.returnMode === "source" || state.returnMode === "preview") {
      this.returnMode = state.returnMode;
    }
    if (state.templateId && state.themeId) {
      this.sessionSelection = {
        source: "default",
        templateId: state.templateId,
        themeId: state.themeId
      };
    }
    const path = typeof state.file === "string" ? state.file : void 0;
    const nextFile = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (nextFile instanceof import_obsidian9.TFile || nextFile) {
      await this.onLoadFile(nextFile);
    }
  }
  onload() {
    super.onload();
    this.contentEl.classList.add("enhanced-markdown-view");
    this.addAction("file-text", "Markdown", () => {
      void this.openMarkdownMarkdown();
    });
    this.addAction("palette", "Template & theme", () => {
      if (this.file) void this.environment.onSwitchTemplate?.(this.file.path);
    });
    this.annotationUi = new AnnotationContextualUi(this.contentEl, {
      onDelete: (annotation) => this.deleteAnnotation(annotation),
      onSave: (draft) => this.saveAnnotation(draft)
    });
    this.registerDomEvent(this.contentEl, "mouseup", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".annotation-contextual-surface")) {
        this.showSelectionUi();
      }
    });
    this.registerDomEvent(this.contentEl, "keyup", (event) => {
      if (event.key === "Shift" || event.key.startsWith("Arrow")) {
        this.showSelectionUi();
      }
    });
    this.registerDomEvent(this.contentEl, "click", (event) => {
      this.openExistingAnnotation(event);
    });
  }
  async onLoadFile(file) {
    await super.onLoadFile(file);
    this.file = file;
    this.annotationUi?.close();
    this.subscribe(file.path);
    await this.render();
  }
  async onUnloadFile(file) {
    this.renderToken += 1;
    this.environmentSubscription?.();
    this.environmentSubscription = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.activeAnnotations = [];
    this.pendingRepairId = null;
    this.annotationUi?.close();
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    if (this.file?.path === file.path) this.file = null;
    await super.onUnloadFile(file);
  }
  async onRename(file) {
    await super.onRename(file);
    this.file = file;
    this.annotationUi?.close();
    this.subscribe(file.path);
    await this.render();
  }
  async openMarkdownMarkdown() {
    if (!this.file) return;
    this.environment.onReturnToMarkdown?.(this.file.path);
    await this.leaf.setViewState(
      { type: "markdown", state: { file: this.file.path, mode: this.returnMode } },
      { history: true }
    );
  }
  onunload() {
    this.renderToken += 1;
    this.environmentSubscription?.();
    this.environmentSubscription = null;
    this.annotationSubscription?.();
    this.annotationSubscription = null;
    this.annotationViewRegistration?.();
    this.annotationViewRegistration = null;
    this.activeAnnotations = [];
    this.pendingRepairId = null;
    this.annotationUi?.destroy();
    this.annotationUi = null;
    this.renderComponent?.unload();
    this.renderComponent = null;
    this.contentEl.replaceChildren();
    super.onunload();
  }
  subscribe(sourcePath) {
    this.environmentSubscription?.();
    this.annotationSubscription?.();
    this.annotationViewRegistration?.();
    this.environmentSubscription = this.environment.coordinator.subscribe(
      this.viewId,
      sourcePath,
      /* @__PURE__ */ new Set(),
      () => {
        void this.render();
      }
    );
    this.annotationSubscription = this.environment.annotationService.subscribe(
      sourcePath,
      () => {
        if (this.suppressAnnotationRenders > 0) {
          this.suppressAnnotationRenders -= 1;
          return;
        }
        void this.render();
      }
    );
    this.annotationViewRegistration = this.environment.annotationService.registerView({
      removeAnnotation: (id) => this.syncRemovedAnnotation(id),
      saveAnnotation: (annotation) => this.syncSavedAnnotation(annotation),
      beginAnnotationRepair: (id) => this.beginAnnotationRepair(id),
      sourcePath,
      focusAnnotation: (id) => Promise.resolve(this.focusAnnotation(id))
    });
  }
  async render() {
    const file = this.file;
    if (!file) return;
    const token = ++this.renderToken;
    this.annotationUi?.close();
    const frontmatter = this.environment.getFrontmatter(file);
    const selection = this.sessionSelection ?? this.environment.resolveTemplate(file.path, frontmatter, this.sessionMode);
    if (!selection) {
      this.showState("No enhanced Markdown template matches this note.");
      return;
    }
    try {
      const [source, template, annotations] = await Promise.all([
        this.app.vault.cachedRead(file),
        this.environment.loadTemplate(selection.templateId),
        this.environment.annotationService.load(file.path)
      ]);
      if (token !== this.renderToken || this.file?.path !== file.path) return;
      const root = document.createElement("article");
      root.className = "enhanced-markdown-document";
      const component = new import_obsidian9.Component();
      const result = await renderEnhancedMarkdown({
        app: this.app,
        component,
        frontmatter: typeof frontmatter === "object" && frontmatter !== null ? frontmatter : void 0,
        resolveAsset: this.environment.resolveAsset,
        root,
        source,
        sourcePath: file.path,
        template,
        themeId: selection.themeId
      });
      if (token !== this.renderToken || this.file?.path !== file.path) {
        component.unload();
        return;
      }
      const content = root.querySelector('[data-slot="content"]');
      let resolvedAnnotations = annotations;
      if (content instanceof HTMLElement) {
        resolvedAnnotations = applyAnnotationHighlights(content, annotations);
      }
      this.renderComponent?.unload();
      this.renderComponent = component;
      this.activeAnnotations = [...annotations];
      this.contentEl.replaceChildren(root);
      this.environment.coordinator.update(this.viewId, file.path, result.dependencies);
      await this.persistRecoveredTargets(file.path, annotations, resolvedAnnotations);
    } catch (error) {
      if (token !== this.renderToken || this.file?.path !== file.path) return;
      this.showState(
        `Unable to render enhanced Markdown: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  showState(message) {
    const state = document.createElement("p");
    state.className = "enhanced-markdown-state";
    state.textContent = message;
    this.contentEl.replaceChildren(state);
  }
  contentRoot() {
    const content = this.contentEl.querySelector('[data-slot="content"]');
    return content instanceof HTMLElement ? content : null;
  }
  captureCurrentSelection() {
    const content = this.contentRoot();
    return content ? captureAnnotationSelection(content, window.getSelection()) : null;
  }
  async persistRecoveredTargets(sourcePath, original, resolved) {
    for (const annotation of resolved) {
      const previous = original.find((candidate) => candidate.id === annotation.id);
      if (!previous || previous.target.start === annotation.target.start && previous.target.end === annotation.target.end && previous.target.prefix === annotation.target.prefix && previous.target.suffix === annotation.target.suffix) {
        continue;
      }
      this.suppressAnnotationRenders += 1;
      await this.environment.annotationService.save(sourcePath, annotation);
    }
  }
  focusAnnotation(id) {
    const content = this.contentRoot();
    return content ? focusAnnotationMark(content, id) : false;
  }
  beginAnnotationRepair(id) {
    if (!this.file || !this.contentRoot() || !this.activeAnnotations.some((annotation) => annotation.id === id)) {
      return false;
    }
    this.pendingRepairId = id;
    this.annotationUi?.close();
    this.environment.showNotice("\u8BF7\u9009\u62E9\u65B0\u7684\u6587\u672C\u6765\u91CD\u65B0\u5B9A\u4F4D\u8FD9\u6761\u6279\u6CE8\u3002");
    return true;
  }
  syncSavedAnnotation(annotation) {
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = [
      ...this.activeAnnotations.filter((item) => item.id !== annotation.id),
      annotation
    ];
    this.renderActiveAnnotations();
  }
  syncRemovedAnnotation(id) {
    this.suppressAnnotationRenders += 1;
    this.activeAnnotations = this.activeAnnotations.filter((item) => item.id !== id);
    this.renderActiveAnnotations();
  }
  renderActiveAnnotations() {
    const content = this.contentRoot();
    if (!content) return;
    clearAnnotationHighlights(content);
    const resolved = applyAnnotationHighlights(content, this.activeAnnotations);
    const targets = new Map(resolved.map((annotation) => [annotation.id, annotation.target]));
    this.activeAnnotations = this.activeAnnotations.map((annotation) => {
      const target = targets.get(annotation.id);
      return target ? { ...annotation, target } : annotation;
    });
  }
  showSelectionUi() {
    const selection = this.captureCurrentSelection();
    const nativeSelection = window.getSelection();
    if (!selection || !nativeSelection || nativeSelection.rangeCount === 0) return;
    const range = nativeSelection.getRangeAt(0);
    const anchor = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : new DOMRect();
    const repair = this.pendingRepairId ? this.activeAnnotations.find((annotation) => annotation.id === this.pendingRepairId) : void 0;
    this.annotationUi?.showSelection(selection, anchor, repair);
  }
  openExistingAnnotation(event) {
    const content = this.contentRoot();
    if (!content || event.target instanceof Element && event.target.closest(".annotation-contextual-surface")) return;
    const id = annotationFromMark(content, event.target);
    const annotation = this.activeAnnotations.find((item) => item.id === id);
    if (!annotation) return;
    const target = event.target instanceof Element ? event.target.closest("mark[data-obsidian-html-preview-annotation]") : null;
    this.annotationUi?.showAnnotation(
      annotation,
      target?.getBoundingClientRect() ?? new DOMRect()
    );
  }
  async saveAnnotation(draft) {
    const sourcePath = this.file?.path;
    if (!sourcePath) return false;
    try {
      await this.environment.annotationService.save(sourcePath, {
        ...draft,
        id: draft.id ?? this.environment.createAnnotationId?.() ?? createRenderId(),
        sourcePath
      });
      if (draft.id && draft.id === this.pendingRepairId) this.pendingRepairId = null;
      window.getSelection()?.removeAllRanges();
      this.environment.showNotice(draft.id ? "Annotation updated." : "Annotation added.");
      return true;
    } catch (error) {
      this.environment.showNotice(
        `Could not save annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
  async deleteAnnotation(annotation) {
    try {
      await this.environment.annotationService.remove(annotation);
      this.environment.showNotice("Annotation deleted.");
      return true;
    } catch (error) {
      this.environment.showNotice(
        `Could not delete annotation: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
};

// src/markdown/rules.ts
var TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
var MAX_FOLDER_MAPPINGS = 128;
function isTemplateId2(value) {
  return typeof value === "string" && TEMPLATE_ID_PATTERN.test(value);
}
function normalizeVaultPath(path) {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) {
    return null;
  }
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("/") : null;
}
function folderForPath(path) {
  const normalized = normalizeVaultPath(path);
  if (!normalized) {
    return null;
  }
  const separator = normalized.lastIndexOf("/");
  return separator === -1 ? "" : normalized.slice(0, separator);
}
function readFrontmatterSelection(frontmatter) {
  if (typeof frontmatter !== "object" || frontmatter === null || Array.isArray(frontmatter)) {
    return { templateId: void 0, themeId: void 0 };
  }
  const values = frontmatter;
  const nested = values["html-preview"];
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    const config = nested;
    return { templateId: config.template, themeId: config.theme };
  }
  return {
    templateId: values["html-preview.template"],
    themeId: values["html-preview.theme"]
  };
}
function selectionFor(source, templateId, themeId, settings, available) {
  if (!isTemplateId2(templateId) || !available.has(templateId)) {
    return null;
  }
  return {
    source,
    templateId,
    themeId: isTemplateId2(themeId) ? themeId : settings.defaultThemeId
  };
}
function resolveMarkdownTemplate(sourcePath, frontmatter, settings, available, mode) {
  const frontmatterSelection = readFrontmatterSelection(frontmatter);
  const fromFrontmatter = selectionFor(
    "frontmatter",
    frontmatterSelection.templateId,
    frontmatterSelection.themeId,
    settings,
    available
  );
  if (fromFrontmatter) {
    return fromFrontmatter;
  }
  const folder = folderForPath(sourcePath);
  if (folder !== null) {
    let best = null;
    for (const mapping of settings.folderMappings.slice(0, MAX_FOLDER_MAPPINGS)) {
      const mappedFolder = normalizeVaultPath(mapping.folder);
      if (!mappedFolder || folder !== mappedFolder && !folder.startsWith(`${mappedFolder}/`)) {
        continue;
      }
      if (!best || mappedFolder.length > best.folder.length) {
        best = mapping;
      }
    }
    if (best) {
      const fromFolder = selectionFor(
        "folder",
        best.templateId,
        best.themeId,
        settings,
        available
      );
      if (fromFolder) {
        return fromFolder;
      }
    }
  }
  if (mode === "manual") {
    return selectionFor(
      "default",
      settings.defaultTemplateId,
      settings.defaultThemeId,
      settings,
      available
    );
  }
  return null;
}

// src/markdown/template-modal.ts
var import_obsidian10 = require("obsidian");
var MarkdownTemplateModal = class extends import_obsidian10.Modal {
  constructor(app, environment) {
    super(app);
    this.environment = environment;
  }
  environment;
  onOpen() {
    this.titleEl.textContent = "Enhanced Markdown template";
    this.contentEl.replaceChildren();
    void this.populate();
  }
  onClose() {
    this.contentEl.replaceChildren();
  }
  async populate() {
    try {
      const templates = await this.environment.list();
      const fragment = document.createDocumentFragment();
      for (const template of templates) {
        const section = document.createElement("section");
        section.className = "enhanced-markdown-template-card";
        section.dataset.templateId = template.id;
        const header = document.createElement("div");
        header.className = "enhanced-markdown-template-card-header";
        const heading = document.createElement("h3");
        heading.textContent = template.name;
        header.append(heading);
        const badge = document.createElement("span");
        badge.className = "enhanced-markdown-template-badge";
        badge.textContent = template.id === "book-editorial" ? "Built-in" : "Available";
        header.append(badge);
        section.append(header);
        if (template.description) {
          const description = document.createElement("p");
          description.className = "enhanced-markdown-template-description";
          description.textContent = template.description;
          section.append(description);
        }
        const themes = document.createElement("div");
        themes.className = "enhanced-markdown-template-themes";
        for (const themeId of template.themeIds) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.templateId = template.id;
          button.dataset.themeId = themeId;
          button.textContent = template.themeNames?.[themeId] ?? themeId;
          button.title = `Use ${template.name} with ${button.textContent}`;
          button.addEventListener("click", () => {
            this.environment.onSelect({ templateId: template.id, themeId });
            this.close();
          });
          themes.append(button);
        }
        section.append(themes);
        fragment.append(section);
      }
      if (templates.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No valid Markdown templates are available.";
        fragment.append(empty);
      }
      this.contentEl.replaceChildren(fragment);
    } catch {
      const error = document.createElement("p");
      error.textContent = "Unable to load Markdown templates.";
      this.contentEl.replaceChildren(error);
    }
  }
};

// src/main.ts
var HtmlPreviewPlugin = class extends import_obsidian11.Plugin {
  coordinator = new PreviewCoordinator();
  annotationStore;
  annotationService;
  cleanupStore;
  settings = { ...DEFAULT_SETTINGS };
  markdownTemplateCatalog;
  markdownTemplateSettings = { ...DEFAULT_SETTINGS };
  markdownTemplates = [];
  knownVaultPaths = /* @__PURE__ */ new Set();
  markdownTemplateIds = /* @__PURE__ */ new Set(["book-editorial"]);
  enhancedLeaves = /* @__PURE__ */ new WeakSet();
  lastAnnotationSourcePath = null;
  nativeMarkdownPaths = /* @__PURE__ */ new WeakMap();
  async onload() {
    await this.loadSettings();
    this.rebuildPathIndex();
    this.cleanupStore = new CleanupRuleStore(
      this.app.vault.adapter,
      ({ message, path }) => {
        new import_obsidian11.Notice(`HTML Preview cleanup data error in ${path}: ${message}`);
      }
    );
    this.annotationStore = new HtmlAnnotationStore(this.app.vault.adapter);
    this.annotationService = new AnnotationService(this.annotationStore);
    this.markdownTemplateCatalog = new MarkdownTemplateCatalog(
      this.app.vault.adapter
    );
    this.markdownTemplates = await this.markdownTemplateCatalog.list();
    this.markdownTemplateIds = new Set(this.markdownTemplates.map((template) => template.id));
    this.markdownTemplateSettings = this.settings;
    this.registerView(
      ANNOTATION_SIDEBAR_VIEW_TYPE,
      (leaf) => new AnnotationSidebarView(leaf, {
        annotationService: this.annotationService,
        exportAnnotations: (sourcePath, annotations) => this.exportAnnotations(sourcePath, annotations),
        repairAnnotation: (sourcePath, id) => this.annotationService.beginAnnotationRepair(sourcePath, id),
        searchAnnotations: () => this.openAnnotationSearch(),
        focusAnnotation: (sourcePath, id) => this.focusAnnotation(sourcePath, id),
        removeAnnotation: (annotation) => this.annotationService.remove(annotation),
        saveAnnotation: (sourcePath, annotation) => this.annotationService.save(sourcePath, annotation),
        copyText: async (text) => {
          await navigator.clipboard.writeText(text);
          new import_obsidian11.Notice("\u5DF2\u590D\u5236\u6458\u5F55\u548C\u6279\u6CE8");
        },
        showNotice: (message) => new import_obsidian11.Notice(message)
      })
    );
    this.registerView(
      ENHANCED_MARKDOWN_VIEW_TYPE,
      (leaf) => new EnhancedMarkdownView(leaf, {
        annotationService: this.annotationService,
        coordinator: this.coordinator,
        createAnnotationId: () => createRenderId(),
        getFrontmatter: (file) => this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {},
        loadTemplate: (templateId) => this.markdownTemplateCatalog.load(templateId),
        onReturnToMarkdown: (path) => {
          this.nativeMarkdownPaths.set(leaf, path);
        },
        onSwitchTemplate: (path) => {
          this.openTemplateChooser(path);
        },
        resolveAsset: (path) => {
          const file = this.app.vault.getAbstractFileByPath(path);
          return file instanceof import_obsidian11.TFile ? this.app.vault.getResourcePath(file) : null;
        },
        resolveTemplate: (path, frontmatter, mode) => resolveMarkdownTemplate(
          path,
          frontmatter,
          this.markdownTemplateSettings,
          this.markdownTemplateIds,
          mode
        ),
        showNotice: (message) => {
          new import_obsidian11.Notice(message);
        }
      })
    );
    this.registerView(
      HTML_PREVIEW_VIEW_TYPE,
      (leaf) => new HtmlPreviewView(leaf, {
        annotationService: this.annotationService,
        cleanupStore: this.cleanupStore,
        coordinator: this.coordinator,
        createAnnotationId: () => createRenderId(),
        getKnownVaultPaths: () => this.knownVaultPaths,
        getSettings: () => this.settings,
        openExternal: (url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        },
        showNotice: (message) => {
          new import_obsidian11.Notice(message);
        }
      })
    );
    this.registerExtensions(["html", "htm"], HTML_PREVIEW_VIEW_TYPE);
    this.addSettingTab(new HtmlPreviewSettingTab(this.app, this));
    this.addCommand({
      id: "open-enhanced-markdown-reading",
      name: "Open enhanced Markdown reading",
      callback: () => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const file = leaf?.view?.file;
        if (file instanceof import_obsidian11.TFile) void this.openEnhancedMarkdown(file.path, "manual");
      }
    });
    this.addCommand({
      id: "search-vault-annotations",
      name: "Search annotations across the Vault",
      callback: () => this.openAnnotationSearch()
    });
    this.addCommand({
      id: "open-annotation-sidebar",
      name: "Open annotation sidebar",
      callback: () => {
        void this.openAnnotationSidebar();
      }
    });
    if (typeof this.app.workspace.on === "function") {
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", (leaf) => {
          this.installMarkdownAction(leaf);
          void this.maybeAutoOpen(leaf);
          void this.updateAnnotationSidebars(leaf);
        })
      );
      this.registerEvent(
        this.app.workspace.on("file-open", () => {
          void this.maybeAutoOpen(this.app.workspace.activeLeaf);
          void this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
        })
      );
    }
    this.app.workspace.onLayoutReady?.(() => {
      void this.restoreAnnotationSidebar();
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian11.TFile) {
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof import_obsidian11.TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof import_obsidian11.TFile) {
          this.knownVaultPaths.delete(file.path);
          this.coordinator.notify(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.knownVaultPaths.delete(oldPath);
        this.coordinator.notify(oldPath);
        if (file instanceof import_obsidian11.TFile) {
          this.knownVaultPaths.add(file.path);
          this.coordinator.notify(file.path);
          if (isHtmlPath(oldPath) || isHtmlPath(file.path)) {
            void this.cleanupStore.migrateFile(oldPath, file.path).catch((error) => {
              const detail = error instanceof Error ? error.message : String(error);
              new import_obsidian11.Notice(`Could not migrate HTML cleanup rules: ${detail}`);
            });
          }
        }
      })
    );
  }
  onunload() {
    this.coordinator.dispose();
  }
  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData());
    this.markdownTemplateSettings = this.settings;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  listMarkdownTemplates() {
    return this.markdownTemplates;
  }
  listMarkdownFolders() {
    return this.app.vault.getAllFolders().map((folder) => folder.path).filter((path) => path.length > 0).sort((left, right) => left.localeCompare(right));
  }
  refreshOpenPreviews() {
    for (const file of this.app.vault.getFiles()) {
      if (file.extension === "html" || file.extension === "htm") {
        this.coordinator.notify(file.path);
      }
    }
  }
  async restoreAnnotationSidebar() {
    if (this.app.workspace.getLeavesOfType(ANNOTATION_SIDEBAR_VIEW_TYPE).length > 0) {
      await this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
      return;
    }
    await this.openAnnotationSidebar(false);
  }
  async openAnnotationSidebar(reveal = true) {
    const existing = this.app.workspace.getLeavesOfType(
      ANNOTATION_SIDEBAR_VIEW_TYPE
    )[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new import_obsidian11.Notice("\u65E0\u6CD5\u6253\u5F00\u6CE8\u91CA\u4FA7\u680F\u3002");
      return;
    }
    if (!existing) {
      await leaf.setViewState({ type: ANNOTATION_SIDEBAR_VIEW_TYPE, active: reveal });
    }
    if (reveal) await this.app.workspace.revealLeaf(leaf);
    await this.updateAnnotationSidebars(this.app.workspace.activeLeaf);
  }
  async updateAnnotationSidebars(activeLeaf) {
    const file = activeLeaf?.view?.file;
    const extension = file instanceof import_obsidian11.TFile ? file.extension.toLowerCase() : "";
    let sourcePath = file instanceof import_obsidian11.TFile && (extension === "html" || extension === "htm" || extension === "md") ? file.path : null;
    if (sourcePath) {
      this.lastAnnotationSourcePath = sourcePath;
    } else if (activeLeaf?.view?.getViewType?.() === ANNOTATION_SIDEBAR_VIEW_TYPE) {
      sourcePath = this.lastAnnotationSourcePath;
    } else {
      sourcePath = this.lastAnnotationSourcePath;
    }
    for (const leaf of this.app.workspace.getLeavesOfType?.(
      ANNOTATION_SIDEBAR_VIEW_TYPE
    ) ?? []) {
      const view = leaf.view;
      if (view instanceof AnnotationSidebarView) await view.setSource(sourcePath);
    }
  }
  async focusAnnotation(sourcePath, id) {
    if (await this.annotationService.focus(sourcePath, id)) return true;
    if (!sourcePath.toLowerCase().endsWith(".md")) return false;
    const leaf = this.app.workspace.getMostRecentLeaf();
    await this.openEnhancedMarkdown(sourcePath, "manual", leaf);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    return this.annotationService.focus(sourcePath, id);
  }
  rebuildPathIndex() {
    this.knownVaultPaths.clear();
    for (const file of this.app.vault.getFiles()) {
      this.knownVaultPaths.add(file.path);
    }
  }
  installMarkdownAction(leaf) {
    const view = leaf?.view;
    if (!view || view.getViewType?.() !== "markdown" || this.enhancedLeaves.has(view)) {
      return;
    }
    this.enhancedLeaves.add(view);
    view.addAction?.("book-open-check", "Enhanced reading", () => {
      const file = view.file;
      if (file instanceof import_obsidian11.TFile) void this.openEnhancedMarkdown(file.path, "manual", leaf);
    });
  }
  async maybeAutoOpen(leaf) {
    if (!this.settings.autoEnhanced || !leaf?.view || leaf.view.getViewType?.() !== "markdown") {
      return;
    }
    const file = leaf.view.file;
    if (!(file instanceof import_obsidian11.TFile)) return;
    if (this.nativeMarkdownPaths.get(leaf) === file.path) return;
    this.nativeMarkdownPaths.delete(leaf);
    const frontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {};
    const selection = resolveMarkdownTemplate(
      file.path,
      frontmatter,
      this.markdownTemplateSettings,
      this.markdownTemplateIds,
      "automatic"
    ) ?? (this.settings.autoEnhanced ? resolveMarkdownTemplate(
      file.path,
      frontmatter,
      this.markdownTemplateSettings,
      this.markdownTemplateIds,
      "manual"
    ) : null);
    if (selection) {
      const returnMode = leaf.view.getMode?.() === "source" ? "source" : "preview";
      await leaf.setViewState(
        {
          type: ENHANCED_MARKDOWN_VIEW_TYPE,
          state: {
            file: file.path,
            mode: "automatic",
            returnMode,
            templateId: selection.templateId,
            themeId: selection.themeId
          }
        },
        { history: true }
      );
    }
  }
  async openEnhancedMarkdown(sourcePath, mode, leaf = this.app.workspace.getMostRecentLeaf(), selected) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof import_obsidian11.TFile) || file.extension.toLowerCase() !== "md" || !leaf) return;
    this.nativeMarkdownPaths.delete(leaf);
    const frontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter ?? {};
    const selection = selected ? { source: "default", ...selected } : resolveMarkdownTemplate(
      sourcePath,
      frontmatter,
      this.markdownTemplateSettings,
      this.markdownTemplateIds,
      mode
    );
    if (!selection) {
      new import_obsidian11.Notice("No valid Markdown template is available for this note.");
      return;
    }
    const returnMode = leaf.view?.getMode?.() === "source" ? "source" : "preview";
    await leaf.setViewState(
      {
        type: ENHANCED_MARKDOWN_VIEW_TYPE,
        state: {
          file: sourcePath,
          mode,
          returnMode,
          templateId: selection.templateId,
          themeId: selection.themeId
        }
      },
      { history: true }
    );
  }
  openTemplateChooser(sourcePath) {
    new MarkdownTemplateModal(this.app, {
      list: () => this.markdownTemplateCatalog.list(),
      onSelect: (selection) => {
        void this.openEnhancedMarkdown(sourcePath, "manual", void 0, selection);
      }
    }).open();
  }
  async exportAnnotations(sourcePath, annotations) {
    const path = annotationExportPath(sourcePath);
    const content = exportAnnotationMarkdown(sourcePath, annotations);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian11.TFile) {
      await this.app.vault.modify(existing, content);
    } else if (existing) {
      throw new Error(`\u65E0\u6CD5\u5BFC\u51FA\u6CE8\u91CA\uFF1A\u76EE\u6807\u8DEF\u5F84\u4E0D\u662F\u6587\u4EF6\uFF1A${path}`);
    } else {
      await this.app.vault.create(path, content);
    }
    new import_obsidian11.Notice(`\u6CE8\u91CA\u5DF2\u5BFC\u51FA\u5230 ${path}`);
  }
  openAnnotationSearch() {
    new AnnotationSearchModal(this.app, {
      open: async (sourcePath, id) => {
        const file = this.app.vault.getAbstractFileByPath(sourcePath);
        if (!(file instanceof import_obsidian11.TFile)) return false;
        await this.app.workspace.openLinkText(sourcePath, "", false);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        return this.focusAnnotation(sourcePath, id);
      },
      search: (query) => this.searchAnnotations(query)
    }).open();
  }
  async searchAnnotations(query) {
    const paths = this.app.vault.getFiles().filter((file) => ["html", "htm", "md"].includes(file.extension.toLowerCase())).map((file) => file.path);
    const annotations = (await Promise.all(paths.map((path) => this.annotationService.load(path)))).flat();
    return filterAnnotations(annotations, query).sort(
      (left, right) => left.sourcePath.localeCompare(right.sourcePath) || left.target.start - right.target.start
    );
  }
};
function isHtmlPath(path) {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return extension === "html" || extension === "htm";
}
