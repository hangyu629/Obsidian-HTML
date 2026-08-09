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
- [ ] `pending` Harden re-anchor heuristics for repeated quotes and larger text rewrites

## Notes

- Hidden Vault data stays under `.html-preview/` for backward compatibility.
- Plugin runtime identity is now `obsidian-html`; local plugin folder and manifest ID should match.
- Immediate synchronization between sidebar and reading views should no longer depend on full view rebuilds.
