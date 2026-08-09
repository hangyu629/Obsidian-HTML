# HTML Smart Reading Design

**Date:** 2026-08-09
**Status:** Approved direction

## Goal

Add a smart reading mode for saved HTML pages. The mode extracts the main article, removes surrounding page chrome, and renders the result in a consistent reading layout. Existing manual cleanup remains available and its saved rules are applied before automatic extraction, so users can correct noisy extraction results with the workflow they already know.

Smart reading starts as a reversible preview. From that preview, the user may explicitly replace the current HTML file with the clean standalone reading page. The plugin creates a hidden restorable backup before replacing the source. Enhanced Markdown Reading is outside this feature and remains unchanged.

## User Experience

HTML Preview gains one `Smart reading` view action. Activating it replaces the normal page presentation in the current tab with the extracted reading document. Activating the action again returns to the normal HTML preview at the prior scroll position.

The existing `Clean up page`, `Undo cleanup`, `Manage cleanup rules`, and `View original page` actions remain unchanged in normal preview. Smart reading does not introduce a second cleanup editor or a second cleanup data format. When extraction contains unwanted content, the user returns to normal preview, hides the unwanted regions with `Clean up page`, and enters smart reading again. The saved cleanup rules are applied before the next extraction.

While smart reading is active, actions that only operate on the original page cleanup runtime are unavailable. Annotation selection, existing annotation focus, internal and external link handling, images, and scroll restoration remain available where their content is present in the extracted article.

Smart reading also exposes a `Save reading page` action. It opens a focused confirmation modal that identifies the current file, explains that the HTML will be replaced, and states that the prior source can be restored. Only the explicit primary confirmation performs the write. After a successful save, the current view reloads the new standalone HTML.

When a backup exists, HTML Preview exposes `Restore original page`. Restore also requires confirmation because it replaces the current file. A successful restore removes the consumed backup and reloads the source. The normal temporary `View original page` action remains the cleanup comparison control and is not renamed or repurposed.

## Extraction Pipeline

A focused reader-document builder owns the transformation:

1. Parse the saved HTML source into a detached document.
2. Resolve every effective cleanup rule through the existing cleanup locator and remove matched elements from the detached document.
3. Run Mozilla Readability on that cleaned document.
4. Reject an empty or implausibly short result and return a structured failure instead of a blank page.
5. Sanitize the extracted fragment. Source scripts, frames, forms, embedded objects, event-handler attributes, and executable URLs are not carried into the reader document.
6. Resolve relative links and media against the source HTML's Vault directory using the same navigation and resource expectations as normal preview.
7. Build a self-contained reader shell with semantic article metadata, restrained typography, responsive tables and media, and an explicit light or dark theme derived from the current Obsidian host theme.
8. Install only the plugin-owned bridge required for annotations, navigation, and reading continuity.

The builder returns two related artifacts: the sandbox preview document containing the plugin bridge, and a standalone save document containing no plugin runtime. It also returns title/byline/excerpt metadata when available, local dependencies, diagnostics, and either a success or a typed extraction failure.

The standalone document includes a small marker meta element, semantic article markup, the reader stylesheet, and the original relative links and media references. It contains no author scripts or plugin bridge. It must remain readable when opened directly in a browser from its Vault location.

## Cleanup Relationship

The source of truth remains the current versioned cleanup-rule storage under `.html-preview/cleanup/`. Smart reading loads the same effective file and folder rules as normal preview. It uses `resolveCleanupRule` against a detached source document and removes resolved targets before Readability runs.

Rules that no longer match continue to use the existing diagnostics and management workflow. Smart reading creates no reader-specific selectors. Undoing, deleting, resetting, or promoting an existing cleanup rule changes both normal preview and the next smart-reading render.

After the reading page replaces the source, its marker tells HTML Preview not to replay cleanup rules against the already-clean standalone document. The existing rules remain stored so they are available again if the original source is restored.

## Source Replacement And Backup

Saving is implemented by a focused reader-page store rather than directly inside the view. For `Articles/page.html`, the backup path is `.html-preview/originals/Articles/page.html`. Parent directories are created as needed.

The first save writes the current source to the backup path before replacing the Vault file. If that backup already exists, later saves never overwrite it, so repeated reader saves cannot destroy the recoverable original. Source replacement occurs only after the backup write succeeds.

Restore writes the backup contents back to the source file first. It removes the backup only after the source write succeeds. This makes restore a one-level recovery operation: after restoration, a future reader save creates a new backup from the then-current source.

Source replacement and restoration use Obsidian's Vault file APIs so normal modify events, sync, open views, and the preview coordinator observe the change. Neither operation modifies annotation JSON. Annotation anchors continue to use quote text, surrounding context, and source-text offsets rather than DOM coordinates. Existing annotations are re-anchored after replacement; annotations whose quoted text was not retained remain visible in the sidebar and can use the existing repair workflow.

## View State And Refresh

`HtmlPreviewView` owns a two-state presentation mode: normal preview or smart reading. Before an explicit save, the selected mode is local to the open view and does not alter the HTML file. Each mode retains its own scroll position so switching back does not jump to the top.

Source-file changes, local dependency changes, cleanup-rule changes, and annotation changes rebuild the active mode through the existing preview coordinator. Render tokens continue to prevent stale iframe messages from affecting the current view. If smart extraction fails after a refresh, the view returns to normal preview and shows a concise Obsidian notice explaining that no reliable article body was found.

## Security

Smart reading never executes scripts copied from the source page, regardless of the normal preview's `Allow page JavaScript` setting. The plugin bridge is generated locally and remains the only executable reader script. This makes the reading representation safer and more deterministic while leaving the existing normal-preview policy unchanged.

Sanitization uses parsed DOM operations rather than string replacement. It removes active and embedding elements, inline event handlers, unsafe URL schemes, refresh directives, and author styling that could escape or obscure the reader layout. Standard semantic content, local images and media, tables, code, math markup, and accessible attributes are preserved when safe.

## Failure Handling

- Readability cannot identify an article: stay in normal preview and show a concise notice.
- Extracted content is empty or below the minimum useful-content threshold: treat it as an extraction failure.
- A cleanup rule cannot be resolved: continue extraction, retain the existing unmatched-rule diagnostic, and do not mutate the rule.
- A local resource is missing: render the rest of the article and add it to preview diagnostics.
- A reader render becomes stale while asynchronous data is loading: discard it using the existing render-token lifecycle.

No extraction or preview failure rewrites the source HTML or deletes cleanup and annotation data. Save and restore failures show a concise error notice and preserve the last successfully written source and backup.

## Components

- A reader extraction module applies cleanup rules, invokes Mozilla Readability, sanitizes the extracted article, and returns structured content or failure.
- A reader document builder produces the isolated HTML document, reader styles, plugin bridge, dependencies, and diagnostics.
- A reader-page store owns validated backup paths, backup creation, source replacement, and restoration ordering.
- Two small confirmation modals own save and restore confirmation and pending/error UI.
- `HtmlPreviewView` owns mode switching, action state, per-mode scroll positions, refresh behavior, save/restore orchestration, and failure fallback.
- The existing cleanup locator, cleanup store, annotation service, preview coordinator, navigation policy, and diagnostics modal remain shared dependencies rather than duplicated implementations.
- `@mozilla/readability` is bundled into `main.js`; no runtime network dependency is introduced.

## Testing

Automated tests cover:

- Article extraction from a representative saved page.
- Existing file- and folder-scoped cleanup rules are applied before extraction.
- Removed navigation or advertising content does not appear in the reader result.
- Missing article content produces a typed failure and never a blank reader page.
- Source scripts, frames, forms, event handlers, unsafe URLs, and author styling are removed.
- Relative links, images, tables, code blocks, and semantic article content survive transformation.
- The standalone save document contains reader styling and content but no source script or plugin bridge.
- The smart-reading action toggles in the current view and returns to the prior normal-preview scroll position.
- Annotation loading and bridge installation continue in smart reading.
- Saving is impossible without modal confirmation.
- A successful save writes a backup before replacing the source, preserves an existing backup, and reloads the current view.
- Restore writes the source before removing its backup; failed writes retain recoverable data.
- Saved reading pages skip stale cleanup-rule replay, while restoring the original re-enables those rules.
- Annotation data is not rewritten by save or restore and retained quotes re-anchor in the generated article.
- Source, dependency, cleanup, and annotation refreshes rebuild the active mode without accepting stale messages.
- Existing normal preview and manual cleanup tests continue to pass unchanged.

Final verification includes `npm run check`, a production build copied to the local Vault plugin folder, and visual inspection in Obsidian with article-like, noisy, and non-article HTML pages in light and dark themes.

## Non-Goals

- Creating a second reader-specific cleanup rule format.
- Executing source-page JavaScript in smart reading.
- Building a general visual HTML editor.
- Automatically replacing HTML merely by entering smart reading.
- Embedding annotation markup or comment text into the saved HTML.
- Keeping multiple historical source versions beyond the one recoverable backup.
- Adding automatic extraction to Enhanced Markdown Reading, which already has a structured source document.
