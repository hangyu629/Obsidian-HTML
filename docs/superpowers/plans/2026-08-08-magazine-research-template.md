# Magazine Research Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Magazine Research as a selectable built-in Markdown template and allow template/theme selection per Vault folder from Settings.

**Architecture:** Convert the one built-in template export to a deterministic collection while retaining `BUILT_IN_TEMPLATE_ID` and `BUILT_IN_TEMPLATE` as Book Editorial compatibility aliases. The catalog loads built-ins before Vault packages. Settings consume cached template summaries and provide native template/theme selects per folder mapping; Markdown rule resolution remains the precedence authority.

**Tech Stack:** TypeScript, Obsidian Plugin API, native `MarkdownRenderer`, Vitest, JSDOM.

## Global Constraints

- Keep `book-editorial` as default and fallback.
- Do not transform Markdown source or add template JavaScript, remote assets, or network requests.
- Preserve `minimal` to `book-editorial` setting migration.
- Preserve custom Vault templates; built-in IDs win on collisions.
- Do not modify `package-lock.json`.

---

### Task 1: Catalog multiple built-ins

**Files:** Modify `src/markdown/templates/built-in.ts`, `src/markdown/templates/catalog.ts`, and `tests/markdown-template-catalog.test.ts`.

**Interfaces:** Export `BUILT_IN_TEMPLATES` and `builtInTemplateFor(id)`. Keep legacy Book Editorial aliases. The catalog lists `book-editorial`, then `magazine-research`, then valid Vault templates; it resolves a built-in before trying the Vault and ignores collision folders.

- [ ] Add failing catalog tests expecting `magazine-research` to list and load.
- [ ] Run `npm test -- tests/markdown-template-catalog.test.ts`; expect failure because only Book Editorial exists.
- [ ] Add `BUILT_IN_TEMPLATES` and use it from catalog list/load/collision filtering.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `git commit -m "feat: support multiple built-in Markdown templates"`.

### Task 2: Add the Magazine Research visual package

**Files:** Modify `src/markdown/templates/built-in.ts` and `tests/markdown-render-document.test.ts`.

**Interfaces:** `magazine-research` has `light` and `dark` themes plus title, Properties, TOC, and content slots. Its CSS handles headings, emphasis, links, highlights, lists/tasks, quotes/callouts, tables, inline/fenced code, math, embeds, rules, and footnotes.

- [ ] Add a failing styling-contract test asserting the new package, two themes, slots, responsive rule, and core selectors.
- [ ] Run `npm test -- tests/markdown-render-document.test.ts`; expect failure because the package is absent.
- [ ] Implement the approved masthead, information band, `max-width: 735px` reading column, mobile single-column layout, and specified light/dark palettes.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `git commit -m "feat: add magazine research Markdown template"`.

### Task 3: Select a template per folder in Settings

**Files:** Modify `src/main.ts`, `src/settings.ts`, `tests/markdown-settings.test.ts`, and `tests/mocks/obsidian.ts` only if the test requires mock support.

**Interfaces:** `HtmlPreviewPlugin.listMarkdownTemplates(): readonly MarkdownTemplateSummary[]` returns cached summaries after startup. Each folder row keeps a folder-path input and replaces template/theme ID fields with `<select>` controls. Changing the template resets its theme to the template default, saves settings, and refreshes the row.

- [ ] Add failing settings tests verifying an added mapping has a template select with `Magazine Research`, a dependent theme select, and resets to `light` when that template is chosen.
- [ ] Run `npm test -- tests/markdown-settings.test.ts`; expect failure because mappings expose only free-text IDs.
- [ ] Cache catalog summaries in the plugin and render native selects from those summaries in Settings. Persist edits, retain removal controls, and display an empty-state message when summaries are unavailable.
- [ ] Re-run focused test; expect PASS.
- [ ] Commit: `git commit -m "feat: select Markdown templates per folder"`.

### Task 4: Integration, documentation, and release verification

**Files:** Modify `tests/markdown-plugin-integration.test.ts` and `README.md`.

**Interfaces:** Startup exposes both built-ins. README documents manual template selection and automatic per-folder application, including most-specific folder precedence and frontmatter override.

- [ ] Add a failing integration expectation for both built-in IDs from `listMarkdownTemplates()`.
- [ ] Run `npm test -- tests/markdown-plugin-integration.test.ts`; expect failure until the plugin exposes cached summaries.
- [ ] Add concise user documentation.
- [ ] Run `npm test -- tests/markdown-plugin-integration.test.ts && npm run check && git diff --check`; expect all checks to pass.
- [ ] Commit: `git commit -m "docs: explain folder Markdown template selection"`.
