# Enhanced Markdown Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional template-driven enhanced reading view for Markdown files while preserving Obsidian's native Markdown renderer, editor, links, embeds, and source files.

**Architecture:** A Vault-backed template catalog validates HTML/CSS-only template packages and themes. A pure rule resolver combines bounded frontmatter and plugin settings folder mappings. `EnhancedMarkdownView` renders Markdown with Obsidian's `MarkdownRenderer`, inserts the result into validated layout slots, scopes template CSS, and switches back to the native `markdown` view. The existing HTML Preview feature remains independent.

**Tech Stack:** TypeScript, Obsidian Plugin API (`MarkdownRenderer`, `FileView`, `WorkspaceLeaf`), DOMParser/CSSOM, Vitest, jsdom, esbuild.

## Global Constraints

- Markdown source files remain byte-for-byte unchanged.
- `.md` is not registered to the enhanced view; native Markdown remains the default file view.
- Template packages contain HTML, CSS, metadata, themes, and local assets only; no template JavaScript executes.
- Template HTML rejects scripts, event-handler attributes, forms, iframe/object elements, meta refresh, and external resources.
- Rendering uses `MarkdownRenderer.render`; no second Markdown parser is introduced.
- Automatic enhanced reading occurs only for valid frontmatter or folder matches and is disabled unless the setting is enabled.
- Frontmatter overrides the most-specific settings folder mapping; the global default is used for manual opening only.
- Core Obsidian Markdown syntax is guaranteed; third-party processors are supported only through the native renderer boundary and are not bespoke in this release.
- Template CSS and DOM are scoped to the enhanced view root and cleaned up on unload.
- No Node.js, Electron, local server, or template script enters the production bundle.

---

### Task 1: Template contracts, validation, and Vault catalog

**Files:**
- Create: `src/markdown/templates/types.ts`
- Create: `src/markdown/templates/validation.ts`
- Create: `src/markdown/templates/catalog.ts`
- Create: `src/markdown/templates/built-in.ts`
- Test: `tests/markdown-template-validation.test.ts`
- Test: `tests/markdown-template-catalog.test.ts`
- Modify: `tests/mocks/obsidian.ts`

**Interfaces:**
- `MarkdownTemplateManifest`, `MarkdownTemplateTheme`, `MarkdownTemplatePackage`.
- `parseTemplateManifest(value: unknown): MarkdownTemplateManifest | null`.
- `validateTemplateLayout(layout: string): TemplateLayoutResult` with required `content` slot and allowed slots `title`, `properties`, `toc`.
- `validateTemplatePackage(files: TemplatePackageFiles): MarkdownTemplatePackage | null`.
- `MarkdownTemplateCatalog.list(): Promise<MarkdownTemplateSummary[]>` and `load(id: string): Promise<MarkdownTemplatePackage>`.

- [ ] **Step 1: Write failing validation tests.** Cover manifest version/id/name bounds, theme IDs and relative stylesheets, missing content slot, unsupported slots, dangerous tags/attributes, external URLs, duplicate IDs, package size limits, and unknown fields.
- [ ] **Step 2: Run RED.** `npm test -- tests/markdown-template-validation.test.ts`; expect import/module failures because the template contracts do not exist.
- [ ] **Step 3: Implement bounded manifest/layout validation.** Parse layout with inert `DOMParser`, reject dangerous elements and attributes, require exactly one `data-slot="content"`, allow only documented slots, reject `http:`, `https:`, `//`, `data:` and absolute asset references, and normalize package-relative paths.
- [ ] **Step 4: Write failing catalog tests.** Use an in-memory adapter to cover built-in fallback, package discovery under `.html-preview/markdown-templates/`, missing files, corrupt manifests, missing themes, and path traversal rejection.
- [ ] **Step 5: Implement the Vault catalog.** Define a narrow adapter with `list`, `exists`, and `read`; discover only direct template directories, load manifest/layout/base CSS/themes/assets, and return the built-in Book Editorial package for invalid or missing packages without mutating Vault data.
- [ ] **Step 6: Run focused tests and typecheck.** `npm test -- tests/markdown-template-validation.test.ts tests/markdown-template-catalog.test.ts && npm run typecheck`.
- [ ] **Step 7: Commit.** `git add src/markdown/templates tests/markdown-template-* tests/mocks/obsidian.ts && git commit -m "feat: validate Markdown template packages"`.

### Task 2: Rule resolution and template CSS scoping

**Files:**
- Create: `src/markdown/rules.ts`
- Create: `src/markdown/css-scope.ts`
- Test: `tests/markdown-rules.test.ts`
- Test: `tests/markdown-css-scope.test.ts`

**Interfaces:**
- `MarkdownTemplateSettings` with `defaultTemplateId`, `defaultThemeId`, `autoEnhanced`, and ordered `folderMappings`.
- `resolveMarkdownTemplate(sourcePath: string, frontmatter: unknown, settings: MarkdownTemplateSettings, available: ReadonlySet<string>): TemplateSelection`.
- `scopeTemplateCss(css: string, rootSelector: string): string`.

- [ ] **Step 1: Write failing rule tests.** Cover valid `html-preview.template`/`html-preview.theme`, invalid frontmatter fallback, exact and nested folder matches, longest-folder precedence, tie order, unavailable templates, manual global fallback, and automatic mode returning `null` when no rule matches.
- [ ] **Step 2: Run RED.** `npm test -- tests/markdown-rules.test.ts`; expect missing module/function failures.
- [ ] **Step 3: Implement pure rule resolution.** Normalize Vault paths, bound strings and mapping counts, ignore unknown frontmatter fields, choose frontmatter before the longest matching folder, and expose whether the choice came from a rule or manual fallback.
- [ ] **Step 4: Write failing CSS scope tests.** Cover element selectors, grouped selectors, descendant selectors, `@media`, `@supports`, keyframes, CSS variables, comments, and rejection of `@import`/external URLs.
- [ ] **Step 5: Implement CSSOM-backed scoping.** Recursively prefix style rules with the generated root selector, preserve keyframes and declaration blocks, reject external imports/URLs, and keep theme variables within the same root.
- [ ] **Step 6: Run focused tests and typecheck.** `npm test -- tests/markdown-rules.test.ts tests/markdown-css-scope.test.ts && npm run typecheck`.
- [ ] **Step 7: Commit.** `git add src/markdown/rules.ts src/markdown/css-scope.ts tests/markdown-rules.test.ts tests/markdown-css-scope.test.ts && git commit -m "feat: resolve Markdown templates and scope styles"`.

### Task 3: Native Markdown render pipeline and enhanced view

**Files:**
- Create: `src/markdown/enhanced-markdown-view.ts`
- Create: `src/markdown/render-document.ts`
- Test: `tests/markdown-render-document.test.ts`
- Test: `tests/enhanced-markdown-view.test.ts`
- Modify: `tests/mocks/obsidian.ts`

**Interfaces:**
- `renderEnhancedMarkdown(input: RenderEnhancedMarkdownInput): Promise<RenderEnhancedMarkdownResult>`.
- `EnhancedMarkdownView extends FileView` with `getViewType(): string`, `onLoadFile`, `onUnloadFile`, `setState`, `getState`, and `openNativeMarkdown`.
- `ENHANCED_MARKDOWN_VIEW_TYPE = "enhanced-markdown"`.

- [ ] **Step 1: Write failing render pipeline tests.** Mock `MarkdownRenderer.render` and verify title, Properties, TOC, content, template/theme CSS, relative asset URLs, scoped root cleanup, invalid template fallback, and unchanged source bytes.
- [ ] **Step 2: Run RED.** `npm test -- tests/markdown-render-document.test.ts`; expect missing renderer/view modules.
- [ ] **Step 3: Implement the render document.** Clone validated layout DOM, fill the four slots, invoke `MarkdownRenderer.render(app, source, contentSlot, sourcePath, component)`, generate a heading TOC with safe internal anchors, attach scoped styles, and resolve package-local assets through the supplied Vault resource resolver.
- [ ] **Step 4: Write failing enhanced view tests.** Cover loading a file from `state.file`, rendering, toolbar actions, stale async reads, modify refresh, native-view switch state, theme/template session state, and unload cleanup.
- [ ] **Step 5: Implement `EnhancedMarkdownView`.** Use a monotonic render token, load the source and selected template concurrently, subscribe through `PreviewCoordinator`, add `Open native Markdown` and `Switch template` actions, and switch the current leaf with `setViewState({ type: "markdown", state: { file: path } }, { history: true })`.
- [ ] **Step 6: Run focused tests and typecheck.** `npm test -- tests/markdown-render-document.test.ts tests/enhanced-markdown-view.test.ts && npm run typecheck`.
- [ ] **Step 7: Commit.** `git add src/markdown/enhanced-markdown-view.ts src/markdown/render-document.ts tests/markdown-render-document.test.ts tests/enhanced-markdown-view.test.ts tests/mocks/obsidian.ts && git commit -m "feat: render Markdown through enhanced templates"`.

### Task 4: Plugin integration, auto-open, and settings UI

**Files:**
- Modify: `src/main.ts`
- Modify: `src/settings.ts`
- Create: `src/markdown/template-modal.ts`
- Test: `tests/markdown-plugin-integration.test.ts`
- Test: `tests/markdown-settings.test.ts`
- Modify: `tests/mocks/obsidian.ts`

**Interfaces:**
- `HtmlPreviewPlugin.markdownTemplateCatalog` and `markdownTemplateSettings`.
- `shouldAutoOpenEnhancedMarkdown(file, settings, catalog): Promise<boolean>`.
- `MarkdownTemplateModal` for choosing a template/theme during a manual enhanced-reading action.

- [ ] **Step 1: Write failing settings/integration tests.** Cover settings defaults, ordered folder mappings, persistence through `loadData/saveData`, template catalog injection, registering the enhanced view, manual Markdown action, returning to native Markdown, and auto-open only for valid frontmatter/folder matches.
- [ ] **Step 2: Run RED.** `npm test -- tests/markdown-plugin-integration.test.ts tests/markdown-settings.test.ts`; expect missing registration, settings, and modal behavior.
- [ ] **Step 3: Implement settings and template chooser.** Add default template/theme IDs, `autoEnhanced: true`, bounded folder mapping CRUD, and a modal that lists valid template/theme options, applies a session-only manual selection, and shows Notice on load failures.
- [ ] **Step 4: Wire the plugin.** Instantiate the catalog once, register `ENHANCED_MARKDOWN_VIEW_TYPE`, add enhanced actions to Markdown views without registering `.md`, handle `file-open`/`active-leaf-change` with a re-entry guard, and switch only when `autoEnhanced` and a valid rule match.
- [ ] **Step 5: Wire refresh and lifecycle.** Notify the shared coordinator on Markdown source/template asset changes, migrate no Markdown source, remove actions/listeners on unload, and preserve native view history when toggling.
- [ ] **Step 6: Run focused tests and typecheck.** `npm test -- tests/markdown-plugin-integration.test.ts tests/markdown-settings.test.ts && npm run typecheck`.
- [ ] **Step 7: Commit.** `git add src/main.ts src/settings.ts src/markdown/template-modal.ts tests/markdown-plugin-integration.test.ts tests/markdown-settings.test.ts tests/mocks/obsidian.ts && git commit -m "feat: integrate enhanced Markdown reading"`.

### Task 5: Documentation, fixtures, and release verification

**Files:**
- Create: `tests/fixtures/markdown-templates/editorial/template.json`
- Create: `tests/fixtures/markdown-templates/editorial/layout.html`
- Create: `tests/fixtures/markdown-templates/editorial/styles.css`
- Create: `tests/fixtures/markdown-templates/editorial/themes/light.css`
- Create: `tests/fixtures/markdown-core.md`
- Modify: `README.md`
- Modify: `styles.css`
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `versions.json`

- [ ] **Step 1: Add fixtures and a manual smoke-test note.** Include headings, tables, tasks, callouts, math, wiki links, embeds, Properties, footnotes, and code blocks; keep fixture source unchanged after rendering.
- [ ] **Step 2: Update documentation.** Document template packages, supported slots, frontmatter key, folder mappings, precedence, automatic opening, manual default template, theme selection, core-versus-third-party support, and the no-JavaScript boundary in English and Chinese.
- [ ] **Step 3: Update release metadata.** Increment the plugin from `0.2.0` to `0.3.0` in `package.json`, `package-lock.json`, `manifest.json`, and `versions.json`; keep mobile support enabled.
- [ ] **Step 4: Run complete verification.** `npm run check && npm audit --audit-level=high && git diff --check`; expect all tests, typecheck, production build, release validation, and audit to pass with no whitespace errors.
- [ ] **Step 5: Perform a local code review.** Inspect `git diff main`, scan the bundle for Node/Electron/template JavaScript, confirm Markdown source files are never written, and verify stale view callbacks cannot switch an unrelated leaf.
- [ ] **Step 6: Commit.** `git add src tests README.md styles.css package.json package-lock.json manifest.json versions.json && git commit -m "feat: ship enhanced Markdown templates"`.
