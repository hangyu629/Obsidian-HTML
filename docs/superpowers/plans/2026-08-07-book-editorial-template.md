# Book Editorial Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `book-editorial` the only built-in and default Markdown enhanced-reading template, with broad native Markdown presentation coverage.

**Architecture:** Keep native Markdown rendering unchanged. Replace the built-in package metadata, layout, and CSS themes; normalize old `minimal` settings to the new template ID; test catalog fallback, setting migration, and visual DOM contracts.

**Tech Stack:** TypeScript, Obsidian `MarkdownRenderer`, DOM/CSS, Vitest, jsdom.

## Global Constraints

- Do not modify Markdown source files.
- Do not add template JavaScript or external resources.
- Keep custom Vault templates compatible.
- Use only `book-editorial` as the built-in fallback and default.

---

### Task 1: Migrate built-in identity and persisted defaults

**Files:**
- Modify: `src/markdown/templates/built-in.ts`
- Modify: `src/settings.ts`
- Modify: `src/main.ts`
- Modify: `tests/markdown-settings.test.ts`
- Modify: `tests/markdown-template-catalog.test.ts`

- [ ] Write failing tests that expect `book-editorial` to be the default and convert stored `minimal` values in global and folder settings.
- [ ] Run `npm test -- tests/markdown-settings.test.ts tests/markdown-template-catalog.test.ts` and confirm the old `minimal` assertions fail.
- [ ] Change the built-in ID, default settings, initial catalog ID set, form fallbacks, and normalization migration.
- [ ] Run focused tests and `npm run typecheck`.
- [ ] Commit with `feat: make book editorial the built-in template`.

### Task 2: Build editorial layout and native Markdown styles

**Files:**
- Modify: `src/markdown/templates/built-in.ts`
- Modify: `tests/markdown-render-document.test.ts`
- Modify: `tests/enhanced-markdown-view.test.ts`

- [ ] Write failing DOM contract tests for the cover/title layout, both themes, and selectors for tables, code, callouts, tasks, embeds, and footnotes.
- [ ] Run the focused tests and confirm the assertions fail against the old layout.
- [ ] Add the `book-editorial` layout, shared editorial styles, and light/dark variable theme sheets inspired by the reference page.
- [ ] Run focused tests and `npm run typecheck`.
- [ ] Commit with `feat: add book editorial Markdown template`.

### Task 3: Documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `tests/fixtures/markdown-core.md`

- [ ] Update the built-in template name and document light/dark editorial themes.
- [ ] Extend the fixture with task, callout, table, code, math, embed, footnote, and highlight examples.
- [ ] Run `npm run check`, `npm audit --audit-level=high`, and `git diff --check`.
- [ ] Commit with `docs: document book editorial Markdown template`.
