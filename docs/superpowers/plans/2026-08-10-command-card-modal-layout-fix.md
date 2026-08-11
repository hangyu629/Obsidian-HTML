# Command Card Modal Layout Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the Insert command card dialog from overflowing and clipping its language field or primary action.

**Architecture:** Give the Obsidian modal element a dedicated class that owns dialog width. Keep the form intrinsically responsive by filling the parent and stacking its metadata grid below the existing mobile breakpoint.

**Tech Stack:** TypeScript 6, Obsidian Modal API, CSS Grid, Vitest 4 with jsdom.

## Global Constraints

- Do not change command-card fields or behavior.
- Keep desktop title/language columns and mobile single-column layout.
- Use Obsidian theme variables and the existing 6px control radius.
- Deploy only after the full release check passes.

---

### Task 1: Responsive Modal Width

**Files:**
- Modify: `src/markdown/command-card-modal.ts`
- Modify: `tests/mocks/obsidian.ts`
- Modify: `tests/markdown-command-card-modal.test.ts`
- Modify: `styles.css`
- Test: `tests/markdown-command-card-modal.test.ts`

**Interfaces:**
- Consumes: Obsidian `Modal.modalEl` and the existing `.command-card-modal` form.
- Produces: `.command-card-insert-dialog` as the dialog-level sizing hook.

- [ ] **Step 1: Write failing lifecycle and CSS contract tests**

Assert that opening adds `.command-card-insert-dialog`, closing removes it, and CSS assigns width to the dialog while the form uses `width: 100%`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/markdown-command-card-modal.test.ts`

Expected: FAIL because the modal class is not applied and the form still owns a fixed viewport width.

- [ ] **Step 3: Implement the modal sizing fix**

Add the dialog class in `onOpen`, remove it in `onClose`, make the dialog `width: min(680px, calc(100vw - 32px))`, make the form fill its parent, and use a bounded language column.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- tests/markdown-command-card-modal.test.ts && npm run check && git diff --check`

Expected: all tests, type checking, production build, release validation, and diff checks pass.

- [ ] **Step 5: Deploy and commit**

Copy `main.js`, `manifest.json`, and `styles.css` to the Vault plugin directory, verify matching checksums, and commit the source, tests, CSS, docs, and bundle.
