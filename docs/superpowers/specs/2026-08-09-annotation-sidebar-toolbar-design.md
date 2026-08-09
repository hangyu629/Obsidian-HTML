# Annotation Sidebar Toolbar Design

**Date:** 2026-08-09
**Status:** Approved direction

## Goal

Replace the scattered annotation sidebar controls with a compact hierarchy that remains clear at both narrow and wide sidebar widths. Preserve every existing filter, sort, recolor, export, and delete capability.

## Layout

The sidebar uses three visual levels:

1. The header contains the title, annotation count, and Vault-wide search icon.
2. A compact filter row contains the three annotation filters and a trailing management toggle using the `sliders-horizontal` icon.
3. A collapsible management band appears below the filter row only while the toggle is active.

The management band is closed by default. It contains the sort select, batch color select, Markdown export command, and filtered-delete command. Controls use a compact grid instead of distributing themselves across the available width. At narrow widths the grid becomes a single column.

The management band is an unframed sidebar section with a separating border and subtle alternate background. It is not a nested card. All colors, focus states, borders, and hover states use Obsidian theme variables.

## Interaction

- Filtering and annotation refreshes preserve the management band's open state.
- Changing the source file closes the management band and resets the filter as it does today.
- The management toggle exposes `aria-expanded` and `aria-controls`.
- Export remains a direct command inside the band.
- Batch recoloring applies to the current filtered set.
- Filtered deletion opens a confirmation modal that states how many annotations will be removed. No annotations are removed unless the user confirms.
- Controls are disabled when the current filtered set is empty.

## Components

`AnnotationSidebarView` owns the open/closed state and renders the header, filter row, management band, and annotation list. A small dedicated confirmation modal owns the destructive confirmation flow. No persistence schema or service interface changes are required.

## Testing

Automated tests cover:

- The management band is closed by default and toggles through an accessible button.
- Filter and refresh renders preserve the open state.
- Source changes close the management band.
- Sort, recolor, and export continue to work from the band.
- Filtered deletion does nothing before confirmation and removes the visible set after confirmation.
- CSS provides a bounded responsive grid without `space-between` distribution.

Visual verification covers narrow and wide Obsidian sidebar widths in light and dark themes. The final build is copied to the local Vault plugin directory after all checks pass.

## Non-Goals

- Changing annotation storage or anchoring behavior.
- Redesigning annotation list entries or the contextual annotation editor.
- Modifying source HTML or Markdown files.
