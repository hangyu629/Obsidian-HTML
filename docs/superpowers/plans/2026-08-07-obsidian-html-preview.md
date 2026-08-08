# Obsidian HTML Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Obsidian plugin that opens existing Vault `.html/.htm` files as isolated, automatically refreshing previews.

**Architecture:** Register a `FileView`, transform source text into an in-memory `srcdoc` document with a Vault resource base and navigation bridge, and coordinate file-change refreshes across open views. Pure preview, navigation, and dependency functions remain independent of Obsidian for focused tests.

**Tech Stack:** TypeScript, Obsidian Plugin API, browser DOM/iframe APIs, esbuild, Vitest, jsdom.

## Global Constraints

- Target Obsidian Desktop, iOS, and Android; `isDesktopOnly` is `false`.
- Do not create, edit, download, or modify HTML source files.
- JavaScript is enabled by default inside a sandbox without `allow-same-origin` or top-navigation permission.
- Do not use Electron `webview`, Node APIs at runtime, a local HTTP server, or Service Workers.
- Route Vault-local links through Obsidian and external links through the platform external-link utility.
- Keep runtime dependencies minimal; use browser-native DOM parsing and iframe rendering.

---

### Task 1: Project scaffold and pure URL policy

**Files:**
- Create: `package.json`, `manifest.json`, `versions.json`, `tsconfig.json`, `esbuild.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `src/preview/navigation.ts`
- Test: `tests/navigation.test.ts`

**Interfaces:**
- Produces: `classifyNavigation(rawHref: string, sourcePath: string): NavigationDecision`
- Produces: `NavigationDecision = {kind:'fragment'} | {kind:'external';url:string} | {kind:'vault';path:string;subpath:string} | {kind:'blocked';reason:string}`

- [ ] Write tests for fragments, HTTP/HTTPS/mailto/tel URLs, sibling files, parent-directory files, query/hash suffixes, percent encoding, absolute Vault paths, traversal above root, and dangerous protocols.
- [ ] Run `npm test -- tests/navigation.test.ts` and verify failure because the module is missing.
- [ ] Implement normalized POSIX path resolution without filesystem access. Strip query strings from Vault paths, preserve `#subpath`, reject traversal above the Vault root, NUL bytes, backslashes, and protocols other than the external allowlist.
- [ ] Run the focused test and verify all cases pass.
- [ ] Run `npm run typecheck` and commit the scaffold plus navigation policy.

### Task 2: Preview document builder and dependency extraction

**Files:**
- Create: `src/preview/document-builder.ts`, `src/preview/bridge-script.ts`, `src/preview/types.ts`
- Test: `tests/document-builder.test.ts`

**Interfaces:**
- Consumes: `classifyNavigation` only indirectly through the host bridge.
- Produces: `buildPreviewDocument(input: BuildPreviewInput): BuildPreviewResult`
- `BuildPreviewInput = {source:string; sourcePath:string; resourceUrl:string; renderId:string; allowScripts:boolean; knownVaultPaths:ReadonlySet<string>}`
- `BuildPreviewResult = {html:string; dependencies:Set<string>; diagnostics:PreviewDiagnostic[]}`

- [ ] Write tests proving source strings are unchanged, incomplete fragments become documents, one base element is first in `head`, the bridge precedes author scripts, scripts are retained by default and removed when disabled, local dependencies are normalized, `srcset` is parsed, and missing/blocked references emit diagnostics.
- [ ] Run `npm test -- tests/document-builder.test.ts` and verify failure because the builder is missing.
- [ ] Implement DOM parsing, base URL derivation, bridge insertion, optional script removal, static attribute scanning, source serialization, and structured diagnostics. Use DOM APIs rather than regular expressions for HTML structure.
- [ ] Run the focused tests and verify all cases pass.
- [ ] Run `npm run typecheck` and commit the builder.

### Task 3: Shared preview refresh coordinator

**Files:**
- Create: `src/preview/preview-coordinator.ts`
- Test: `tests/preview-coordinator.test.ts`

**Interfaces:**
- Produces: `PreviewCoordinator.subscribe(viewId, sourcePath, dependencies, refresh): () => void`
- Produces: `PreviewCoordinator.update(viewId, sourcePath, dependencies): void`
- Produces: `PreviewCoordinator.notify(path): void` and `dispose(): void`

- [ ] Write fake-timer tests for source changes, dependency changes, unrelated files, burst de-duplication, subscription updates, unsubscribe, and coordinator disposal.
- [ ] Run the focused test and verify failure because the coordinator is missing.
- [ ] Implement one trailing 250 ms timer per affected view and deterministic cleanup.
- [ ] Run focused tests and verify all cases pass.
- [ ] Run `npm run typecheck` and commit the coordinator.

### Task 4: Obsidian file view, navigation bridge, settings, and diagnostics

**Files:**
- Create: `src/html-preview-view.ts`, `src/settings.ts`, `src/diagnostics-modal.ts`, `src/main.ts`, `styles.css`
- Test: `tests/html-preview-view.test.ts`

**Interfaces:**
- Consumes: `buildPreviewDocument`, `classifyNavigation`, and `PreviewCoordinator`.
- Produces: `HtmlPreviewView extends FileView` and default export `HtmlPreviewPlugin extends Plugin`.

- [ ] Write mocked-view tests for successful load, `sandbox` flags, stale render cancellation, valid bridge message routing, invalid message rejection, reload, missing-file state, diagnostics state, and cleanup.
- [ ] Run `npm test -- tests/html-preview-view.test.ts` and verify failure because the view is missing.
- [ ] Implement plugin registration for `html` and `htm`, Vault event forwarding, settings with JavaScript enabled by default, view toolbar actions, iframe lifecycle, render-token checks, navigation validation, diagnostics modal, and compact failure states.
- [ ] Run focused tests and verify all cases pass.
- [ ] Run `npm run typecheck` and commit the Obsidian integration.

### Task 5: Packaging, compatibility fixtures, and release verification

**Files:**
- Create: `tests/fixtures/self-contained.html`, `tests/fixtures/site/index.html`, `tests/fixtures/site/assets/style.css`, `tests/fixtures/site/assets/app.js`, `README.md`
- Modify: `package.json`, `versions.json`

**Interfaces:**
- Consumes the complete plugin package.
- Produces release artifacts `main.js`, `manifest.json`, and `styles.css`.

- [ ] Add fixtures covering inline scripts, relative CSS/JS/images, local HTML links, external links, missing assets, and malformed markup.
- [ ] Document installation, behavior, security model, compatibility limits, settings, and manual desktop/mobile checks.
- [ ] Run `npm test` and verify the complete unit suite passes.
- [ ] Run `npm run typecheck` and verify zero TypeScript errors.
- [ ] Run `npm run build` and verify production `main.js` is generated without bundling Obsidian.
- [ ] Validate `manifest.json`, `versions.json`, and release artifact presence with `npm run validate`.
- [ ] Inspect `git diff --check`, run the manual fixture smoke-test checklist in Obsidian where available, and commit the release-ready implementation.

