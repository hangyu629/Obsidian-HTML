# URL Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a public webpage directly into the Vault as `Article Title.html` plus `Article Title-assets/`, then open the saved HTML in normal preview.

**Architecture:** A dedicated importer pipeline fetches HTML and assets with Obsidian `requestUrl`, rewrites remote URLs into Vault-local relative paths, and persists the result through Vault text/binary file APIs. A modal collects URL and destination input, while `main.ts` wires the command into the existing HTML-preview open flow.

**Tech Stack:** TypeScript 6, Obsidian Plugin API 1.13, `requestUrl`, DOMParser, Vitest 4 with jsdom.

## Global Constraints

- The importer only targets Vault-local `.html` output; Enhanced Markdown Reading remains unchanged.
- Version 1 supports public static and article-style pages, not login-state or runtime-rendered captures.
- Output layout is `Article Title.html` plus `Article Title-assets/`.
- Imported HTML opens in normal preview, not Smart reading.
- Asset fetching includes direct HTML references plus CSS `@import` and `url(...)` recursion.
- Partial asset failures keep the written files and surface a clear summary instead of silent rollback.
- Imported HTML is not sanitized during capture; cleanup and Smart reading remain separate steps.

---

### Task 1: Fetch And Rewrite Remote Resources

**Files:**
- Create: `src/importer/fetcher.ts`
- Create: `src/importer/rewrite.ts`
- Create: `tests/importer-fetcher.test.ts`
- Create: `tests/importer-rewrite.test.ts`

**Interfaces:**
- Produces: `fetchImportGraph(input: ImportFetchInput): Promise<ImportFetchResult>`
- Produces: `rewriteImportedHtml(input: RewriteHtmlInput): RewriteHtmlResult`
- Produces: `rewriteImportedCss(input: RewriteCssInput): RewriteCssResult`

- [ ] **Step 1: Write failing fetcher and rewrite tests**

Cover:

- HTML collection of `src`, `href`, `poster`, `srcset`, `object[data]`
- CSS `@import` and `url(...)` recursion
- deduplicated asset scheduling by absolute URL
- same-origin, host-relative, and cross-origin asset mapping under `Article Title-assets/`
- query-string collision suffixing

```ts
expect(result.assets.map((asset) => asset.vaultPath)).toEqual([
  "Clippings/Article Title-assets/css/app.css",
  "Clippings/Article Title-assets/images/photo.jpg",
  "Clippings/Article Title-assets/cdn.example.com/fonts/site.woff2"
]);
expect(rewritten.html).toContain('href="Article Title-assets/css/app.css"');
expect(rewrittenCss).toContain("../images/photo.jpg");
```

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- tests/importer-fetcher.test.ts tests/importer-rewrite.test.ts`

Expected: FAIL because importer modules do not exist.

- [ ] **Step 3: Implement fetch graph collection and URL rewriting**

Use `requestUrl` adapter injection so tests stay pure. Parse HTML with DOMParser, resolve URLs with `new URL(relative, base)`, preserve per-host folder structure, and rewrite CSS text with structured token scanning for `@import` and `url(...)`.

```ts
export interface ImportAsset {
  contentType: string;
  kind: "binary" | "css" | "html";
  sourceUrl: string;
  vaultPath: string;
  body: ArrayBuffer | string;
}

export interface ImportFetchResult {
  assets: ImportAsset[];
  documentUrl: string;
  html: string;
  title: string;
  warnings: string[];
}
```

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/importer-fetcher.test.ts tests/importer-rewrite.test.ts && npm run typecheck`

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/importer/fetcher.ts src/importer/rewrite.ts tests/importer-fetcher.test.ts tests/importer-rewrite.test.ts
git commit -m "feat: fetch and rewrite imported webpages"
```

### Task 2: Persist Imported HTML And Assets Into The Vault

**Files:**
- Create: `src/importer/store.ts`
- Create: `tests/importer-store.test.ts`

**Interfaces:**
- Produces: `deriveImportPaths(input: ImportNamingInput): ImportPaths`
- Produces: `writeImportedPage(input: WriteImportedPageInput): Promise<WriteImportedPageResult>`

- [ ] **Step 1: Write failing store tests**

Cover title sanitization, fallback naming, numeric collision handling, folder creation, text file creation, binary file creation, partial asset write warnings, and refusal to overwrite an existing non-file/non-folder path.

```ts
expect(paths.htmlPath).toBe("Clippings/Article Title 2.html");
expect(paths.assetRoot).toBe("Clippings/Article Title 2-assets");
expect(result.warnings).toContain("Failed to save asset: cdn.example.com/lib/site.css");
```

- [ ] **Step 2: Run the store tests and verify RED**

Run: `npm test -- tests/importer-store.test.ts`

Expected: FAIL because the store module does not exist.

- [ ] **Step 3: Implement naming and Vault writes**

Inject a narrow Vault adapter for `create`, `createBinary`, `createFolder`, and `getAbstractFileByPath`. Derive `Article Title.html` and `Article Title-assets/`, then create files in a deterministic order so the HTML file is written after asset folders exist.

```ts
export interface WriteImportedPageResult {
  assetRoot: string;
  htmlPath: string;
  warnings: string[];
}
```

- [ ] **Step 4: Run store tests and typecheck**

Run: `npm test -- tests/importer-store.test.ts && npm run typecheck`

Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/importer/store.ts tests/importer-store.test.ts
git commit -m "feat: persist imported webpages in the vault"
```

### Task 3: Add The Import Modal And Command Wiring

**Files:**
- Create: `src/importer/modal.ts`
- Create: `tests/importer-modal.test.ts`
- Modify: `src/main.ts`
- Modify: `styles.css`
- Modify: `tests/markdown-plugin-integration.test.ts` or create a focused plugin command test if cleaner

**Interfaces:**
- Produces: `ImportWebpageModal`
- Changes: `HtmlPreviewPlugin` adds `Import webpage from URL` command and importer orchestration helpers.

- [ ] **Step 1: Write failing modal and plugin integration tests**

Cover URL validation, pending-state disabling, destination folder handling, success callback payload, error rendering, and command registration that opens the imported HTML file after success.

```ts
expect(plugin.commands).toEqual(
  expect.arrayContaining([expect.objectContaining({ id: "import-webpage-from-url" })])
);
expect(app.workspace.openLinkText).toHaveBeenCalledWith("Clippings/Article Title.html", "", false);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/importer-modal.test.ts tests/markdown-plugin-integration.test.ts`

Expected: FAIL before the modal and command are implemented.

- [ ] **Step 3: Implement modal, orchestration, and command registration**

Use a compact modal with URL, folder, and name fields. On submit, call the fetcher, then the store, then `workspace.openLinkText` for the resulting HTML path. Report partial warnings in the success notice.

- [ ] **Step 4: Run modal/plugin tests and typecheck**

Run: `npm test -- tests/importer-modal.test.ts tests/markdown-plugin-integration.test.ts && npm run typecheck`

Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/importer/modal.ts src/main.ts styles.css tests/importer-modal.test.ts tests/markdown-plugin-integration.test.ts
git commit -m "feat: add webpage URL importer workflow"
```

### Task 4: Documentation, Full Verification, And Local Vault Deployment

**Files:**
- Modify: `README.md`
- Modify: `docs/wiki/annotation-optimization.md`
- Modify: `main.js`
- Modify: `manifest.json` only if command/description text needs release metadata updates

- [ ] **Step 1: Update bilingual documentation**

Document the URL importer command, output layout, current limitations, and how it fits with cleanup and Smart reading.

- [ ] **Step 2: Run full verification**

Run: `npm run check`

Expected: all tests pass, typecheck passes, build succeeds, and release validation succeeds.

- [ ] **Step 3: Copy release files into the local Vault plugin directory**

```bash
cp main.js manifest.json styles.css "/Users/hangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/obsidian-html/"
```

- [ ] **Step 4: Mark the Wiki item `verify` or `done` based on real Obsidian validation**

Set the importer roadmap item to `verify` if automated checks and local deployment are done but real in-app confirmation still depends on the user. Use `done` only after the importer is exercised successfully in Obsidian.

- [ ] **Step 5: Re-run verification after the final docs/status edit**

Run: `npm run check && git diff --check`

Expected: exit 0 for both commands.

- [ ] **Step 6: Commit documentation and release artifacts**

```bash
git add README.md docs/wiki/annotation-optimization.md main.js manifest.json styles.css
git commit -m "docs: document webpage URL importer"
```
