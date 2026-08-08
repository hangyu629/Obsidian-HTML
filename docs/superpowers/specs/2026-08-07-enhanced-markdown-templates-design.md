# Enhanced Markdown Templates Design

## Summary

Add an optional enhanced-reading presentation for Markdown files. Obsidian remains responsible for parsing and rendering Markdown semantics; the plugin contributes a safe HTML/CSS layout template around the rendered content. Markdown source files are never rewritten and remain under Obsidian's native editor and reader lifecycle.

## Goals

- Cover Obsidian core Markdown behavior by using the native `MarkdownRenderer` rather than a second Markdown parser.
- Let users create and synchronize reusable template packages inside the Vault.
- Let templates define page layout, typography, spacing, responsive behavior, and theme styles, not only colors.
- Select templates by frontmatter or by folder mappings configured in plugin settings.
- Open an enhanced-reading view manually from a Markdown note with a toolbar action.
- Automatically open enhanced reading only when a matching frontmatter or folder rule exists by default.
- Keep third-party plugin compatibility extensible without promising every plugin in the first release.
- Keep templates declarative: HTML, CSS, and metadata only; no template JavaScript in the first release.

## Non-goals

- Replacing Obsidian's Markdown editor or native reader.
- Converting Markdown to saved HTML files.
- Reimplementing Wiki links, embeds, callouts, math, Properties, tables, task lists, or other Markdown syntax.
- Executing arbitrary template JavaScript or exposing Obsidian APIs to templates.
- Guaranteeing support for every third-party renderer in the first release.

## User Experience

Markdown files retain their normal Obsidian view. A new toolbar action, `Enhanced reading`, opens the same file in an `EnhancedMarkdownView`. The enhanced view offers `Open native Markdown` to return to the normal Obsidian view and a template/theme selector for the current session.

When the default behavior is enabled, a note automatically opens in enhanced reading only if a valid frontmatter rule or folder mapping resolves to a template. A note without a match stays in the native Markdown view. Manual enhanced reading uses the configured global default template when no rule matches.

The settings tab manages:

- The global default template and default theme.
- Ordered folder-to-template mappings.
- Whether matching notes automatically open in enhanced reading.

Rule precedence is:

1. Valid frontmatter `html-preview.template` and optional `html-preview.theme`.
2. The most specific matching folder mapping.
3. The global default template for manual enhanced-reading actions only.
4. No enhanced view for automatic opening when neither 1 nor 2 matches.

## Template Package

Templates live under:

```text
.html-preview/markdown-templates/<template-id>/
  template.json
  layout.html
  styles.css
  themes/<theme-id>.css
  assets/*
```

`template.json` is versioned metadata:

```json
{
  "version": 1,
  "id": "editorial",
  "name": "Editorial",
  "defaultTheme": "light",
  "themes": [
    { "id": "light", "name": "Light", "stylesheet": "themes/light.css" },
    { "id": "dark", "name": "Dark", "stylesheet": "themes/dark.css" }
  ]
}
```

`layout.html` must contain a `data-slot="content"` element. The other supported slots are `title`, `properties`, and `toc`. Templates may arrange slots into single-column pages, split layouts, report headers, magazine grids, or fixed sidebars. The full native Markdown DOM is placed in `content`; Markdown subtrees are not split into template slots.

`styles.css` and the selected theme stylesheet are scoped to the enhanced view root. Relative asset references resolve only inside the template package. Network resources are rejected by default. Template HTML cannot contain `script`, event-handler attributes, `form`, `iframe`, `object`, or meta refresh elements.

Invalid templates produce a diagnostic and fall back to a built-in minimal template. Unknown template fields are ignored so future metadata can be added without breaking older versions.

## Rendering Architecture

`EnhancedMarkdownView` extends Obsidian's view surface without registering `.md` as a new file extension. It asks Obsidian's native `MarkdownRenderer` to render the note into a detached content container, then inserts the resulting DOM into the validated template's `content` slot. Title, Properties, and a heading-based table of contents are rendered into their dedicated slots.

The enhanced view remains in the Obsidian document DOM rather than an iframe. This preserves native Wiki link navigation, embeds, callouts, math rendering, Properties behavior, and compatible third-party components. Template CSS is scoped by a generated root class and cannot target outside elements.

The plugin does not create an HTML source file. It rebuilds the enhanced view when the Markdown file, selected template, selected theme, or a referenced local asset changes. Stale asynchronous reads are ignored with the same monotonically increasing render token used by HTML Preview.

## Security

- No template JavaScript executes.
- Template HTML is parsed and validated before insertion.
- Dangerous tags and attributes are rejected.
- CSS is inserted into a scoped style element owned by the enhanced view and removed on unload.
- Template assets are resolved through the Vault and remain within the selected package directory.
- Frontmatter and folder mappings are parsed as bounded data; unknown or invalid values fall back without changing the Markdown source.
- Third-party plugin output is treated as renderer-owned DOM and is not reserialized into template HTML.

## Third-party Compatibility

The first release guarantees Obsidian core Markdown rendering. It exposes a renderer extension boundary around the content container so future adapters can register after checking whether a plugin is active. The first release does not include bespoke Dataview, Tasks, or other third-party adapters and does not run template scripts to compensate.

## Failure Handling

- Invalid frontmatter template IDs fall through to folder mappings.
- Missing or invalid template packages fall back to the built-in template and show a Notice/diagnostic.
- Missing theme files use the template default theme.
- A folder mapping to a missing template remains stored but is ignored until the template exists again.
- Markdown render failures show the existing compact error state and leave the native Markdown view available.
- When automatic opening is disabled, matching rules affect only the toolbar action's suggested template; no view is switched automatically.

## Testing

- Validate template metadata, paths, slots, dangerous HTML, CSS scope, theme fallback, and bounded package sizes.
- Test frontmatter precedence, most-specific folder matching, global default manual fallback, automatic-opening setting, and invalid-rule fallback.
- Test template loading and asset resolution through an in-memory Vault adapter.
- Test enhanced view rendering with headings, tables, task lists, callouts, math, Wiki links, embeds, Properties, and code blocks through native renderer integration boundaries.
- Test stale render suppression, file modifications, view switching, unload cleanup, and template selector state.
- Test that no template JavaScript reaches the production bundle and that Markdown source bytes remain unchanged.

## Release Boundary

The feature is complete when a user can place an HTML/CSS template package in the Vault, map it to a folder or note frontmatter, open a Markdown note in enhanced reading, see native Markdown semantics intact, switch back to the native Markdown view, and receive safe fallbacks for invalid or missing templates without source-file changes.
