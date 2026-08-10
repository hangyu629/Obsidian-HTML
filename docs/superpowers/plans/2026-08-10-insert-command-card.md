# Insert Command Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Insert command card` Markdown editor command that collects structured values in a polished modal and inserts valid `[!command]` Markdown at the captured selection range.

**Architecture:** A pure command-card module owns normalization, validation, safe fence selection, and Markdown generation. A DOM modal owns only form state and emits validated plain values. `main.ts` snapshots the editor selection, registers the editor command, remembers the latest session language, and performs the final `replaceRange` write.

**Tech Stack:** TypeScript 6, Obsidian Editor/Modal/Plugin APIs, native DOM controls, Vitest 4 with jsdom, existing Obsidian-variable CSS.

## Global Constraints

- The command is available only with an active Markdown editor through `editorCallback`.
- Selected text pre-fills the command field and is replaced only after valid submission.
- Title and command are required; description is optional.
- Language comes from the fixed allowlist and defaults to `bash`.
- The most recently inserted language is remembered only for the current plugin session.
- Multiline command and description lines always receive a `> ` Callout prefix.
- Code fences must be longer than every backtick run in the command.
- Cancellation and validation failure never modify the editor.
- The modal never accesses an Obsidian `Editor` directly.

---

### Task 1: Safe Command Card Markdown Generator

**Files:**
- Create: `src/markdown/command-card.ts`
- Create: `tests/markdown-command-card.test.ts`

**Interfaces:**
- Produces: `COMMAND_CARD_LANGUAGES`, `CommandCardLanguage`, `CommandCardInput`, `normalizeCommandCardInput`, `validateCommandCardInput`, `buildCommandCard`, and `commandCardInsertionText`.

- [ ] **Step 1: Write failing generator tests**

Cover single-line output, multiline command and description prefixes, title newline collapse, empty description omission, unsupported-language fallback, whitespace validation, and dynamic fences for a command containing triple and quadruple backticks.

```ts
expect(buildCommandCard({
  command: "git fetch origin\ngit rebase origin/main",
  description: "Fetch first.\nThen rebase.",
  language: "bash",
  title: "Sync branch"
})).toContain("> git fetch origin\n> git rebase origin/main");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/markdown-command-card.test.ts`

Expected: FAIL because `src/markdown/command-card.ts` does not exist.

- [ ] **Step 3: Implement pure normalization, validation, and generation**

Use these public contracts:

```ts
export const COMMAND_CARD_LANGUAGES = [
  "bash", "shell", "powershell", "python", "javascript", "typescript",
  "sql", "dockerfile", "yaml", "json", "text"
] as const;

export type CommandCardLanguage = typeof COMMAND_CARD_LANGUAGES[number];

export interface CommandCardInput {
  command: string;
  description: string;
  language: string;
  title: string;
}

export function normalizeCommandCardInput(input: CommandCardInput): CommandCardInput & { language: CommandCardLanguage };
export function validateCommandCardInput(input: CommandCardInput): string | null;
export function buildCommandCard(input: CommandCardInput): string;
export function commandCardInsertionText(card: string, before: string, after: string): string;
```

`commandCardInsertionText` adds two leading newlines only when non-whitespace text precedes the captured range on its line, and two trailing newlines only when non-whitespace text follows it; otherwise it adds the single newline needed to keep the Callout block separated.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/markdown-command-card.test.ts && npm run typecheck`

Expected: selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the generator**

```bash
git add src/markdown/command-card.ts tests/markdown-command-card.test.ts
git commit -m "feat: generate safe command card Markdown"
```

### Task 2: Command Card Form Modal

**Files:**
- Create: `src/markdown/command-card-modal.ts`
- Create: `tests/markdown-command-card-modal.test.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: command-card language constants and validation.
- Produces: `InsertCommandCardModal` and `InsertCommandCardModalOptions`.

- [ ] **Step 1: Write failing modal tests**

Open the modal and assert title, language dropdown, command textarea, description textarea, Cancel, and Insert controls exist. Verify all allowlisted languages appear, selected text pre-fills command, the initial language is selected, empty title and command show exact validation messages, `Cmd/Ctrl + Enter` submits once, and Cancel closes without calling `onInsert`.

```ts
const onInsert = vi.fn();
const modal = new InsertCommandCardModal({} as never, {
  initialCommand: "git status",
  initialLanguage: "bash",
  onInsert
});
modal.open();
```

- [ ] **Step 2: Run modal tests and verify RED**

Run: `npm test -- tests/markdown-command-card-modal.test.ts`

Expected: FAIL because the modal module does not exist.

- [ ] **Step 3: Implement the modal with native structured controls**

Define:

```ts
export interface InsertCommandCardModalOptions {
  initialCommand: string;
  initialLanguage: CommandCardLanguage;
  onInsert(input: CommandCardInput & { language: CommandCardLanguage }): void;
}
```

Build labels and controls with `data-command-card-field` hooks. Keep the error paragraph at a stable minimum height. Validate through `validateCommandCardInput`; on success normalize, emit once, and close. Register keyboard handling through the Modal component lifecycle.

- [ ] **Step 4: Add polished responsive modal CSS**

Add `.command-card-modal`, `.command-card-modal-field`, `.command-card-modal-error`, and `.command-card-modal-actions`. Use Obsidian variables, 6px radii, a two-column title/language row that becomes one column below 520px, a stable multiline command area, right-aligned actions, visible focus, and no nested cards.

- [ ] **Step 5: Run modal tests and typecheck**

Run: `npm test -- tests/markdown-command-card-modal.test.ts && npm run typecheck`

Expected: selected tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the modal**

```bash
git add src/markdown/command-card-modal.ts tests/markdown-command-card-modal.test.ts styles.css
git commit -m "feat: add command card insertion modal"
```

### Task 3: Markdown Editor Command Integration

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/markdown-plugin-integration.test.ts`
- Modify: `README.md`
- Modify: `docs/wiki/annotation-optimization.md`
- Modify: `main.js`

**Interfaces:**
- Consumes: `InsertCommandCardModal`, `buildCommandCard`, and `commandCardInsertionText`.
- Changes: `HtmlPreviewPlugin` registers command ID `insert-command-card` and owns a session-only `lastCommandCardLanguage` property.

- [ ] **Step 1: Write failing editor command integration tests**

Load the plugin, find the stored command with ID `insert-command-card`, and invoke its `editorCallback` with a narrow editor mock implementing `getCursor`, `getLine`, `getRange`, and `replaceRange`. Assert the modal receives selected text, submission replaces the captured range with generated Markdown, cancellation performs no write, and the next invocation uses the language selected by the prior insertion.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `npm test -- tests/markdown-plugin-integration.test.ts`

Expected: FAIL because `insert-command-card` is not registered.

- [ ] **Step 3: Register and implement the editor command**

Import Obsidian `Editor` and the command-card modules. Add:

```ts
private lastCommandCardLanguage: CommandCardLanguage = "bash";
```

Register:

```ts
this.addCommand({
  id: "insert-command-card",
  name: "Insert command card",
  editorCallback: (editor) => this.openInsertCommandCardModal(editor)
});
```

Snapshot `from`, `to`, selected text, and the text immediately before/after the range on their lines. On modal submission, generate the card and insertion spacing, update the session language, and call `editor.replaceRange(insertion, from, to)` exactly once.

- [ ] **Step 4: Update bilingual documentation and Wiki status**

Document the command palette entry, selected-text prefill, language dropdown, insertion shortcut, and cancellation behavior in both README languages. Extend the existing Command Library Wiki item with an `Insert command card` verification bullet.

- [ ] **Step 5: Run full verification and diff checks**

Run: `npm run check && git diff --check`

Expected: all tests pass, typecheck exits 0, production bundle builds, release validation succeeds, and diff check is clean.

- [ ] **Step 6: Deploy the local release**

```bash
plugin_dir="/Users/hangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian/.obsidian/plugins/obsidian-html"
cp main.js manifest.json styles.css "$plugin_dir/"
```

- [ ] **Step 7: Commit integration, docs, and release artifacts**

```bash
git add src/main.ts tests/markdown-plugin-integration.test.ts README.md docs/wiki/annotation-optimization.md main.js
git commit -m "feat: insert command cards from Markdown editor"
```
