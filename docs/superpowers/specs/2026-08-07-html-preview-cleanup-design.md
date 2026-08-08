# HTML Preview Page Cleanup Design

## Summary

Add non-destructive page cleanup to HTML Preview. A user enters cleanup mode, points at an unwanted sidebar, footer, banner, overlay, or other element, and hides it from the Obsidian preview. The original HTML and its assets remain byte-for-byte unchanged.

Cleanup rules live inside the Vault and support two scopes:

- `file`: applies only to one HTML file and is the default.
- `folder`: applies to HTML files under one selected Vault folder.

Highlighting and comments remain a separate future subsystem. Page cleanup ships first and establishes the Vault persistence, locator, and secure iframe command patterns that annotations can later reuse.

## User Experience

The HTML view header adds three actions:

- Toggle cleanup mode.
- Undo the most recently created rule for the current file.
- Manage cleanup rules.

In cleanup mode, pointer movement outlines the candidate element without changing layout. A primary click hides the candidate immediately and persists a file-scoped rule. Normal links, buttons, and page click handlers do not run while the picker consumes that click. Pressing Escape or toggling the toolbar action exits cleanup mode.

On touch devices, the first tap selects and outlines a candidate; a compact in-frame control confirms hiding or cancels. This avoids destructive one-tap behavior when hover is unavailable.

The rule manager lists effective file and folder rules. A user can restore one element, reset file rules, or promote a file rule to the current HTML file's parent folder. Promotion copies the rule into folder storage and removes the file copy, so the same rule is not applied twice.

The picker refuses to hide `html`, `head`, `body`, the injected cleanup runtime, or its selection controls. Undo is limited to the current view session and removes the last rule that still exists. Persistent restore remains available through the rule manager.

## Approaches Considered

### CSS Selector Only

Store a selector and apply `display: none`. This is small but unreliable when AI-generated markup changes, classes are reordered, or selectors match multiple elements.

### Selector Plus Fingerprint (Selected)

Store a preferred selector plus a semantic fingerprint containing tag name, stable attributes, classes, normalized text, and a short ancestor signature. Resolution first tries the selector, validates its fingerprint, and falls back to scored candidates. This supports current-file precision and conservative reuse across similar pages.

### Automatic Reader Extraction

Run a readability algorithm that replaces the page with extracted main content. This works for articles but can destroy reports, dashboards, and interactive AI-generated pages. It may be added later as an independent view mode, not mixed into cleanup rules.

## Rule Model

```ts
interface CleanupRule {
  id: string;
  createdAt: string;
  scope: "file" | "folder";
  sourcePath: string;
  selector: string;
  fingerprint: ElementFingerprint;
}

interface ElementFingerprint {
  tag: string;
  id?: string;
  attributes: Record<string, string>;
  classes: string[];
  text: string;
  ancestors: Array<{ tag: string; id?: string; classes: string[] }>;
}
```

`sourcePath` is the HTML path for file rules and the normalized folder prefix for folder rules. IDs are random 128-bit hexadecimal strings. Text samples are normalized, limited to 160 characters, and contain no HTML.

Stable selector generation uses this priority:

1. A unique element ID that is not UUID-like or obviously generated.
2. Stable `data-testid`, `data-test`, `aria-label`, or semantic role attributes.
3. Tag plus stable class names.
4. A bounded ancestor path with `:nth-of-type()` as a file-specific fallback.

The locator never executes selectors received from the iframe without validation. Selector length, nesting, allowed syntax, fingerprint fields, and message size are bounded before persistence or replay.

## Storage

Data is stored through Obsidian's Vault adapter:

```text
.html-preview/
  cleanup/
    pages/<mirrored HTML path>.json
    folder-rules.json
```

For `Clippings/report.html`, file rules are stored at `.html-preview/cleanup/pages/Clippings/report.html.json`. Parent directories are created lazily. Folder rules are stored in one versioned document because their expected count is small.

Each JSON document uses `{ "version": 1, "rules": [...] }`. Writes use a serialized queue per path to prevent two open views from overwriting each other. A failed parse does not overwrite corrupt data; the plugin reports the problem and continues with no rules. Unknown future schema versions are rejected rather than downgraded.

When an HTML file is renamed, the plugin moves its page rule document to the mirrored new path. When an HTML file is deleted, cleanup data is retained so an accidental deletion and restoration does not lose work. Folder rules are path-prefix based and are not automatically rewritten when an arbitrary folder is renamed; the manager reports unmatched scopes for manual repair.

Because `.html-preview` is a hidden Vault directory, synchronization depends on whether the user's chosen sync provider includes hidden files. The plugin does not claim cloud synchronization beyond storing data under the Vault root.

## Locator Engine

`createElementLocator(element)` runs inside the iframe runtime and returns a bounded locator payload. `resolveCleanupRule(document, rule)` runs when applying rules:

1. Query the stored selector if it passes validation.
2. Score matches against tag, ID, stable attributes, class overlap, normalized text, and ancestors.
3. If no confident selector match exists, scan a bounded candidate set with the same tag and score fingerprints.
4. Apply a file rule at a lower confidence threshold than a folder rule.
5. Skip ambiguous or low-confidence results and report an unmatched rule.

Resolved elements receive `data-obsidian-html-preview-hidden="<rule-id>"`. An injected stylesheet applies `display: none !important`. Restoring a rule removes only its own marker. A `MutationObserver` watches inserted subtrees and reapplies currently unmatched rules with a trailing debounce. It does not continuously scan the entire document.

## Iframe Runtime And Security

The existing injected bridge becomes a small preview runtime with navigation and cleanup modules. Its random render token stays inside a closure and its script node removes itself before author scripts run.

The parent enters or exits cleanup mode with a `postMessage` accepted only when `event.source === window.parent` and the command schema is valid. The command does not expose the secret render token. A cleanup result message contains the secret token and is accepted by the parent only when:

- `event.source` is the active iframe window.
- The render token matches.
- The message type and payload pass strict schema limits.
- The selected element originated from a trusted user pointer event.
- The proposed locator passes host-side validation.

The host persists validated rules and then sends the refreshed effective rule set on the next render. Author page scripts may observe that cleanup mode is active or alter their own DOM, but cannot invoke Vault writes through a general bridge API.

When page JavaScript is disabled, cleanup replay and interactive picker mode are unavailable, and the toolbar action reports that page JavaScript must be enabled. This preserves the existing guarantee that disabling JavaScript blocks all iframe scripts instead of creating a privileged exception for the cleanup runtime.

## Components

- `CleanupRuleStore`: reads, validates, writes, promotes, removes, and migrates Vault JSON documents.
- `CleanupLocator`: generates and validates selector/fingerprint payloads and resolves rules.
- `CleanupRuntime`: applies rules, renders picker feedback, handles trusted selection, and watches dynamic DOM changes.
- `CleanupController`: view-side state, toolbar actions, secure message validation, persistence calls, undo stack, and rerendering.
- `CleanupRulesModal`: lists effective rules and exposes restore, promote, and reset commands.

The locator and store do not depend on `HtmlPreviewView`. The iframe runtime is generated as a string from typed, serializable inputs and exposes only versioned messages.

## Failure Handling

- Corrupt or unsupported JSON: keep the file untouched, ignore its rules, and add a diagnostic.
- Storage write failure: restore the element in the current preview and show a Notice; do not claim success.
- Low-confidence or ambiguous locator: skip the rule and expose it as unmatched in diagnostics and the manager.
- Page script immediately recreates an element: MutationObserver reapplies the rule with bounded retries.
- Rule tries to hide a protected root/runtime element: reject it in both iframe and host validation.
- Cross-origin iframe, canvas, video pixels, and content inside images: only the outer containing element can be hidden.
- View reload during a pending save: the serialized store finishes the Vault write, while stale view callbacks are ignored by render token.

## Testing

- Unit-test stable selector generation, generated-ID rejection, selector validation, fingerprint scoring, ambiguity thresholds, protected elements, and bounded candidate scans.
- Unit-test file/folder rule merge order, JSON schema validation, queued writes, promote, remove, reset, rename migration, corrupt data preservation, and adapter errors.
- Test runtime output for secret-token removal, cleanup command source checks, trusted click requirements, marker application, restore, mutation replay, desktop selection, and touch confirmation.
- Test `HtmlPreviewView` integration for toolbar state, message rejection, persistence success/failure, undo, promotion, reset, JavaScript-disabled behavior, stale render suppression, and cleanup diagnostics.
- Run the existing navigation, preview, coordinator, type-check, build, and release validation suites unchanged.

## Release Boundary

The feature is complete when a desktop or mobile user can hide unwanted page regions without modifying HTML, rules survive restart inside the Vault, file and folder scopes behave predictably, dynamic insertions are reapplied, every rule is reversible, malicious iframe messages cannot write Vault data, and all existing HTML Preview behavior remains compatible.
