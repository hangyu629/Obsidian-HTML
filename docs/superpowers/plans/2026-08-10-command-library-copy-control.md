# Command Library Copy Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one copy control per Command Library card while preserving native code-copy controls elsewhere.

**Architecture:** The built-in Command Library template owns the presentation fix. Its scoped CSS hides Obsidian's native code-block copy button only inside enhanced command cards; the existing header-copy runtime remains unchanged.

**Tech Stack:** TypeScript template strings, CSS, Vitest 4.

## Global Constraints

- Keep `.command-library-copy` and its exact multiline copy behavior.
- Do not hide `.copy-code-button` outside `.command-library-card`.
- Do not change Markdown source or other templates.

---

### Task 1: Scope Native Copy Hiding To Command Cards

**Files:**
- Modify: `src/markdown/templates/command-library.ts`
- Modify: `tests/markdown-render-document.test.ts`
- Modify: `main.js`

**Interfaces:**
- Consumes: Obsidian's `.copy-code-button` renderer class and `.command-library-card` template class.
- Produces: `.command-library-card .copy-code-button { display: none; }` in the Command Library template stylesheet.

- [ ] **Step 1: Write a failing template contract test**

Require the scoped selector in `COMMAND_LIBRARY_TEMPLATE.styles` and verify that a standalone `.copy-code-button` selector is not introduced.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/markdown-render-document.test.ts`

Expected: FAIL because the scoped hide rule is absent.

- [ ] **Step 3: Add the scoped template rule**

Add `.command-library-card .copy-code-button { display: none; }` next to the existing command-card code styles.

- [ ] **Step 4: Verify and deploy**

Run `npm run check && git diff --check`, copy release files to the Vault plugin directory, and confirm matching checksums.

- [ ] **Step 5: Commit**

Commit the template source, regression test, documentation, and rebuilt `main.js`.
