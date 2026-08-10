# Command Library Template Design

**Date:** 2026-08-09
**Status:** Proposed for implementation

## Goal

Add a built-in Enhanced Markdown template for command reference notes. The Markdown source remains ordinary Obsidian Markdown, while Enhanced reading presents command callouts as a searchable, categorized card library with a compact sidebar and one-click copy actions.

## Markdown Contract

Second-level headings define command categories. A `[!command]` callout defines one command card. The callout title becomes the card title, its first fenced code block supplies the command and language label, and the remaining callout body becomes the description.

```markdown
---
html-preview.template: command-library
html-preview.theme: light
---

## Git

> [!command] Undo the latest commit
> ```bash
> git reset --soft HEAD~1
> ```
> Keep the working tree and index unchanged.

## Docker

> [!command] Follow API logs
> ```bash
> docker compose logs -f api
> ```
```

The source remains readable in native source and preview modes. The plugin does not rewrite the Markdown file or require custom fenced-block syntax.

## Template And Layout

The built-in template ID is `command-library`. It is selectable through the existing template chooser, frontmatter, default-template setting, and per-folder mappings. It ships with coordinated light and dark themes.

The desktop layout contains:

- a compact header with the note title and command search field;
- a sticky left category rail generated from `##` headings;
- a main command column with dense cards grouped by category;
- card title, language label, exact command text, description, and copy icon.

Selecting a category scrolls to its section rather than hiding the rest of the document. Search filters command cards across every category using title, command, description, and category text. Empty categories disappear while a search is active. A compact no-results state appears when nothing matches.

On narrow panes, the category rail becomes a horizontally scrollable category control above the content. Cards remain single-column, command text scrolls horizontally, and controls keep stable dimensions so content changes do not shift the layout.

## Rendering Architecture

Obsidian's `MarkdownRenderer` remains the sole Markdown parser. After native rendering completes, a command-library postprocessor runs only when the selected template ID is `command-library`:

1. Discover rendered `h2` elements and assign stable category sections.
2. Find `.callout[data-callout="command"]` elements belonging to each section.
3. Extract the callout title and first `pre > code` block without reparsing Markdown.
4. Add semantic card classes, language metadata, and a trusted plugin-owned copy button.
5. Build the category navigation and search index from the rendered DOM.

The template package itself remains HTML and CSS only. It receives no script privileges. Interactive behavior is registered through the Enhanced Markdown view component lifecycle, so event listeners are released when the note rerenders or the view closes.

Regular callouts, headings, tables, images, lists, links, math, footnotes, embeds, and other Markdown output remain rendered by Obsidian. Content before the first second-level heading appears in an introductory region above the command library.

## Interaction

The search field filters immediately and can be focused with `/` while the command view is active. `Escape` clears the current query. Search does not modify the source note.

The copy button copies the exact text content of the first fenced code block, preserving line breaks for multi-line commands. A short success state changes the icon and accessible label without resizing the button. Clipboard failure produces an Obsidian notice and leaves the card unchanged.

Category buttons use the heading text and command count. Clicking one scrolls its category into view and updates the active category state. Native heading links and document scrolling continue to work.

Annotations remain available in Enhanced reading. Plugin-owned search, navigation, and copy controls are excluded from annotation selection surfaces; command and description text remain selectable and annotatable.

## Failure Handling

- No second-level headings: create a single `Commands` category for valid command callouts.
- A command callout without a fenced code block: leave it as a normal callout so content is never lost.
- Duplicate category headings: keep their document order and generate unique internal IDs.
- No valid command callouts: show the rendered Markdown unchanged with a compact empty-library message in the template chrome.
- Clipboard unavailable or denied: show a concise notice and preserve the current view.
- Rerender during search or copy feedback: discard stale handlers and rebuild from the newest rendered document.

## Scope

Version 1 includes:

- built-in `command-library` template;
- light and dark themes;
- `##` category extraction;
- `[!command]` card transformation;
- category navigation;
- search;
- one-click copy;
- responsive layout;
- compatibility with existing template selection rules and annotations.

Version 1 excludes command execution, variables, parameter forms, favorites, usage analytics, editing inside cards, nested category trees, and plugin-specific source serialization.

## Testing And Verification

Automated tests cover:

- built-in template catalog and theme availability;
- category extraction and duplicate headings;
- valid and malformed command callouts;
- preservation of unrelated Markdown and callouts;
- search matching and no-results behavior;
- exact single-line and multi-line clipboard text;
- copy failure handling;
- handler cleanup across rerenders;
- existing annotations and template selection behavior.

Final verification runs `npm run check`, copies `main.js`, `manifest.json`, and `styles.css` to the local Vault plugin directory, and manually checks the template in Obsidian at desktop and narrow sidebar widths in both themes.

## Completion Criteria

The feature is complete when a Markdown note using second-level category headings and command callouts can open in Enhanced reading as the approved categorized command-library layout, search and category navigation work without source changes, copy returns exact command text, malformed content degrades safely, annotations remain usable, and the layout stays aligned in light, dark, desktop, and narrow-pane states.
