# URL Importer Design

**Date:** 2026-08-09
**Status:** Approved direction

## Goal

Let the user import a public webpage directly into the Vault by entering a URL. The importer fetches the HTML and required assets, rewrites references so the page is self-contained inside the Vault, writes `Article Title.html` plus `Article Title-assets/`, and opens the imported HTML in normal preview.

## User Experience

HTML Preview gains a command and toolbar entry named `Import webpage from URL`.

The importer opens a compact modal with three fields:

- URL
- Destination folder in the Vault
- Page title or filename override

After submission, the modal shows pending progress and then either:

- success with the final file path, or
- a concise failure explaining whether the HTML request failed, an asset failed, or writing to the Vault failed.

On success, the plugin opens the new `.html` file in the current workspace leaf using the existing HTML Preview view. It does not automatically enter Smart reading. The user inspects the imported page first, then optionally uses cleanup, Smart reading, and Save reading page.

## Output Layout

For an imported title `Article Title` into folder `Clippings`, the importer writes:

```text
Clippings/Article Title.html
Clippings/Article Title-assets/
```

Assets inside `Article Title-assets/` preserve enough of the remote path structure to keep relative links stable:

- host-relative `/css/app.css` becomes `Article Title-assets/css/app.css`
- same-origin `images/photo.jpg` becomes `Article Title-assets/images/photo.jpg`
- cross-origin `https://cdn.example.com/lib/site.css` becomes `Article Title-assets/cdn.example.com/lib/site.css`

The imported HTML is rewritten to reference these local asset paths. Imported CSS is also rewritten so `url(...)` and `@import` continue to work from their new Vault locations.

## Import Scope

Version 1 intentionally supports only the fetch-and-rewrite path that fits public static and article-style pages.

Included:

- HTML document fetch
- direct HTML asset references: `src`, `href`, `poster`, `srcset`, `object[data]`
- recursive CSS assets: `@import` and `url(...)`
- binary assets such as images, fonts, audio, video, and CSS files

Excluded from v1:

- login-state capture
- script-executed runtime rendering
- infinite-scroll capture
- browser-tab snapshotting
- whole-site crawling

If a page depends on runtime JavaScript to reveal content, the importer still saves the fetched HTML response, but it does not attempt to execute page scripts before capture.

## Network And Parsing Strategy

The importer uses Obsidian's native `requestUrl` interface instead of browser `fetch`. This avoids the iframe/browser CORS behavior that would make direct in-plugin import unreliable.

The fetch pipeline:

1. Request the page HTML.
2. Parse the document and resolve the effective base URL.
3. Collect fetchable references from HTML.
4. Queue each asset fetch with deduplication by absolute URL.
5. For fetched CSS files, parse their text for `@import` and `url(...)`, queue those dependencies, and rewrite the CSS text to local relative paths.
6. Persist the HTML and assets to the Vault.

Remote URLs are normalized before storage. Query strings influence the fetch URL but do not remain verbatim in the local filename; path collisions are resolved by adding a short stable hash suffix.

## Vault Writing Strategy

Vault writes use Obsidian's `create`, `createBinary`, and `createFolder` APIs when possible so the file explorer and active views update correctly. The importer validates that destination paths are inside the Vault and that an existing folder does not conflict with an intended file.

Filename rules:

- If the user supplies an override, sanitize it and preserve `.html`.
- Otherwise derive the title from the page `<title>` and fall back to the hostname plus a timestamp when the title is empty.
- If `Article Title.html` already exists, use `Article Title 2.html`, `Article Title 3.html`, and so on.
- The asset folder always tracks the chosen page filename: `Article Title-assets/`.

The importer does not overwrite existing imported assets from another page. Every import gets its own dedicated asset folder.

## Security

The importer downloads remote content but does not execute it during capture. Imported HTML still follows the plugin's existing preview security model after it is opened.

The importer does not sanitize or clean the source HTML during capture. Its job is faithful acquisition into the Vault. Cleanup rules and Smart reading remain separate post-import workflows.

## Failure Handling

- HTML request fails: no files are written.
- An asset request fails: write the HTML and successful assets, record the failure in the success summary, and rely on existing preview diagnostics for missing local resources.
- CSS parsing fails for one file: store the fetched CSS unchanged, report that rewriting was partial, and continue.
- Vault write fails before the HTML file is created: abort and report the failing path.
- Vault write fails after partial asset creation: keep the successfully written files, report the partial import, and do not silently clean them up.

This keeps the importer transparent: the user either gets a complete import, or a partial import with a clear account of what is missing.

## Components

- `src/importer/fetcher.ts`: requests HTML, CSS, and binary assets with URL deduplication.
- `src/importer/rewrite.ts`: rewrites HTML and CSS URLs from remote absolute/relative URLs to Vault-local relative paths.
- `src/importer/store.ts`: filename derivation, collision handling, folder creation, text/binary writes, and result summary.
- `src/importer/modal.ts`: URL import modal and progress UI.
- `src/main.ts`: command registration and integration with the existing HTML view opening flow.

## Testing

Automated tests cover:

- title and filename derivation
- path collision handling
- HTML reference rewriting
- CSS `url(...)` and `@import` rewriting
- deduplicated asset fetch scheduling
- binary and text Vault writes
- partial import behavior when some assets fail
- import modal validation and pending state
- opening the resulting HTML file after a successful import

Final verification includes `npm run check`, copying release files to the local Vault plugin directory, and a real import of at least one public article page plus one asset-heavy page.

## Non-Goals

- executing webpage JavaScript during capture
- importing authenticated browser sessions
- browser-extension capture
- one-click automatic Smart reading after import
- site mirroring or recursive crawling
