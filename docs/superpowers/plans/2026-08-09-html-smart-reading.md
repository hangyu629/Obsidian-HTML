# HTML Smart Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe smart-reading preview for saved HTML, with existing cleanup rules applied before extraction and an explicit backed-up save/restore workflow.

**Architecture:** A pure extractor parses source HTML, removes elements matched by the existing cleanup locator, and passes the detached document to Mozilla Readability. A separate document builder sanitizes and wraps the article for either iframe preview or standalone persistence. A serialized store owns hidden backup ordering, while `HtmlPreviewView` only orchestrates view state, modals, annotations, and refreshes.

**Tech Stack:** TypeScript 6, Obsidian Plugin API 1.13, `@mozilla/readability` 0.6.0, DOMParser, Vitest 4 with jsdom, esbuild.

## Global Constraints

- Smart reading applies only to Vault-local `.html` and `.htm` files; Enhanced Markdown Reading remains unchanged.
- Existing cleanup rules are the only manual cleanup data and run before Readability extraction.
- Entering smart reading never writes a file; source replacement requires an explicit confirmation.
- Backups live under `.html-preview/originals/<source-path>` and an existing backup is never overwritten.
- Restoring writes the source successfully before removing the backup.
- Saved reader HTML contains no source scripts, plugin bridge, forms, frames, embedded objects, event handlers, or executable URLs.
- Annotation data remains under `.html-preview/annotations/` and is never embedded in saved HTML.
- Source writes use `Vault.modify` so Obsidian, Sync, and the preview coordinator observe them.
- The implementation remains compatible with Obsidian 1.5+ on desktop and mobile.

---

### Task 1: Extract Readable Article Content

**Files:**
- Create: `src/reader/extractor.ts`
- Create: `tests/reader-extractor.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `resolveCleanupRule(document: Document, rule: CleanupRule): Element | null` from `src/cleanup/locator.ts`.
- Produces: `extractReadableArticle(input: ReaderExtractionInput): ReaderExtractionResult`.

- [ ] **Step 1: Write failing extraction tests**

Create representative noisy HTML with more than 140 characters of article text, a matching sidebar cleanup rule, scripts, and article metadata. Assert that the result is successful, contains the article, excludes the matched sidebar, reports unmatched rule IDs, and returns `no-article` for navigation-only HTML.

```ts
const result = extractReadableArticle({
  cleanupRules: [sidebarRule, unmatchedRule],
  source: noisyArticle,
  sourcePath: "Clips/story.html"
});
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.article.title).toBe("A durable reading workflow");
  expect(result.article.content).toContain("central article sentence");
  expect(result.article.content).not.toContain("Sponsored links");
}
expect(result.unmatchedRuleIds).toEqual([unmatchedRule.id]);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/reader-extractor.test.ts`

Expected: FAIL because `src/reader/extractor.ts` does not exist.

- [ ] **Step 3: Install Readability and implement the extractor**

Run: `npm install @mozilla/readability@0.6.0`

Implement bounded, synchronous extraction. Parse into a detached document, resolve and remove cleanup matches, run `new Readability(document, { charThreshold: 140 }).parse()`, and return a typed failure when the article is null or normalized text is shorter than 120 characters.

```ts
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
  | { article: ReadableArticle; ok: true; unmatchedRuleIds: string[] }
  | { ok: false; reason: "no-article" | "too-short"; unmatchedRuleIds: string[] };

export function extractReadableArticle(input: ReaderExtractionInput): ReaderExtractionResult {
  const document = new DOMParser().parseFromString(input.source, "text/html");
  const unmatchedRuleIds: string[] = [];
  for (const rule of input.cleanupRules) {
    const match = resolveCleanupRule(document, rule);
    if (match) match.remove();
    else unmatchedRuleIds.push(rule.id);
  }
  const parsed = new Readability(document, { charThreshold: 140 }).parse();
  if (!parsed) return { ok: false, reason: "no-article", unmatchedRuleIds };
  const textContent = parsed.textContent.replace(/\s+/g, " ").trim();
  if (textContent.length < 120) {
    return { ok: false, reason: "too-short", unmatchedRuleIds };
  }
  return { article: normalizeArticle(parsed, textContent), ok: true, unmatchedRuleIds };
}
```

- [ ] **Step 4: Run extractor tests and verify GREEN**

Run: `npm test -- tests/reader-extractor.test.ts tests/cleanup-locator.test.ts`

Expected: both test files pass with no warnings.

- [ ] **Step 5: Commit the extractor**

```bash
git add package.json package-lock.json src/reader/extractor.ts tests/reader-extractor.test.ts
git commit -m "feat: extract readable HTML articles"
```

### Task 2: Build And Sanitize The Reader Document

**Files:**
- Create: `src/reader/document-builder.ts`
- Create: `tests/reader-document-builder.test.ts`

**Interfaces:**
- Consumes: `ReadableArticle` from Task 1 and `buildPreviewDocument` from `src/preview/document-builder.ts`.
- Produces: `SAVED_READER_META_NAME`, `buildStandaloneReaderPage(article, theme): string`, `buildReaderPreview(input): BuildReaderPreviewResult`, and `isSavedReaderPage(source): boolean`.

- [ ] **Step 1: Write failing document-builder tests**

Assert that standalone output contains the saved-reader marker, title, byline, responsive reader shell, semantic article content, and explicit light/dark theme. Include hostile content and verify that active elements, author styles, event attributes, `javascript:` URLs, unsafe `srcset`, and refresh metadata are absent. Assert that relative links, local images, tables, code, IDs, `aria-*`, and safe `data:image/*` images survive.

```ts
const html = buildStandaloneReaderPage(article, "dark");
expect(html).toContain('meta name="obsidian-html-reader" content="1"');
expect(html).toContain('data-reader-theme="dark"');
expect(html).toContain('src="images/chart.png"');
expect(html).not.toMatch(/<script|onclick=|javascript:|<iframe|<form/i);
expect(isSavedReaderPage(html)).toBe(true);
```

Also assert that `buildReaderPreview` adds the plugin bridge and Vault base URL only to preview output, while its returned `standaloneHtml` remains bridge-free.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/reader-document-builder.test.ts`

Expected: FAIL because the reader document builder does not exist.

- [ ] **Step 3: Implement DOM sanitization and reader HTML**

Use parsed DOM operations. Remove `script`, `style`, `link`, `iframe`, `frame`, `frameset`, `form`, `input`, `button`, `select`, `textarea`, `object`, `embed`, `applet`, `portal`, `base`, `template`, and refresh metadata. Remove `style`, `srcdoc`, every `on*` attribute, unsafe URL schemes, and unsafe `srcset` values from remaining elements. Build all metadata with DOM properties/text content, then serialize the document.

```ts
export type ReaderTheme = "light" | "dark";

export interface BuildReaderPreviewInput extends Omit<BuildPreviewInput, "allowScripts" | "cleanupRules" | "source"> {
  article: ReadableArticle;
  theme: ReaderTheme;
}

export interface BuildReaderPreviewResult extends BuildPreviewResult {
  standaloneHtml: string;
}

function sanitizeReaderContent(content: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(`<body>${content}</body>`, "text/html");
  parsed.querySelectorAll(BLOCKED_READER_SELECTOR).forEach((element) => element.remove());
  for (const element of parsed.body.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === "style" || attribute.name === "srcdoc" ||
          attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    }
    sanitizeUrlAttributes(element);
  }
  const fragment = document.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}

export function buildReaderPreview(input: BuildReaderPreviewInput): BuildReaderPreviewResult {
  const standaloneHtml = buildStandaloneReaderPage(input.article, input.theme);
  const preview = buildPreviewDocument({
    ...input,
    allowScripts: false,
    cleanupRules: [],
    source: standaloneHtml
  });
  return { ...preview, standaloneHtml };
}
```

`buildReaderPreview` must call the existing `buildPreviewDocument` with `allowScripts: false`, `cleanupRules: []`, and the standalone reader HTML. The resulting preview still contains the locally generated bridge; the persisted standalone string does not.

- [ ] **Step 4: Run reader and preview-builder tests**

Run: `npm test -- tests/reader-document-builder.test.ts tests/document-builder.test.ts tests/bridge-script.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit the reader document builder**

```bash
git add src/reader/document-builder.ts tests/reader-document-builder.test.ts
git commit -m "feat: build safe standalone reading pages"
```

### Task 3: Persist One Recoverable Original

**Files:**
- Create: `src/reader/page-store.ts`
- Create: `tests/reader-page-store.test.ts`

**Interfaces:**
- Produces: `readerBackupPath(sourcePath): string` and `ReaderPageStore` methods `hasBackup`, `save`, and `restore`.

- [ ] **Step 1: Write failing store tests**

Use an in-memory adapter and replacement spy. Cover invalid Vault paths, recursive parent creation, backup-before-source ordering, preserving an existing backup, refusing restore without a backup, retaining the backup when source replacement fails, and removing it only after a successful restore.

```ts
await store.save("Clips/page.html", "original", "reader", async (data) => {
  events.push(`source:${data}`);
});
expect(events).toEqual(["backup:original", "source:reader"]);

await store.restore("Clips/page.html", async (data) => {
  expect(adapter.files.has(readerBackupPath("Clips/page.html"))).toBe(true);
  expect(data).toBe("original");
});
expect(adapter.files.has(readerBackupPath("Clips/page.html"))).toBe(false);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/reader-page-store.test.ts`

Expected: FAIL because `ReaderPageStore` does not exist.

- [ ] **Step 3: Implement serialized backup/save/restore operations**

```ts
export interface ReaderPageStorageAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  write(path: string, data: string): Promise<void>;
}

export class ReaderPageStore {
  hasBackup(sourcePath: string): Promise<boolean>;
  save(
    sourcePath: string,
    originalSource: string,
    readerSource: string,
    replaceSource: (source: string) => Promise<void>
  ): Promise<void>;
  restore(
    sourcePath: string,
    replaceSource: (source: string) => Promise<void>
  ): Promise<void>;
}

async save(sourcePath, originalSource, readerSource, replaceSource): Promise<void> {
  return this.mutate(async () => {
    const backupPath = readerBackupPath(sourcePath);
    if (!(await this.adapter.exists(backupPath))) {
      await this.ensureParent(backupPath);
      await this.adapter.write(backupPath, originalSource);
    }
    await replaceSource(readerSource);
  });
}

async restore(sourcePath, replaceSource): Promise<void> {
  return this.mutate(async () => {
    const backupPath = readerBackupPath(sourcePath);
    if (!(await this.adapter.exists(backupPath))) {
      throw new Error("No original HTML backup exists for this file.");
    }
    await replaceSource(await this.adapter.read(backupPath));
    await this.adapter.remove(backupPath);
  });
}
```

Serialize mutations through a promise queue. Validate paths before constructing `.html-preview/originals/${sourcePath}`. Never overwrite an existing backup.

- [ ] **Step 4: Run store tests and verify GREEN**

Run: `npm test -- tests/reader-page-store.test.ts`

Expected: all store tests pass.

- [ ] **Step 5: Commit the reader store**

```bash
git add src/reader/page-store.ts tests/reader-page-store.test.ts
git commit -m "feat: back up saved reading pages"
```

### Task 4: Add Polished Save And Restore Confirmation

**Files:**
- Create: `src/reader/page-confirmation-modal.ts`
- Create: `tests/reader-page-confirmation-modal.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Produces: `ReaderPageConfirmationModal` configured with `mode: "save" | "restore"`, `sourcePath`, `onConfirm`, and `onError`.

- [ ] **Step 1: Write failing modal tests**

Assert that save and restore variants show the correct filename, backup/replacement explanation, accessible labels, and distinct icon/copy. Verify cancel does nothing, confirmation disables both controls while pending, success closes the modal, and rejection restores controls and calls `onError`.

```ts
const modal = new ReaderPageConfirmationModal(app, {
  mode: "save",
  onConfirm,
  onError,
  sourcePath: "Clips/page.html"
});
modal.open();
expect(modal.contentEl.textContent).toContain("Clips/page.html");
modal.contentEl.querySelector<HTMLButtonElement>("[data-reader-confirm]")?.click();
expect(onConfirm).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/reader-page-confirmation-modal.test.ts`

Expected: FAIL because the confirmation modal does not exist.

- [ ] **Step 3: Implement the modal and restrained Obsidian-native styling**

Build a compact un-nested modal with a single summary band, explicit file path, one muted consequence paragraph, and a right-aligned action row. Use `setIcon`; use theme variables; use 6px or smaller control radii; keep destructive restore/source replacement language explicit; never use browser `confirm()`.

```ts
const root = document.createElement("div");
root.className = "html-reader-confirmation";
const summary = document.createElement("div");
summary.className = "html-reader-confirmation-summary";
const icon = document.createElement("div");
setIcon(icon, this.options.mode === "save" ? "save" : "history");
const path = document.createElement("code");
path.textContent = this.options.sourcePath;
summary.append(icon, path);
const consequence = document.createElement("p");
consequence.textContent = this.options.mode === "save"
  ? "The current HTML will be replaced after a hidden backup is ready."
  : "The current HTML will be replaced by its saved original.";
const actions = document.createElement("div");
actions.className = "html-reader-confirmation-actions";
const cancel = document.createElement("button");
cancel.textContent = "Cancel";
cancel.addEventListener("click", () => this.close());
const confirm = document.createElement("button");
confirm.dataset.readerConfirm = "true";
confirm.textContent = this.options.mode === "save" ? "Replace HTML" : "Restore original";
confirm.addEventListener("click", () => void this.confirm(confirm, cancel));
actions.append(cancel, confirm);
root.append(summary, consequence, actions);
this.contentEl.append(root);
```

- [ ] **Step 4: Run modal tests and verify GREEN**

Run: `npm test -- tests/reader-page-confirmation-modal.test.ts`

Expected: all modal tests pass.

- [ ] **Step 5: Commit modal UI**

```bash
git add src/reader/page-confirmation-modal.ts tests/reader-page-confirmation-modal.test.ts styles.css
git commit -m "feat: confirm reading page replacement"
```

### Task 5: Integrate Smart Reading Into HTML Preview

**Files:**
- Modify: `src/main.ts`
- Modify: `src/html-preview-view.ts`
- Modify: `tests/html-preview-view.test.ts`
- Modify: `tests/html-annotations.test.ts`
- Modify: `tests/cleanup-plugin-integration.test.ts`

**Interfaces:**
- Consumes: extractor, reader document builder, `ReaderPageStore`, and `ReaderPageConfirmationModal` from Tasks 1-4.
- Changes: `HtmlPreviewEnvironment` gains `readerPageStore: Pick<ReaderPageStore, "hasBackup" | "save" | "restore">`.

- [ ] **Step 1: Add failing view tests for mode switching**

Extend the harness with an in-memory reader store. Assert that `Smart reading` appears beside existing HTML actions, builds an article with current annotations and existing cleanup rules, uses a script-enabled sandbox for the plugin-only bridge even when author scripts are disabled, hides original-page cleanup actions while active, and returns to the prior normal-preview scroll position.

```ts
await view.onLoadFile(createFile("pages/index.html"));
await viewActions(view).find((action) => action.title === "Smart reading")?.callback(new MouseEvent("click"));
expect(view.contentEl.querySelector("iframe")?.srcdoc).toContain("html-reader-shell");
expect(view.contentEl.querySelector("iframe")?.getAttribute("sandbox")).toContain("allow-scripts");
```

- [ ] **Step 2: Run the focused view test and verify RED**

Run: `npm test -- tests/html-preview-view.test.ts`

Expected: FAIL because no smart-reading action or environment store exists.

- [ ] **Step 3: Implement render-mode state and reader rendering**

Add `presentationMode: "page" | "reader"`, per-mode scroll positions, reader/save/restore action elements, the last successful standalone reader source, and async backup-state refresh. Load cleanup rules independently of `allowScripts` for extraction. Normal preview keeps the existing author-script sandbox policy; reader preview always allows the local plugin bridge but contains no author script.

On extraction failure, retain or return to normal preview, clear reader-only state, and show `No reliable article content was found for smart reading.` Do not replace the iframe with blank content.

```ts
private presentationMode: "page" | "reader" = "page";
private readonly scrollByMode = new Map<"page" | "reader", { x: number; y: number }>();
private standaloneReaderSource: string | null = null;

private async renderDocument(source, cleanupRules, annotations, renderId, allowScripts) {
  if (this.presentationMode === "reader") {
    const extracted = extractReadableArticle({
      cleanupRules,
      source,
      sourcePath: this.file!.path
    });
    if (!extracted.ok) return { kind: "reader-failure" as const };
    return {
      kind: "reader" as const,
      result: buildReaderPreview({
        annotations,
        article: extracted.article,
        knownVaultPaths: this.environment.getKnownVaultPaths(),
        renderId,
        resourceUrl: this.app.vault.getResourcePath(this.file!),
        sourcePath: this.file!.path,
        theme: document.body.classList.contains("theme-dark") ? "dark" : "light"
      })
    };
  }
  return {
    kind: "page" as const,
    result: buildPreviewDocument({
      allowScripts,
      annotations,
      cleanupRules: this.showOriginal || isSavedReaderPage(source) ? [] : cleanupRules,
      knownVaultPaths: this.environment.getKnownVaultPaths(),
      renderId,
      resourceUrl: this.app.vault.getResourcePath(this.file!),
      source,
      sourcePath: this.file!.path
    })
  };
}
```

- [ ] **Step 4: Add failing save and restore integration tests**

Open the modal from reader mode, confirm, and assert that `readerPageStore.save` receives the exact original and standalone reader sources plus a callback that calls `vault.modify(file, source)`. Assert that save is not called before confirmation. For restore, assert that the action is only visible when `hasBackup` resolves true and that confirmation delegates to `readerPageStore.restore` with `Vault.modify`.

- [ ] **Step 5: Run the focused tests and verify RED**

Run: `npm test -- tests/html-preview-view.test.ts tests/html-annotations.test.ts tests/cleanup-plugin-integration.test.ts`

Expected: new save/restore tests fail before orchestration is implemented; existing tests continue passing.

- [ ] **Step 6: Implement save/restore orchestration and action state**

Register one `ReaderPageStore` in `src/main.ts`. In the view, open `ReaderPageConfirmationModal`; disable stale callbacks with the current file path and render token; call `Vault.modify` only inside the store callback; show concise notices after success or error. Detect saved-reader metadata and skip cleanup-rule replay until original restoration.

Keep annotation bridge behavior active in reader mode. Update `focusAnnotation` and repair gating to allow the plugin-only reader bridge even when author page JavaScript is disabled.

```ts
this.readerPageStore = new ReaderPageStore(this.app.vault.adapter as never);

private openSaveReaderPage(): void {
  const file = this.file;
  const originalSource = this.lastSource;
  const readerSource = this.standaloneReaderSource;
  if (!file || originalSource === null || readerSource === null) return;
  new ReaderPageConfirmationModal(this.app, {
    mode: "save",
    sourcePath: file.path,
    onError: (error) => this.environment.showNotice(formatReaderError(error)),
    onConfirm: async () => {
      await this.environment.readerPageStore.save(
        file.path,
        originalSource,
        readerSource,
        (source) => this.app.vault.modify(file, source)
      );
      if (this.file?.path === file.path) await this.render();
    }
  }).open();
}

private bridgeAllowed(): boolean {
  return this.presentationMode === "reader" || this.environment.getSettings().allowScripts;
}
```

- [ ] **Step 7: Run integration tests and verify GREEN**

Run: `npm test -- tests/html-preview-view.test.ts tests/html-annotations.test.ts tests/cleanup-plugin-integration.test.ts tests/reader-extractor.test.ts tests/reader-document-builder.test.ts tests/reader-page-store.test.ts tests/reader-page-confirmation-modal.test.ts`

Expected: all selected tests pass without unhandled promise rejections.

- [ ] **Step 8: Commit HTML view integration**

```bash
git add src/main.ts src/html-preview-view.ts tests/html-preview-view.test.ts tests/html-annotations.test.ts tests/cleanup-plugin-integration.test.ts
git commit -m "feat: add HTML smart reading workflow"
```

### Task 6: Documentation, Release, And Vault Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/wiki/annotation-optimization.md`
- Modify: `main.js`
- Modify: `package-lock.json` if the production build normalizes metadata

**Interfaces:** None.

- [ ] **Step 1: Update bilingual documentation and Wiki status**

Document Smart reading, the cleanup-before-extraction relationship, Save reading page, hidden backup path, Restore original page, script-free saved output, annotation behavior, and the fact that Enhanced Markdown Reading is unchanged. Update both complete English and Chinese README sections. Leave the Wiki item `in_progress` until all automated and real-Vault checks pass.

- [ ] **Step 2: Run full verification**

Run: `npm run check`

Expected: Vitest reports zero failed tests, TypeScript exits 0, esbuild produces `main.js`, and release validation exits 0.

- [ ] **Step 3: Copy the verified release into the local Vault**

```bash
cp main.js manifest.json styles.css "/Users/hangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/obsidian-html/"
```

Expected: all three files exist in the plugin directory and match the repository build by SHA-256.

- [ ] **Step 4: Verify in real Obsidian**

Reload the plugin. Test one noisy saved article and one non-article HTML file in light and dark themes. Verify normal preview, manual cleanup, smart-reading extraction, selection and annotation, mode scroll restoration, save confirmation, browser-readable saved HTML, hidden backup, restore confirmation, and extraction-failure fallback. Inspect at desktop and narrow sidebar widths and confirm controls do not overlap.

- [ ] **Step 5: Mark the Wiki item done only after real-Vault verification**

Change the Smart reading roadmap status from `in_progress` to `done` only after Step 4 passes. If UI verification still needs user confirmation, use `verify` instead.

- [ ] **Step 6: Re-run release verification after the status edit**

Run: `npm run check && git diff --check`

Expected: all checks exit 0 and the production bundle remains current.

- [ ] **Step 7: Commit documentation and release artifacts**

```bash
git add README.md docs/wiki/annotation-optimization.md main.js manifest.json styles.css package-lock.json
git commit -m "docs: document HTML smart reading"
```
