# Contextual Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed annotation actions with polished selection popovers and a browse-first Obsidian annotation sidebar for HTML Preview and Enhanced Markdown.

**Architecture:** A shared `AnnotationService` wraps the existing JSON store, emits source-scoped changes, and routes sidebar focus requests through registered rendered-view adapters. Enhanced Markdown mounts reusable native DOM annotation controls, while sandboxed HTML Preview renders the equivalent UI inside its injected runtime and persists through a strict message protocol.

**Tech Stack:** TypeScript 6, Obsidian Plugin API, DOM Range/Selection APIs, sandboxed iframe `postMessage`, Vitest 4 with jsdom, CSS using Obsidian variables.

## Global Constraints

- Native Markdown source and native Markdown preview must never render highlights or annotation controls.
- Remove the fixed `Add annotation` and `Manage annotations` actions from both rendered views.
- Use exactly five colors: `yellow`, `green`, `blue`, `pink`, and `violet`; legacy missing colors resolve to `yellow`.
- Empty comments are valid highlight-only annotations; persisted files remain schema version 1.
- The nearby editor uses at most an 8px radius, supports light/dark themes, stays within the viewport, and becomes a bottom sheet on narrow views.
- Preserve existing user changes, especially the unrelated `package-lock.json` modification.

---

### Task 1: Backward-Compatible Annotation Model and Service

**Files:**
- Modify: `src/annotations/types.ts`
- Modify: `src/annotations/annotation-store.ts`
- Create: `src/annotations/annotation-service.ts`
- Modify: `tests/annotation-store.test.ts`
- Create: `tests/annotation-service.test.ts`

**Interfaces:**
- Produces: `AnnotationColor`, `ANNOTATION_COLORS`, `annotationColor(value)`, and `annotationDisplayColor(annotation)`.
- Produces: `AnnotationService.load(sourcePath)`, `save(sourcePath, annotation)`, `remove(annotation)`, `subscribe(sourcePath, listener)`, `registerView(adapter)`, and `focus(sourcePath, id)`.
- Produces: `AnnotationViewAdapter { sourcePath: string; focusAnnotation(id: string): Promise<boolean> }`.

- [ ] **Step 1: Write failing model/store tests**

Add tests that write a legacy annotation without `color`, write a highlight-only annotation with `color: "blue"`, upsert the same ID, and inject a JSON record with `color: "orange"`.

```ts
expect(await store.load("pages/index.html")).toEqual([
  expect.objectContaining({ color: "yellow", comment: "" })
]);
await store.saveFileAnnotation("pages/index.html", { ...annotation, color: "blue" });
await store.saveFileAnnotation("pages/index.html", { ...annotation, color: "pink" });
expect(await store.load("pages/index.html")).toHaveLength(1);
expect((await store.load("pages/index.html"))[0]?.color).toBe("pink");
```

- [ ] **Step 2: Run the store test and confirm failure**

Run: `npx vitest run tests/annotation-store.test.ts`

Expected: FAIL because `saveFileAnnotation` and normalized colors do not exist.

- [ ] **Step 3: Implement the model and store compatibility**

Add the exact public model:

```ts
export const ANNOTATION_COLORS = ["yellow", "green", "blue", "pink", "violet"] as const;
export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export function annotationColor(value: unknown): AnnotationColor | null {
  return typeof value === "string" && ANNOTATION_COLORS.includes(value as AnnotationColor)
    ? value as AnnotationColor
    : null;
}

export function annotationDisplayColor(annotation: HtmlAnnotation): AnnotationColor {
  return annotation.color ?? "yellow";
}
```

Add `color?: AnnotationColor` to `HtmlAnnotation`. Update parsing to reject an explicitly invalid color and normalize a missing color to `yellow`. Rename the ID-based store method to `saveFileAnnotation` and keep `addFileAnnotation` as a delegating compatibility alias until all current callers migrate.

- [ ] **Step 4: Write failing service tests**

Create a fake store and adapters that prove one notification per save/remove, source filtering, unregister behavior, and successful/failed focus routing:

```ts
const unsubscribe = service.subscribe("notes/a.md", listener);
await service.save("notes/a.md", annotation);
expect(listener).toHaveBeenCalledOnce();
const unregister = service.registerView({
  sourcePath: "notes/a.md",
  focusAnnotation: vi.fn(async (id) => id === annotation.id)
});
expect(await service.focus("notes/a.md", annotation.id)).toBe(true);
unregister();
unsubscribe();
```

- [ ] **Step 5: Run the service test and confirm failure**

Run: `npx vitest run tests/annotation-service.test.ts`

Expected: FAIL because `AnnotationService` does not exist.

- [ ] **Step 6: Implement `AnnotationService`**

Use source-keyed listener sets and adapter sets. `save` delegates to `store.saveFileAnnotation`, `remove` delegates to `store.removeAnnotation`, and each successful mutation emits once. `focus` tries registered adapters for the exact source path newest-first and returns true on the first successful adapter.

- [ ] **Step 7: Verify and commit Task 1**

Run: `npx vitest run tests/annotation-store.test.ts tests/annotation-service.test.ts`

Expected: both files pass.

Commit only Task 1 files with message: `feat: add annotation colors and coordination service`.

---

### Task 2: Shared Contextual Selection UI

**Files:**
- Modify: `src/annotations/dom.ts`
- Create: `src/annotations/contextual-ui.ts`
- Create: `tests/annotation-contextual-ui.test.ts`
- Modify: `tests/enhanced-markdown-view.test.ts`

**Interfaces:**
- Consumes: `AnnotationColor`, `ANNOTATION_COLORS`, `HtmlAnnotation` from Task 1.
- Produces: `AnnotationContextualUi`, `AnnotationDraft`, `annotationFromMark(root, target)`, and `focusAnnotationMark(root, id)`.

- [ ] **Step 1: Write failing DOM and contextual UI tests**

Test these behaviors with jsdom:

```ts
const ui = new AnnotationContextualUi(host, {
  onDelete: vi.fn(),
  onSave: vi.fn(async () => true)
});
ui.showSelection(selectionDraft, new DOMRect(80, 40, 120, 20));
expect(host.querySelector('[role="toolbar"]')?.textContent).toContain("颜色");
expect(host.querySelector('[role="toolbar"]')?.textContent).toContain("注释");
```

Also assert: palette choice saves an empty comment, `注释` opens the editor focused, existing annotation opens edit mode, `Cmd/Ctrl+Enter` saves, `Escape` closes, failed save preserves textarea text, and `destroy()` removes listeners and surfaces.

- [ ] **Step 2: Run the contextual UI test and confirm failure**

Run: `npx vitest run tests/annotation-contextual-ui.test.ts`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Extend DOM helpers**

Apply colors and store annotation metadata on marks:

```ts
mark.dataset.obsidianHtmlPreviewAnnotation = annotation.id;
mark.dataset.annotationColor = annotationDisplayColor(annotation);
mark.title = annotation.comment;
```

Add `annotationFromMark` using `closest("mark[data-obsidian-html-preview-annotation]")`. Add `focusAnnotationMark` to call `scrollIntoView({ block: "center", behavior: "smooth" })`, toggle `is-annotation-focus`, and remove it after 1,200ms.

- [ ] **Step 4: Implement `AnnotationContextualUi`**

The component must create DOM through `createElement`/`setText`, never HTML string interpolation. Its constructor accepts:

```ts
interface AnnotationContextualUiCallbacks {
  onDelete(annotation: HtmlAnnotation): Promise<boolean>;
  onSave(draft: AnnotationDraft): Promise<boolean>;
}
```

`showSelection` displays the two-entry toolbar; `showAnnotation` displays the larger editor. Preserve the captured target in component state before buttons receive focus. Store the last selected color in a module-level variable initialized to `yellow`. Clamp left/top coordinates to an 8px viewport inset and flip above the anchor when required.

- [ ] **Step 5: Verify and commit Task 2**

Run: `npx vitest run tests/annotation-contextual-ui.test.ts tests/enhanced-markdown-view.test.ts`

Expected: contextual tests pass; existing Enhanced Markdown annotation tests may still fail only where they expect removed toolbar actions, which Task 3 updates.

Commit Task 2 files with message: `feat: add contextual annotation controls`.

---

### Task 3: Enhanced Markdown Selection-First Annotations

**Files:**
- Modify: `src/markdown/enhanced-markdown-view.ts`
- Modify: `tests/enhanced-markdown-view.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `AnnotationService`, `AnnotationContextualUi`, `captureAnnotationSelection`, `annotationFromMark`, and `focusAnnotationMark`.
- Produces: `EnhancedMarkdownView.focusAnnotation(id): Promise<boolean>` through service adapter registration.

- [ ] **Step 1: Replace obsolete Enhanced Markdown expectations with failing interaction tests**

Assert that actions include `Markdown` and `Template & theme` but exclude `Add annotation` and `Manage annotations`. Dispatch `mouseup` after making a Range and assert the contextual toolbar appears. Click `注释`, type a comment, save, and assert:

```ts
expect(annotationService.save).toHaveBeenCalledWith(
  "notes/example.md",
  expect.objectContaining({ color: "yellow", comment: "important note", quote: "# Note" })
);
```

Add tests for color-only save, existing mark edit, delete, selection outside rendered content, focus routing, file switch cleanup, and native Markdown return.

- [ ] **Step 2: Run the view test and confirm failure**

Run: `npx vitest run tests/enhanced-markdown-view.test.ts`

Expected: FAIL because fixed actions still exist and selection does not show the contextual UI.

- [ ] **Step 3: Integrate the contextual UI**

Replace store/prompt dependencies with `annotationService`. Remove `annotationMode`, `lastSelection`, `requestAnnotation`, `saveAnnotation`, `openAnnotationManager`, and both fixed actions. After render:

```ts
this.annotationUi = new AnnotationContextualUi(this.contentEl, callbacks);
this.registerDomEvent(content, "mouseup", () => this.showSelectionUi());
this.registerDomEvent(content, "keyup", (event) => {
  if (event.key === "Shift" || event.key.startsWith("Arrow")) this.showSelectionUi();
});
this.registerDomEvent(content, "click", (event) => this.openExistingAnnotation(event));
```

Register a service view adapter once a file is active and unregister it on file switch/unload. Refresh annotations after source-scoped service changes. Implement `focusAnnotation` with the shared DOM helper.

- [ ] **Step 4: Add Enhanced Markdown component styling**

Style `.annotation-selection-toolbar`, `.annotation-editor`, `.annotation-color-swatch`, and colored mark selectors with Obsidian variables. Ensure rendered content retains `user-select: text`, toolbar controls use `user-select: none`, radius is at most 8px, and narrow widths use a fixed bottom sheet.

- [ ] **Step 5: Verify and commit Task 3**

Run: `npx vitest run tests/enhanced-markdown-view.test.ts tests/annotation-contextual-ui.test.ts`

Expected: PASS.

Commit Task 3 files with message: `feat: enable contextual annotations in enhanced Markdown`.

---

### Task 4: HTML Preview Runtime and Message Protocol

**Files:**
- Modify: `src/annotations/runtime.ts`
- Modify: `src/html-preview-view.ts`
- Modify: `tests/annotation-runtime.test.ts`
- Modify: `tests/html-annotations.test.ts`
- Modify: `tests/html-preview-view.test.ts`

**Interfaces:**
- Consumes: `AnnotationService` and color model.
- Produces runtime messages: `annotation-save`, `annotation-delete`, `annotation-result`, and `annotation-focus` scoped by `renderId`.
- Produces: `HtmlPreviewView.focusAnnotation(id): Promise<boolean>`.

- [ ] **Step 1: Write failing runtime tests**

Evaluate the generated script in jsdom and assert: mouseup selection opens the two-entry toolbar without a request message; palette choice posts a save with empty comment and valid color; `注释` opens the full editor; clicking a mark edits the same ID; host failure leaves the editor visible; focus request scrolls/emphasizes the mark.

```ts
expect(postMessage).toHaveBeenCalledWith(
  expect.objectContaining({ type: "obsidian-html-preview:annotation-save", annotation: expect.objectContaining({ color: "green" }) }),
  "*"
);
```

- [ ] **Step 2: Write failing host protocol tests**

Replace prompt-based expectations with strict message tests. Prove that valid save/delete messages call `annotationService`, stale render IDs and wrong iframe sources are ignored, and save failures return `{ ok: false }` to the same iframe.

- [ ] **Step 3: Run the HTML annotation tests and confirm failure**

Run: `npx vitest run tests/annotation-runtime.test.ts tests/html-annotations.test.ts tests/html-preview-view.test.ts`

Expected: FAIL because the automatic runtime UI and new protocol do not exist.

- [ ] **Step 4: Implement the iframe contextual runtime**

Generate scoped style and script for a compact toolbar and nearby editor matching Task 2 semantics. Never inject comment/quote data through executable string concatenation; serialize data with `JSON.stringify` and assign UI text through `textContent`. Capture the Range before toolbar focus. Use a request ID for each save/delete so host responses resolve the correct pending UI operation.

- [ ] **Step 5: Implement and validate the host protocol**

Remove both fixed annotation actions, prompt callback, and manager modal. Parse messages with exact type checks, string limits, valid ID/color checks, target ordering, and `renderId`. Persist through `AnnotationService`, respond success/failure, and refresh active annotations through service subscription. Implement adapter focus by posting `annotation-focus` and resolving the correlated result.

- [ ] **Step 6: Verify and commit Task 4**

Run: `npx vitest run tests/annotation-runtime.test.ts tests/html-annotations.test.ts tests/html-preview-view.test.ts`

Expected: PASS.

Commit Task 4 files with message: `feat: add contextual annotations to HTML preview`.

---

### Task 5: Browse-First Annotation Sidebar

**Files:**
- Create: `src/annotations/sidebar-view.ts`
- Create: `tests/annotation-sidebar-view.test.ts`
- Modify: `src/main.ts`
- Modify: `tests/plugin.test.ts`
- Modify: `tests/mocks/obsidian.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `AnnotationService.load`, `subscribe`, and `focus`.
- Produces: `ANNOTATION_SIDEBAR_VIEW_TYPE = "html-preview-annotations"` and `AnnotationSidebarView.setSource(sourcePath, kind)`.

- [ ] **Step 1: Extend the Obsidian mock and write failing sidebar tests**

Add only the mock APIs required by production: `WorkspaceLeaf.setViewState`, `Workspace.getRightLeaf`, `Workspace.revealLeaf`, and leaf/view lookup. Test heading/count, document-order list, three filters, comment omission for highlight-only entries, empty/unrelated states, source change refresh, and unresolved focus notice.

```ts
expect(view.contentEl.querySelectorAll(".annotation-sidebar-item")).toHaveLength(3);
clickFilter("仅高亮");
expect(view.contentEl.querySelectorAll(".annotation-sidebar-item")).toHaveLength(1);
await clickFirstItem();
expect(annotationService.focus).toHaveBeenCalledWith("notes/a.md", annotation.id);
```

- [ ] **Step 2: Run the sidebar test and confirm failure**

Run: `npx vitest run tests/annotation-sidebar-view.test.ts`

Expected: FAIL because the view is missing.

- [ ] **Step 3: Implement the sidebar view**

Extend `ItemView`, return the annotations icon and Chinese display text, and render with DOM APIs. Sort by `target.start`, filter without mutating loaded data, and use a colored leading rule rather than nested cards. Each item is a button with quote and optional comment. A failed `focus` adds `is-unresolved` and calls `showNotice("无法定位这条注释，原文可能已经发生变化。")`.

- [ ] **Step 4: Register and coordinate the sidebar in the plugin**

Instantiate one `AnnotationService`, pass it to both rendered views, register `ANNOTATION_SIDEBAR_VIEW_TYPE`, and add command `open-annotation-sidebar`. On `active-leaf-change` and `file-open`, derive the active `.html`, `.htm`, or `.md` path and update all open sidebar leaves. When focus is requested from native Markdown, call `openEnhancedMarkdown`, then retry service focus after the view registers.

- [ ] **Step 5: Style the sidebar**

Use a full-width unframed list, 7px maximum item radius, subtle active/hover surfaces, color edge, two-line quote clamp, optional comment, compact filters, dark-theme-safe variables, and a restrained empty state. Do not use nested cards.

- [ ] **Step 6: Verify and commit Task 5**

Run: `npx vitest run tests/annotation-sidebar-view.test.ts tests/plugin.test.ts`

Expected: PASS.

Commit Task 5 files with message: `feat: add annotation sidebar`.

---

### Task 6: Integration, Documentation, Deployment, and Visual QA

**Files:**
- Modify: `README.md`
- Modify: `styles.css`
- Modify: affected annotation/view tests if an integration expectation needs correction
- Build outputs: `main.js`, `styles.css`, `manifest.json`

**Interfaces:**
- Consumes all earlier tasks.
- Produces the releasable plugin bundle and Vault deployment.

- [ ] **Step 1: Add cross-feature regression tests**

Assert there is a single annotation interaction system, no `window.prompt` annotation path, no fixed annotation view actions, existing JSON renders yellow, native Markdown is unaffected, cleanup controls still work in HTML Preview, and enhanced-mode switching remains intact.

- [ ] **Step 2: Run all tests and fix only observed failures**

Run: `npm test`

Expected: all test files pass with no unhandled errors.

- [ ] **Step 3: Update user documentation**

Document: select text to reveal `颜色 / 注释`; click a highlight to edit/delete; run `Open annotation sidebar`; annotations are stored under `.html-preview/annotations/pages/`; HTML interaction requires page JavaScript; native Markdown modes do not display annotations.

- [ ] **Step 4: Run static and release verification**

Run: `npm run typecheck && npm run build && npm run validate`

Expected: all commands exit 0 and release validation reports success.

- [ ] **Step 5: Perform visual QA**

Deploy the built bundle to the configured Vault plugin directory, reload Obsidian, and verify light/dark desktop plus narrow width. Exercise selection near top/bottom/left/right edges, keyboard save/cancel, long comments, all five colors, existing highlight edit/delete, sidebar filters, focus location, unresolved item, HTML Preview, and Enhanced Markdown.

- [ ] **Step 6: Commit the completed feature**

Stage only feature files and generated release files, excluding unrelated `package-lock.json` changes. Commit with message: `feat: add contextual annotation workflow`.
