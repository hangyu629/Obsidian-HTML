# HTML Smart Reading Design

**Date:** 2026-08-09
**Status:** Approved direction

## Goal

Add a reversible smart reading mode for saved HTML pages. The mode extracts the main article, removes surrounding page chrome, and renders the result in a consistent reading layout without modifying the source HTML. Existing manual cleanup remains available and its saved rules are applied before automatic extraction, so users can correct noisy extraction results with the workflow they already know.

## User Experience

HTML Preview gains one `Smart reading` view action. Activating it replaces the normal page presentation in the current tab with the extracted reading document. Activating the action again returns to the normal HTML preview at the prior scroll position.

The existing `Clean up page`, `Undo cleanup`, `Manage cleanup rules`, and `View original page` actions remain unchanged in normal preview. Smart reading does not introduce a second cleanup editor or a second cleanup data format. When extraction contains unwanted content, the user returns to normal preview, hides the unwanted regions with `Clean up page`, and enters smart reading again. The saved cleanup rules are applied before the next extraction.

While smart reading is active, actions that only operate on the original page cleanup runtime are unavailable. Annotation selection, existing annotation focus, internal and external link handling, images, and scroll restoration remain available where their content is present in the extracted article.

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

The builder returns the reader HTML, title/byline/excerpt metadata when available, local dependencies, diagnostics, and either a success or a typed extraction failure. It does not persist transformed HTML.

## Cleanup Relationship

The source of truth remains the current versioned cleanup-rule storage under `.html-preview/cleanup/`. Smart reading loads the same effective file and folder rules as normal preview. It uses `resolveCleanupRule` against a detached source document and removes resolved targets before Readability runs.

Rules that no longer match continue to use the existing diagnostics and management workflow. Smart reading creates no reader-specific selectors. Undoing, deleting, resetting, or promoting an existing cleanup rule changes both normal preview and the next smart-reading render.

## View State And Refresh

`HtmlPreviewView` owns a two-state presentation mode: normal preview or smart reading. The selected mode is local to the open view and does not alter the HTML file. Each mode retains its own scroll position so switching back does not jump to the top.

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

No failure path rewrites the source HTML or deletes cleanup and annotation data.

## Components

- A reader extraction module applies cleanup rules, invokes Mozilla Readability, sanitizes the extracted article, and returns structured content or failure.
- A reader document builder produces the isolated HTML document, reader styles, plugin bridge, dependencies, and diagnostics.
- `HtmlPreviewView` owns mode switching, action state, per-mode scroll positions, refresh behavior, and failure fallback.
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
- The smart-reading action toggles in the current view and returns to the prior normal-preview scroll position.
- Annotation loading and bridge installation continue in smart reading.
- Source, dependency, cleanup, and annotation refreshes rebuild the active mode without accepting stale messages.
- Existing normal preview and manual cleanup tests continue to pass unchanged.

Final verification includes `npm run check`, a production build copied to the local Vault plugin folder, and visual inspection in Obsidian with article-like, noisy, and non-article HTML pages in light and dark themes.

## Non-Goals

- Rewriting or replacing the saved HTML source.
- Creating a second reader-specific cleanup rule format.
- Executing source-page JavaScript in smart reading.
- Building a general visual HTML editor.
- Persisting a generated reader HTML file in the Vault.
- Adding automatic extraction to Enhanced Markdown Reading, which already has a structured source document.
