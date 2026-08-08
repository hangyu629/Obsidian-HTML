# Contextual Annotations Design

## Goal

Replace the current toolbar-driven annotation flow with a polished selection-first interaction for both HTML Preview and Enhanced Markdown. Annotations remain visible only in rendered HTML experiences; native Markdown source and native Markdown preview stay unchanged.

The feature must:

- keep article text selectable at all times;
- show a compact contextual toolbar after a non-empty text selection;
- support five soft highlight colors and text comments;
- edit existing highlights beside the highlighted text;
- expose annotations in a dedicated Obsidian right-sidebar view;
- remove the fixed `Add annotation` and `Manage annotations` view actions.

## Confirmed Interaction

### New selection

After the pointer or keyboard selection settles, a compact toolbar appears near the selection. It has two primary entries:

- `颜色` opens a five-color palette. Choosing a color immediately saves a highlight with an empty comment.
- `注释` immediately applies the default yellow color and opens the larger nearby editor with the comment field focused.

The palette contains soft yellow, green, blue, pink, and violet. The last color chosen through `颜色` is remembered for the current Obsidian session and is preselected the next time the palette opens. `注释` always starts with yellow so its behavior is predictable.

The contextual toolbar is dismissed when the selection collapses, the user clicks elsewhere, presses `Escape`, switches files, or leaves the rendered view. Toolbar interaction must preserve the captured range instead of losing it when a control receives focus.

### Nearby editor (chosen approach C)

The editor is a substantial but compact floating surface anchored below or above the selected text according to available viewport space. It contains:

- a short, truncated quotation from the selected text;
- the same five-color palette;
- a multiline comment field;
- `仅高亮` and `保存批注` commands for a new selection;
- `删除高亮` and `保存修改` commands for an existing annotation;
- a close control.

The editor never covers the selected line when another placement is available. It stays inside the view bounds, flips above the anchor near the bottom edge, and becomes a bottom sheet on narrow/mobile views. `Cmd/Ctrl+Enter` saves and `Escape` closes. Closing an unsaved new editor removes its provisional yellow highlight; closing an existing editor leaves the stored annotation unchanged.

Clicking an existing highlight opens this editor with its current color and comment. Saving updates the existing annotation ID instead of creating a duplicate.

### Right sidebar

Register an Obsidian `ItemView` named `注释`, available beside native views such as Outline and Tags. Opening or activating an annotatable HTML or Enhanced Markdown leaf updates the sidebar to that source file.

The sidebar provides:

- a heading and annotation count;
- `全部`, `有批注`, and `仅高亮` filters;
- a vertically ordered list using document order;
- a colored edge, quotation excerpt, and optional comment for each item;
- a clear empty state when the current file has no annotations.

The sidebar is intentionally browse-first. Clicking an item asks the active rendered view to scroll its highlight into the center of the viewport and briefly emphasize it. Editing stays beside the text. If a stored anchor cannot be resolved after the source changes, the item remains visible with an `无法定位` state and clicking it shows a notice rather than scrolling to the wrong text.

The sidebar follows the active eligible leaf. When the active leaf is native Markdown source/preview, it can still list that file's annotations, but clicking an item opens Enhanced Markdown before locating it. For unrelated file types it shows a neutral empty state.

## Visual Direction

The UI follows Obsidian's active theme variables instead of imposing a separate application theme. The contextual surfaces use restrained neutral backgrounds, a one-pixel border, an 8px maximum radius, and a soft two-level shadow. Text uses Obsidian's interface font; quotation excerpts may use the rendered template's reading font when practical.

Visual hierarchy:

1. The selected/highlighted text remains the focal point.
2. The nearby editor presents color and writing controls without looking like a modal dialog.
3. Sidebar items are unframed by default; only hover and active items gain a subtle surface.

The five colors are represented by circular swatches with accessible labels and visible selected/focus rings. Highlight opacity is strong enough to identify but low enough to preserve text contrast in light and dark themes. No gradient, decorative illustration, or nested card treatment is used.

## Architecture

### Shared annotation model

Extend `HtmlAnnotation` with an optional color value:

```ts
type AnnotationColor = "yellow" | "green" | "blue" | "pink" | "violet";

interface HtmlAnnotation {
  color?: AnnotationColor;
  comment: string;
  id: string;
  quote: string;
  sourcePath: string;
  target: HtmlAnnotationTarget;
}
```

Missing `color` values from existing files resolve to `yellow`. Empty comments are valid and represent highlight-only annotations. The persisted document remains version 1 because both changes are backward-compatible additions; validation accepts a missing color and rejects unknown colors. The existing ID-based upsert behavior becomes an explicitly named save operation while preserving compatibility for current callers.

### Annotation service

Add a plugin-owned annotation service around the store. It has three responsibilities:

- load, save, and remove annotations;
- emit source-scoped change notifications so open views and the sidebar refresh together;
- track registered rendered-view adapters that can focus an annotation.

Each HTML Preview or Enhanced Markdown view registers an adapter while loaded:

```ts
interface AnnotationViewAdapter {
  readonly sourcePath: string;
  focusAnnotation(id: string): Promise<boolean>;
}
```

This keeps workspace/sidebar coordination out of the persistence layer and prevents the sidebar from reaching into view internals.

### HTML Preview runtime

HTML Preview content lives in a sandboxed iframe, so selection geometry and the contextual UI remain inside the iframe. The injected annotation runtime owns:

- selection capture and stable target creation;
- compact toolbar and nearby editor rendering;
- provisional and persisted highlight rendering;
- existing-highlight click handling;
- scrolling/emphasis when the host requests focus.

The runtime sends validated `save` and `delete` messages to the host containing the annotation ID, target, quote, color, and comment. The host persists through the annotation service, then sends a success or failure response. The runtime keeps the editor open on failure and only commits its local visual state after success. All messages remain scoped by the current `renderId` and source iframe.

HTML annotations continue to require plugin-injected JavaScript. When scripts are disabled, stored highlights and contextual interaction are unavailable in the iframe; the sidebar remains readable and explains that HTML Preview JavaScript must be enabled before attempting to locate or edit.

### Enhanced Markdown interaction

Enhanced Markdown uses the same behavior but mounts native DOM components in the view rather than iframe script strings:

- a reusable selection-toolbar component;
- a reusable nearby-editor component;
- the existing target capture and highlight helpers, extended for colors and ID clicks.

The view listens for completed selections within its rendered content and for clicks on annotation marks. It saves through the annotation service and reapplies highlights after successful changes. Native Markdown source and native Markdown preview receive no marks or annotation controls.

### Sidebar view

Add `AnnotationSidebarView extends ItemView` and register it in the plugin. The plugin exposes a ribbon/command entry to reveal the sidebar when it is not already open. The sidebar listens to active-leaf changes and annotation-service changes, then renders the appropriate source list.

When an item is clicked, it resolves the rendered adapter for that file. If native Markdown is active, the plugin first opens Enhanced Markdown for the same file, waits for its adapter to register, and then requests focus. HTML files open in their registered HTML Preview view as usual.

## Data Flow

### Create a comment

1. User selects rendered text.
2. View/runtime captures quote, offsets, prefix, and suffix before focus moves.
3. User chooses `注释`; a provisional yellow highlight appears and the nearby editor opens.
4. User saves.
5. View/runtime submits the annotation to the annotation service.
6. The service persists it and emits a source-scoped change event.
7. Rendered views and the sidebar refresh without requiring a full file reload where possible.

### Create a highlight only

1. User selects text and opens `颜色`.
2. User chooses one of five colors.
3. The annotation is saved immediately with an empty comment.
4. The selected color becomes the session's last-used color.

### Edit or delete

1. User clicks a rendered annotation mark.
2. The nearby editor loads the stored annotation.
3. Save upserts the same ID; delete removes it after a lightweight confirmation inside the editor.
4. The service event refreshes both the rendered mark and sidebar item.

### Locate from sidebar

1. User clicks a sidebar item.
2. The sidebar asks the plugin for the active adapter for the source.
3. The adapter scrolls the matching mark into view and applies a brief focus pulse.
4. An unresolved target returns `false`; the sidebar reports `无法定位` without changing stored data.

## Error Handling

- Storage failure keeps the editor open, preserves the typed comment, and shows an Obsidian notice.
- Invalid iframe messages are ignored using strict type, length, color, render ID, and source checks.
- A stale selection is discarded if the view rerenders or switches files before saving.
- Overlapping new selections are rejected with a short notice in the first version; existing non-overlapping annotations remain unaffected.
- Unresolved saved anchors stay in the sidebar and are never silently deleted.
- Empty or whitespace-only comments saved through `保存批注` become highlight-only annotations rather than failing.

## Accessibility and Input

- All controls are keyboard reachable and have Chinese accessible names/tooltips.
- Focus moves to the comment field when `注释` is chosen and returns to the highlighted text when the editor closes.
- The toolbar/editor use `role="toolbar"` and `role="dialog"` semantics as appropriate.
- Focus rings use Obsidian theme variables and are never removed.
- Color is not the only status signal: selected swatches have a ring, and sidebar filters use text labels.
- Touch selections use the same compact toolbar; the full editor becomes a bottom sheet at narrow widths.

## Testing

### Unit tests

- Annotation parsing accepts legacy records and all five valid colors, defaults missing colors to yellow, and rejects unknown values.
- Store save updates an existing ID, accepts empty comments, and preserves serialization order.
- Annotation-service save and remove operations each emit exactly one source-scoped change.
- DOM target capture, colored highlight application, existing-mark lookup, and unresolved anchors behave deterministically.
- Contextual toolbar preserves selection, exposes the two entry points, remembers the last color, and dismisses correctly.
- Nearby editor handles create, edit, highlight-only, delete, keyboard save, cancel, and failure states.
- Iframe message parsing rejects stale, malformed, oversized, and wrong-render messages.
- Sidebar filtering, ordering, empty state, active-file changes, and focus requests are covered.

### Integration tests

- Selecting text in HTML Preview creates both highlight-only and commented annotations.
- Selecting text in Enhanced Markdown provides the same actions while native Markdown remains untouched.
- Clicking an existing highlight edits rather than duplicates it.
- Sidebar selection locates HTML and Enhanced Markdown annotations.
- The two old fixed annotation actions no longer exist.
- Existing annotation JSON created by the current plugin still renders yellow.

### Visual verification

Verify light and dark themes at desktop and narrow widths. Check toolbar placement near all viewport edges, editor flipping, bottom-sheet behavior, long quotations/comments, sidebar empty/loading/unresolved states, text selection, focus rings, and that neither contextual surface overlaps the active selection unnecessarily.

## Scope Boundaries

This version does not add annotation rendering to native Markdown modes, cross-file annotation search, tags, replies, rich-text comments, export, collaboration, or automatic re-anchoring after major source rewrites. The existing prefix/suffix data is retained for future re-anchoring work, but this implementation reports unresolved anchors instead of guessing.
