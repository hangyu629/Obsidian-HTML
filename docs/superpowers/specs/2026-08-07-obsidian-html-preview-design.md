# Obsidian HTML Preview Design

## Summary

Build an Obsidian community plugin that treats `.html` and `.htm` files already present in a Vault as previewable files. Users save HTML with any external tool and copy the file, plus any asset folders, into the Vault. The plugin does not create, edit, download, or rewrite the source files.

The plugin targets Obsidian Desktop, iOS, and Android from the first release.

## Product Behavior

- Register `.html` and `.htm` as a custom Obsidian file view.
- Open HTML in a normal workspace leaf, including tabs, splits, pop-out windows where supported, and Obsidian navigation history.
- Render complete HTML documents, inline assets, network resources, and relative local resources.
- Execute page JavaScript by default inside an isolated iframe.
- Refresh an open preview when its HTML file or a known local dependency changes.
- Route Vault-local HTML links through Obsidian and external links through the platform's external-link handler.
- Expose reload, external-open, and diagnostics actions in the view toolbar.
- Preserve the original HTML and asset files byte-for-byte.

## Explicit Non-Goals

- No HTML creation, source editor, visual editor, or save dialog.
- No URL downloader, web clipper, or page-archive feature.
- No Electron `webview`, local HTTP server, Service Worker host, Node.js runtime exposure, or desktop-only implementation.
- No guarantee for pages that require browser extensions, privileged APIs, a server-side application, cross-origin exemptions, or Node/Electron APIs.

## Architecture

### Plugin Registration

`HtmlPreviewPlugin` registers a view type and maps `html` and `htm` extensions to it with `Plugin.registerExtensions`. `HtmlPreviewView` extends `FileView`, owns one iframe, and binds rendering lifecycle to its current `TFile`.

### Preview Pipeline

1. `HtmlPreviewView` requests the HTML text from `Vault.cachedRead`.
2. `buildPreviewDocument` parses it with `DOMParser`.
3. The builder ensures `html`, `head`, and `body` elements exist, then injects a `<base>` derived from `Vault.getResourcePath(file)`.
4. The builder injects a small capture-phase link bridge before page scripts.
5. The transformed in-memory document is serialized into `iframe.srcdoc`.
6. The original `TFile` is never modified.

The base URL allows standard relative HTML attributes, inline CSS URLs, external stylesheets, classic scripts, images, fonts, audio, and video to resolve like a normal folder-based website. A static dependency scanner records Vault-relative `src`, `href`, `poster`, `data`, and `srcset` references that can be mapped to known `TFile` objects. Dynamic `fetch`, runtime-generated URLs, module CORS behavior, and Service Workers remain subject to the browser sandbox and Obsidian resource protocol.

### Sandbox Policy

The iframe enables `allow-scripts`, `allow-forms`, `allow-modals`, `allow-popups`, and `allow-downloads`. It intentionally omits `allow-same-origin`, `allow-top-navigation`, and access to Node/Electron APIs. This lets ordinary page JavaScript run in an opaque origin while preventing direct access to the parent Obsidian document.

JavaScript is enabled by default, as explicitly selected. A plugin setting may disable scripts globally for users who preview untrusted files. The plugin explains that enabled scripts can still make network requests and disclose data already present inside the HTML page; sandboxing does not make untrusted active content harmless.

### Navigation Bridge

An injected capture-phase listener handles trusted primary-button anchor activations:

- Fragment-only links stay inside the iframe.
- Relative links and Vault-resource links are resolved against the source HTML path. Existing Vault files open through `Workspace.openLinkText`.
- `http`, `https`, `mailto`, and `tel` links open through Obsidian's external-link utility.
- `javascript`, `data`, `file`, unknown protocols, paths outside the Vault, and malformed messages are rejected.

Messages are accepted only from the active iframe's `contentWindow`, must match the plugin message namespace and current render ID, and are parsed as untrusted input. The bridge exposes no general command channel.

### Refresh And Dependencies

`PreviewCoordinator` listens to Vault `modify`, `rename`, and `delete` events once per plugin instance. Each open view publishes its source path and static dependency set. Relevant events schedule a 250 ms trailing refresh so atomic saves and asset bursts do not render partially written content.

The HTML source file always triggers refresh. Known dependencies trigger refresh directly. When dependency extraction is incomplete, a manual reload remains available. Renaming or deleting the source delegates to `FileView` lifecycle and renders an explicit unavailable state if the file no longer exists.

### Diagnostics And Failure States

The builder returns structured diagnostics instead of throwing for recoverable problems. Diagnostics include malformed URLs, blocked protocols, missing local files, and document parse/serialization errors. The view shows a compact empty/error state when no file can load and exposes details through a modal action. Runtime network failures inside the opaque iframe may not be observable and are documented as a compatibility limit.

Rendering uses a monotonically increasing render token. Slow reads and stale iframe events are ignored after a newer render begins or a view closes.

### State And Cleanup

The view persists only its file state through `FileView`. It does not persist page cookies, storage, form state, or JavaScript heap state. Closing a view removes message listeners, unregisters coordinator subscriptions, clears timers, and destroys the iframe.

## UI

The HTML page occupies the full view content area without a decorative container. The standard Obsidian view header carries icon actions for reload, open externally, and diagnostics. Loading, missing-file, and render-error states are centered but compact. UI colors and spacing use Obsidian CSS variables and remain compatible with light and dark themes.

## Testing

- Unit-test document normalization, base injection, bridge ordering, script policy, dependency extraction, URL classification, path traversal rejection, and source immutability in a DOM-capable test environment.
- Unit-test coordinator relevance and debounce behavior with fake timers.
- Test view behavior with lightweight Obsidian API mocks: file load, stale-render suppression, refresh, cleanup, and error state.
- Run TypeScript type checking, unit tests, production bundling, and manifest validation on every change.
- Perform manual smoke tests in current Obsidian Desktop and one mobile platform before release: self-contained HTML, folder assets, scripts, external links, local HTML navigation, rename/delete, live file replacement, dark mode, and offline behavior.

## Release Boundary

The first releasable version is complete when existing `.html/.htm` files open reliably in Obsidian on desktop and mobile, common local resources resolve, ordinary scripts run in the sandbox, file changes refresh, navigation follows the policy above, failures are actionable, and the plugin package contains `main.js`, `manifest.json`, and `styles.css`.

