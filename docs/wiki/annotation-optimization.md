# Annotation Optimization Wiki

Last updated: 2026-08-09

Status legend:

- `done`: implemented and verified in automated checks
- `in_progress`: currently being implemented
- `pending`: agreed direction, not started yet
- `verify`: implemented locally and waiting for user validation in Obsidian

## Current Priorities

- [x] `done` Unify plugin technical identity as `obsidian-html`
- [x] `done` Re-anchor annotations after content shifts and persist recovered targets
- [x] `done` Sync sidebar save/delete changes back to the main reading surface immediately
- [x] `done` Preserve sidebar annotation source when switching to another right-side tab
- [x] `done` Polish the sidebar annotation edit modal
- [x] `done` Add clearer bulk and management actions for the sidebar
- [x] `done` Add annotation export to Markdown
- [x] `done` Harden re-anchor heuristics for repeated quotes and larger text rewrites
- [x] `done` Reorganize annotation sidebar management tools into a responsive drawer with destructive-action confirmation
- [x] `done` Remove the redundant repair action from annotation cards; card clicks already navigate to highlights

## Next Roadmap

Items are ordered by user value and implementation dependency. Each item should be moved to `in_progress` before coding and to `done` only after automated verification and a local Vault build.

- [x] `done` Repair annotations that can no longer be located after source rewrites
  - Start repair from the sidebar and select a replacement passage in HTML Preview or Enhanced Markdown Reading.
  - Preserve the existing annotation ID, color, and comment while replacing its quote target.
  - Keep the original source files unchanged and persist only the annotation data update.
- [x] `done` Search and filter annotations across the entire Vault
  - Search quote text and comment text.
  - Filter by file, folder, color, and comment status.
  - Open the source file and focus the selected annotation.
- [x] `done` Expand annotation workflow controls
  - Add keyboard shortcuts, copy quote/comment actions, and batch color/export operations.
  - Keep destructive batch actions explicit and recoverable.
- [x] `done` Expand the template system
  - Support custom template packages, preview thumbnails, reusable variables, and rule precedence inspection.
- [x] `done` Improve HTML cleanup workflow
  - Add before/after comparison, stronger candidate grouping, and a clear restore-original action.
- [x] `done` Improve reading experience
  - Persist scroll position, add print/PDF output, synchronized outline scrolling, image lightbox, and code-copy controls.
- [ ] `in_progress` Reduce runtime drift and improve resilience
  - [x] `done` Safely recover from malformed annotation JSON without blocking previews or the sidebar.
  - [x] `done` Keep DOM and iframe annotation resolution logic generated from one source.
  - [ ] `pending` Add annotation data migration and clearer script/resource security controls.

## Notes

- Hidden Vault data stays under `.html-preview/` for backward compatibility.
- Plugin runtime identity is now `obsidian-html`; local plugin folder and manifest ID should match.
- Immediate synchronization between sidebar and reading views should no longer depend on full view rebuilds.
