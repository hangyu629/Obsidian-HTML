# Insert Command Card Design

**Date:** 2026-08-10
**Status:** Approved direction

## Goal

Add a native Obsidian command named `Insert command card` that lets a user create correctly formatted `[!command]` Markdown without manually writing Callout prefixes or code fences.

## Availability

The command is registered through Obsidian's editor command API and is available when a Markdown editor is active. It works in source mode and Live Preview. It does not directly edit a note from Enhanced reading; the user returns to Markdown before inserting content.

If the editor has a selection, the selected text pre-fills the command field and is replaced by the generated card after confirmation. With no selection, the card is inserted at the cursor.

## Modal

The modal contains:

- required title input;
- language dropdown;
- required multiline command input;
- optional multiline description input;
- Cancel and Insert actions.

The language dropdown contains `bash`, `shell`, `powershell`, `python`, `javascript`, `typescript`, `sql`, `dockerfile`, `yaml`, `json`, and `text`. It defaults to `bash` and remembers the most recently inserted language for the current plugin session.

The modal uses Obsidian variables, compact labels, stable field dimensions, clear focus states, and a primary Insert action. Submit is available through the button or `Cmd/Ctrl + Enter`; `Escape` closes without modifying the editor. While validation is failing, the modal shows a concise inline message and leaves the editor untouched.

## Generated Markdown

For title `Undo the latest commit`, language `bash`, command `git reset --soft HEAD~1`, and description `Keep staged changes.`, the generator produces:

````markdown
> [!command] Undo the latest commit
> ```bash
> git reset --soft HEAD~1
> ```
> Keep staged changes.
````

Every command and description line receives a `> ` prefix, including lines in multiline commands. The title is collapsed to one line. The language value comes from the fixed allowlist.

The code fence is chosen dynamically: three backticks normally, or one more backtick than the longest backtick run inside the selected command. This prevents command content from closing the fence early.

The inserted block is surrounded by enough newlines to remain a block-level Callout when inserted in the middle of existing text. The generator does not modify any other Markdown content.

## Architecture

- `src/markdown/command-card.ts` owns pure input normalization, validation, code-fence selection, and Markdown generation.
- `src/markdown/command-card-modal.ts` owns the form, pending-free validation state, keyboard submission, and polished modal DOM.
- `src/main.ts` registers the editor command, snapshots the current selection range, opens the modal with the selected text, remembers the session language, and replaces that range only after valid submission.
- `styles.css` owns modal layout and responsive styling.

The modal receives and returns plain form values and never accesses the `Editor` directly. Cancellation and validation failures perform no writes.

## Failure Handling

- Empty title: show `Enter a title.`
- Empty or whitespace-only command: show `Enter a command.`
- Unsupported language received programmatically: normalize to `text`.
- Clipboard or annotation behavior is unrelated and unchanged.
- Editor selection changes while the modal is open: insertion still replaces the range captured when the command opened; this v1 does not attempt collaborative document reconciliation if the note itself changes concurrently.

## Testing

Automated tests cover:

- single-line and multiline Markdown generation;
- dynamic fences for commands containing backticks;
- title normalization and optional description;
- language allowlist fallback;
- modal dropdown options, selection prefill, validation, submit shortcut, and cancellation;
- editor command registration and replacement only after submit;
- session language reuse;
- existing Command Library rendering and all plugin regression tests.

Final verification runs `npm run check`, updates the tracked release bundle, copies release files into the local Vault plugin directory, and keeps the Wiki item at `verify` until the user confirms the workflow in Obsidian.

## Completion Criteria

The feature is complete when a user can select or type a command through a native modal, insert valid command-card Markdown at the active Markdown editor position with one action, safely handle multiline and backtick-containing commands, reuse the last session language, cancel without changes, and render the result correctly through the existing Command Library template.
