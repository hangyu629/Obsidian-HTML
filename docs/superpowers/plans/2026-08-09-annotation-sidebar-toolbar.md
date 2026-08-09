# Annotation Sidebar Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered annotation sidebar controls with a compact, accessible management drawer and confirm destructive bulk deletion.

**Architecture:** `AnnotationSidebarView` keeps transient drawer state and renders the filter row plus a bounded management grid. A focused `AnnotationSidebarBulkDeleteModal` owns destructive confirmation and async pending state. Existing annotation service and export interfaces remain unchanged.

**Tech Stack:** TypeScript 6, Obsidian Plugin API, DOM APIs, CSS, Vitest, jsdom

## Global Constraints

- Preserve every existing filter, sort, recolor, export, and delete capability.
- The management band is closed by default and closes when the source file changes.
- Filtering and annotation refreshes preserve the current open state.
- Use Obsidian theme variables and support narrow and wide sidebars in light and dark themes.
- Do not change annotation persistence, source HTML, or source Markdown.
- Keep source comments in English.

---

### Task 1: Collapsible Management Band

**Files:**
- Modify: `src/annotations/sidebar-view.ts:22-265`
- Modify: `styles.css:331-443`
- Test: `tests/annotation-sidebar-view.test.ts`

**Interfaces:**
- Consumes: existing `AnnotationSidebarEnvironment` methods without changes.
- Produces: a toggle with `aria-label="Manage annotations"`, `aria-expanded`, and `aria-controls`; a management band with `.annotation-sidebar-management`.

- [ ] **Step 1: Write failing structure and state tests**

Add tests that assert the management band is hidden by default, the toggle opens it, filter rerenders preserve it, and `setSource()` closes it:

```ts
it("toggles a compact management band and preserves it across filters", async () => {
  const { view } = harness();
  await view.setSource("notes/a.md");
  const toggle = view.contentEl.querySelector<HTMLButtonElement>(
    '[aria-label="Manage annotations"]'
  )!;
  const managementId = toggle.getAttribute("aria-controls")!;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden).toBe(true);

  toggle.click();
  expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden).toBe(false);
  clickByText(view.contentEl, "有批注");
  expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden).toBe(false);

  await view.setSource("notes/b.md");
  expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/annotation-sidebar-view.test.ts`

Expected: FAIL because the management toggle does not exist and the management band is always visible.

- [ ] **Step 3: Implement transient drawer state and accessible markup**

Add an instance ID and state:

```ts
let sidebarSequence = 0;

export class AnnotationSidebarView extends ItemView {
  private readonly managementId = `annotation-sidebar-management-${++sidebarSequence}`;
  private managementOpen = false;
}
```

Reset `managementOpen` in `setSource()`. Append this toggle after the three filters:

```ts
const managementToggle = document.createElement("button");
managementToggle.type = "button";
managementToggle.className = "clickable-icon annotation-sidebar-management-toggle";
managementToggle.setAttribute("aria-label", "Manage annotations");
managementToggle.setAttribute("aria-controls", this.managementId);
managementToggle.setAttribute("aria-expanded", String(this.managementOpen));
managementToggle.title = "整理注释";
setIcon(managementToggle, "sliders-horizontal");
managementToggle.addEventListener("click", () => {
  this.managementOpen = !this.managementOpen;
  this.render();
});
filters.append(managementToggle);
```

Assign the management ID and hidden state without removing the controls from the DOM:

```ts
management.id = this.managementId;
management.hidden = !this.managementOpen;
```

Use Chinese color option labels while preserving the existing color values.

- [ ] **Step 4: Replace distributed flex styling with a bounded grid**

Use a two-column management grid, a trailing filter toggle, and a single-column container query fallback:

```css
.annotation-sidebar { container-type: inline-size; }

.annotation-sidebar-filters {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 10px 9px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.annotation-sidebar-management-toggle { margin-left: auto; }

.annotation-sidebar-management {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 7px;
  padding: 9px 10px 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary-alt);
}

@container (max-width: 280px) {
  .annotation-sidebar-management { grid-template-columns: minmax(0, 1fr); }
}
```

Give selects and command buttons stable full-width dimensions. Style export as a normal command and filtered deletion as a quiet danger command.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --run tests/annotation-sidebar-view.test.ts && npm run typecheck`

Expected: all sidebar tests pass and TypeScript exits with code 0.

- [ ] **Step 6: Commit the management drawer**

```bash
git add src/annotations/sidebar-view.ts styles.css tests/annotation-sidebar-view.test.ts
git commit -m "feat: compact annotation sidebar tools"
```

---

### Task 2: Filtered Deletion Confirmation

**Files:**
- Create: `src/annotations/sidebar-bulk-delete-modal.ts`
- Modify: `src/annotations/sidebar-view.ts:1-280`
- Modify: `styles.css`
- Test: `tests/annotation-sidebar-view.test.ts`

**Interfaces:**
- Produces: `AnnotationSidebarBulkDeleteModalOptions` with `count: number`, `onConfirm(): Promise<void>`, and `onError(error: unknown): void`.
- Consumes: the current filtered annotation array captured by `AnnotationSidebarView.render()`.

- [ ] **Step 1: Write a failing confirmation test**

Replace the existing immediate bulk-delete assertion with a modal flow:

```ts
it("confirms before deleting filtered annotations", async () => {
  const { annotationService, view } = harness();
  await view.setSource("notes/a.md");
  view.contentEl.querySelector<HTMLButtonElement>(
    '[aria-label="Manage annotations"]'
  )?.click();
  clickByText(view.contentEl, "有批注");
  view.contentEl.querySelector<HTMLButtonElement>(
    '[aria-label="Delete filtered annotations"]'
  )?.click();

  expect(annotationService.remove).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("将删除 2 条注释");
  document.body.querySelector<HTMLButtonElement>(
    '[aria-label="Confirm deleting filtered annotations"]'
  )?.click();

  await vi.waitFor(() => expect(annotationService.remove).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/annotation-sidebar-view.test.ts`

Expected: FAIL because clicking the existing button deletes immediately and no confirmation modal is rendered.

- [ ] **Step 3: Implement the focused confirmation modal**

Create `AnnotationSidebarBulkDeleteModal extends Modal`. Render a compact warning icon, title copy, count-aware body, cancel button, and destructive confirm button. The confirm handler disables both buttons, awaits `onConfirm`, closes on success, and restores controls plus calls `onError` on failure.

The public option contract is:

```ts
export interface AnnotationSidebarBulkDeleteModalOptions {
  count: number;
  onConfirm(): Promise<void>;
  onError(error: unknown): void;
}
```

- [ ] **Step 4: Open the modal from the sidebar**

Replace the direct `Promise.all` delete handler with:

```ts
new AnnotationSidebarBulkDeleteModal(this.app, {
  count: visible.length,
  onConfirm: () => Promise.all(
    visible.map((annotation) => this.environment.removeAnnotation(annotation))
  ).then(() => undefined),
  onError: (error) => this.environment.showNotice(
    error instanceof Error ? error.message : String(error)
  )
}).open();
```

- [ ] **Step 5: Style the modal and verify behavior**

Add `.annotation-sidebar-delete-modal`, warning icon, message, and action styles using `--text-error`, `--background-modifier-error`, and existing modal button patterns. Run:

`npm test -- --run tests/annotation-sidebar-view.test.ts && npm run typecheck`

Expected: sidebar tests and typecheck pass.

- [ ] **Step 6: Commit deletion confirmation**

```bash
git add src/annotations/sidebar-bulk-delete-modal.ts src/annotations/sidebar-view.ts styles.css tests/annotation-sidebar-view.test.ts
git commit -m "feat: confirm bulk annotation deletion"
```

---

### Task 3: Documentation, Visual QA, And Release Build

**Files:**
- Modify: `docs/wiki/annotation-optimization.md`
- Modify: `main.js` through the production build

**Interfaces:**
- Consumes: completed sidebar drawer and deletion modal.
- Produces: verified build files copied to the local Vault plugin folder.

- [ ] **Step 1: Update the wiki**

Add a completed roadmap note that the annotation sidebar management controls were reorganized into a responsive drawer with destructive confirmation.

- [ ] **Step 2: Run complete automated verification**

Run: `npm run check && git diff --check`

Expected: all tests, typecheck, production build, release validation, and whitespace checks pass.

- [ ] **Step 3: Perform visual verification**

Render or inspect the sidebar at approximately 260 px and 420 px widths in light and dark themes. Verify that:

- no controls overlap or distribute across unused horizontal space;
- the closed state shows only title, search, filters, and management toggle;
- the open drawer uses two columns at 420 px and one column at 260 px;
- delete confirmation copy and actions fit without clipping.

- [ ] **Step 4: Sync the verified build to the Vault**

```bash
cp main.js manifest.json styles.css "/Users/hangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/obsidian-html/"
```

Use `cmp -s` for all three files to verify the copied files match.

- [ ] **Step 5: Commit release artifacts and wiki status**

```bash
git add docs/wiki/annotation-optimization.md main.js
git commit -m "docs: record annotation sidebar polish"
```
