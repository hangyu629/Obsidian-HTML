# Command Library Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a built-in Enhanced Markdown command-library template that turns ordinary `##` categories and `[!command]` callouts into a searchable, navigable, copyable card library.

**Architecture:** Obsidian's native `MarkdownRenderer` continues to own Markdown parsing. A focused trusted DOM enhancer runs after native rendering only for the built-in `command-library` template, while a separate template package owns the approved categorized layout and light/dark CSS. The Enhanced Markdown component lifecycle owns every event listener so rerenders and view closure remain safe.

**Tech Stack:** TypeScript 6, Obsidian Plugin API 1.13, native DOM APIs, existing Markdown template catalog, Vitest 4 with jsdom, scoped template CSS.

## Global Constraints

- Markdown source stays valid and readable in Obsidian source and native preview modes.
- `##` headings define categories; `[!command]` callouts define cards.
- The first fenced code block is the exact copy payload; remaining callout content is the description.
- The template ID is `command-library` and ships with `light` and `dark` themes.
- No script privileges are added to template packages.
- Existing annotations, links, embeds, math, tables, lists, callouts, and template selection rules remain compatible.
- Version 1 does not execute commands or add variables, parameter forms, favorites, analytics, or card editing.

---

### Task 1: Command Library DOM Enhancer

**Files:**
- Create: `src/markdown/command-library.ts`
- Create: `tests/markdown-command-library.test.ts`
- Modify: `tests/mocks/obsidian.ts`

**Interfaces:**
- Consumes: a rendered template root, an Obsidian `Component`, clipboard adapter, and notice adapter.
- Produces: `mountCommandLibrary(input: MountCommandLibraryInput): CommandLibraryResult`.

- [ ] **Step 1: Write failing category and card transformation tests**

Create a rendered DOM fixture with direct `h2` elements and Obsidian callout markup. Assert that only valid `.callout[data-callout="command"]` elements receive command-card classes, category buttons contain heading text and counts, duplicate headings receive different target IDs, content before the first heading moves into the introduction hook, ordinary callouts stay unchanged, malformed command callouts without `pre > code` stay unchanged, and a document without `h2` headings receives one `Commands` category.

```ts
const result = mountCommandLibrary({
  component: new Component(),
  copyText: vi.fn(async () => undefined),
  root,
  showNotice: vi.fn()
});

expect(result.commandCount).toBe(2);
expect(root.querySelectorAll(".command-library-card")).toHaveLength(2);
expect([...root.querySelectorAll(".command-library-category-button")].map((item) => item.textContent))
  .toEqual([expect.stringContaining("Git"), expect.stringContaining("Docker")]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/markdown-command-library.test.ts`

Expected: FAIL because `src/markdown/command-library.ts` does not exist.

- [ ] **Step 3: Implement category discovery and safe card enhancement**

Define narrow interfaces and use rendered DOM only:

```ts
export interface MountCommandLibraryInput {
  component: Component;
  copyText(text: string): Promise<void>;
  root: HTMLElement;
  showNotice(message: string): void;
}

export interface CommandLibraryResult {
  categoryCount: number;
  commandCount: number;
}

export function mountCommandLibrary(input: MountCommandLibraryInput): CommandLibraryResult;
```

Build stable category IDs with a slug plus numeric suffix. Associate each valid command callout with the nearest preceding direct-child `h2`; when no `h2` exists, create a `Commands` category. Move only content preceding the first `h2` into `[data-command-library-introduction]`. Preserve invalid and unrelated DOM without deleting content. Extend the Obsidian `Component` test mock with its public cleanup registration method so lifecycle behavior is verified through the same API used in production.

- [ ] **Step 4: Add failing search, keyboard, category, and clipboard tests**

Assert that:

- search matches title, code, description, and category case-insensitively;
- nonmatching cards and empty categories use the `hidden` property;
- `/` focuses search when focus is outside an input;
- `Escape` clears search;
- category click calls `scrollIntoView` on the matching section;
- copy passes exact multiline code text to the adapter;
- copy failure calls `showNotice("Unable to copy command.")`;
- `component.unload()` removes registered DOM listeners.

- [ ] **Step 5: Implement interactions and lifecycle cleanup**

Use delegated click handlers for category and copy actions, a single `input` handler for search, and a root-scoped `keydown` handler. Register DOM listeners with `component.registerDomEvent(...)` and timer cleanup with `component.register(...)`. Set copy feedback through a fixed-size button's `data-copy-state` and accessible label, then clear it with a bounded timer.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm test -- tests/markdown-command-library.test.ts && npm run typecheck`

Expected: all command-library tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit the enhancer**

```bash
git add src/markdown/command-library.ts tests/markdown-command-library.test.ts tests/mocks/obsidian.ts
git commit -m "feat: enhance Markdown command callouts"
```

### Task 2: Built-In Command Library Template

**Files:**
- Create: `src/markdown/templates/command-library.ts`
- Modify: `src/markdown/templates/built-in.ts`
- Modify: `tests/markdown-render-document.test.ts`
- Modify: `tests/markdown-template-catalog.test.ts`

**Interfaces:**
- Consumes: existing `MarkdownTemplatePackage` and `BUILT_IN_TEMPLATES` catalog conventions.
- Produces: `COMMAND_LIBRARY_TEMPLATE_ID` and `COMMAND_LIBRARY_TEMPLATE`.

- [ ] **Step 1: Write failing template catalog and contract tests**

Assert the catalog exposes `command-library` after the existing built-ins, both themes are available, and the layout contains these hooks:

```ts
for (const hook of [
  'data-command-library-search',
  'data-command-library-categories',
  'data-command-library-introduction',
  'data-command-library-empty',
  'data-slot="content"'
]) {
  expect(template?.layout).toContain(hook);
}
```

Assert the stylesheet covers cards, category navigation, fixed-size copy controls, search, empty results, horizontal code scrolling, light/dark variables, and a narrow-pane media query.

- [ ] **Step 2: Run template tests and verify RED**

Run: `npm test -- tests/markdown-render-document.test.ts tests/markdown-template-catalog.test.ts`

Expected: FAIL because the catalog does not contain `command-library`.

- [ ] **Step 3: Implement the approved template package**

Create `COMMAND_LIBRARY_TEMPLATE` with a compact title/search header, category rail, introduction area, category/content region, and no-results element. Use restrained neutral surfaces with green, blue, and amber accents rather than a one-hue palette. Keep card radius at 6px, controls at stable dimensions, font sizes appropriate to a dense reference tool, and CSS rooted under `.command-library-page` for scoping.

```ts
export const COMMAND_LIBRARY_TEMPLATE_ID = "command-library";
export const COMMAND_LIBRARY_TEMPLATE: MarkdownTemplatePackage = {
  layout: `...`,
  manifest: {
    defaultTheme: "light",
    description: "Searchable categorized command cards for operational reference notes.",
    id: COMMAND_LIBRARY_TEMPLATE_ID,
    name: "Command Library",
    themes: [
      { id: "light", name: "Light library", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark library", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `...`,
  themes: { light: `...`, dark: `...` }
};
```

- [ ] **Step 4: Register the template as a trusted built-in**

Import it in `src/markdown/templates/built-in.ts`, append it to `BUILT_IN_TEMPLATES`, and keep `BUILT_IN_TEMPLATE` as the fallback. Update exact catalog expectations to include the new summary without changing Vault-template precedence.

- [ ] **Step 5: Run template tests and typecheck**

Run: `npm test -- tests/markdown-render-document.test.ts tests/markdown-template-catalog.test.ts && npm run typecheck`

Expected: selected tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the template**

```bash
git add src/markdown/templates/command-library.ts src/markdown/templates/built-in.ts tests/markdown-render-document.test.ts tests/markdown-template-catalog.test.ts
git commit -m "feat: add command library Markdown template"
```

### Task 3: Enhanced Markdown Integration

**Files:**
- Modify: `src/markdown/render-document.ts`
- Modify: `src/markdown/enhanced-markdown-view.ts`
- Modify: `tests/markdown-render-document.test.ts`
- Modify: `tests/enhanced-markdown-view.test.ts`

**Interfaces:**
- Consumes: `mountCommandLibrary`, `COMMAND_LIBRARY_TEMPLATE_ID`, the existing `Component`, and Enhanced Markdown environment notice callback.
- Changes: `RenderEnhancedMarkdownInput` gains optional `copyText` and `showNotice` adapters.

- [ ] **Step 1: Write failing renderer integration tests**

Mock `MarkdownRenderer.render` to emit category headings, valid command callouts, and ordinary Markdown. Render with `COMMAND_LIBRARY_TEMPLATE`, then assert command cards and category navigation exist. Render with `BUILT_IN_TEMPLATE`, then assert command-library enhancement does not run.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm test -- tests/markdown-render-document.test.ts tests/enhanced-markdown-view.test.ts`

Expected: FAIL because `renderEnhancedMarkdown` does not mount command-library behavior.

- [ ] **Step 3: Wire trusted behavior after native Markdown rendering**

Extend the render input without changing existing callers:

```ts
export interface RenderEnhancedMarkdownInput {
  // existing fields remain
  copyText?(text: string): Promise<void>;
  showNotice?(message: string): void;
}
```

When `template.manifest.id === COMMAND_LIBRARY_TEMPLATE_ID`, call `mountCommandLibrary` after `MarkdownRenderer.render` and before annotation application. Default `copyText` to `navigator.clipboard.writeText` and `showNotice` to a no-op for pure renderer callers.

- [ ] **Step 4: Pass the view's notice and clipboard adapters**

In `EnhancedMarkdownView.render`, pass `showNotice: this.environment.showNotice` and a clipboard adapter that uses `navigator.clipboard.writeText`. Keep errors inside the command enhancer so an unavailable clipboard never aborts the document render.

- [ ] **Step 5: Verify annotation and rerender compatibility**

Add a view test that loads the command template, rerenders through the coordinator, confirms there is only one effective search/copy handler, and proves command text remains inside `[data-slot="content"]` so the existing annotation surface can select it.

- [ ] **Step 6: Run integration tests and full Markdown regression tests**

Run: `npm test -- tests/markdown-command-library.test.ts tests/markdown-render-document.test.ts tests/enhanced-markdown-view.test.ts tests/markdown-plugin-integration.test.ts`

Expected: all selected tests pass.

- [ ] **Step 7: Commit integration**

```bash
git add src/markdown/render-document.ts src/markdown/enhanced-markdown-view.ts tests/markdown-render-document.test.ts tests/enhanced-markdown-view.test.ts
git commit -m "feat: integrate command library interactions"
```

### Task 4: Bilingual Documentation, Release Build, And Local Deployment

**Files:**
- Modify: `README.md`
- Modify: `docs/wiki/annotation-optimization.md`
- Modify: `main.js`
- Modify: `styles.css` only if Obsidian-host chrome needs non-template styling

**Interfaces:**
- Consumes: completed template and interactions.
- Produces: documented usage and deployable Obsidian release files.

- [ ] **Step 1: Document the Markdown contract in both README languages**

Add matching English and Chinese sections showing:

```markdown
## Git

> [!command] Undo the latest commit
> ```bash
> git reset --soft HEAD~1
> ```
> Keep staged changes.
```

Document template selection through the chooser, folder mapping, and `html-preview.template: command-library` frontmatter. Explain search, category navigation, exact copy behavior, malformed-callout fallback, and the fact that source Markdown is unchanged.

- [ ] **Step 2: Add the feature to the Wiki roadmap with verification status**

Add a `verify` item covering the command-library template, ordinary Markdown compatibility, navigation/search/copy, annotations, and responsive themes. Use `done` only after real Obsidian validation.

- [ ] **Step 3: Run complete verification**

Run: `npm run check && git diff --check`

Expected: all tests pass, typecheck exits 0, production build succeeds, release validation succeeds, and diff check reports no whitespace errors.

- [ ] **Step 4: Deploy release files to the local Vault plugin directory**

```bash
plugin_dir="/Users/hangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/obsidian-html"
cp main.js manifest.json styles.css "$plugin_dir/"
```

- [ ] **Step 5: Manually verify the approved layout**

Open a command note in Obsidian Enhanced reading and confirm light/dark themes, desktop and narrow pane alignment, category scrolling, search, exact multiline copy, malformed callout fallback, and text annotation. Keep the Wiki item at `verify` if this still depends on user confirmation.

- [ ] **Step 6: Commit documentation and release artifacts**

```bash
git add README.md docs/wiki/annotation-optimization.md main.js styles.css
git commit -m "docs: document command library template"
```
