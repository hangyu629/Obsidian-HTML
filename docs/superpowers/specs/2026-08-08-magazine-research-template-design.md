# Magazine Research Built-in Template Design

## Goal

Add `magazine-research` as a second built-in enhanced Markdown template. It reproduces the approved Magazine Research v2 direction: a polished research-report layout with a strong editorial masthead, a compact information band, and a wide single-column reading surface. `book-editorial` remains the global default and fallback.

## Template Identity

- ID: `magazine-research`
- Display name: `Magazine Research`
- Themes: `light` and `dark`
- Default theme: `light`
- Availability: template chooser, `html-template` frontmatter, folder mappings, and manual enhanced-reading commands

## Visual System

### Light Theme

- Canvas: cool light gray-green (`#DFE3DF`)
- Paper: warm white (`#FBFAF7`)
- Masthead and code surface: deep navy (`#15233A`)
- Reading ink: navy-black (`#263248`)
- Primary accent: coral (`#E7654E`)
- Supporting accent: muted sage (`#A9BCA9`)
- Information band: pale sage-white (`#EFF2EC`)

### Dark Theme

The dark theme keeps the same navy, coral, and sage identity instead of inverting the page mechanically. It uses a near-black blue canvas (`#0E151F`), raised blue-gray paper (`#151F2B`), warm light reading text (`#E8E6DE`), bright coral (`#F08A72`), and subdued sage (`#9DB79F`). Dividers use `#34444A`. Contrast must remain sufficient for headings, links, code, metadata, and controls.

### Typography

- Titles and long-form content use an editorial serif stack: Iowan Old Style, Songti SC, Palatino, Georgia, and serif fallbacks.
- Metadata labels, section numbers, table headings, and code use the system monospace stack.
- Body text remains comfortable for Chinese and English reading, with no viewport-based font-size scaling.

## Layout

The template uses the existing four slots and does not transform Markdown source:

1. A deep navy masthead contains a narrow report index rail, restrained editorial labels, and the note title.
2. A full-width information band places the generated table of contents and Properties side by side.
3. A centered reading column with `max-width: 735px` contains the native Obsidian Markdown output.
4. Below 700px, the masthead simplifies, the information band becomes one column, and the reading column uses compact side padding without horizontal overflow.

The layout contains no fabricated article summary, author, date, or reading brief. Static labels identify the reading mode only; all note-specific data comes from the title, Properties, TOC, and content slots.

## Markdown Coverage

Obsidian's native `MarkdownRenderer` remains the only Markdown renderer. The template must style all DOM already supported by the enhanced-reading pipeline:

- headings `h1` through `h6`, paragraphs, links, emphasis, strong text, strikethrough, and highlight
- unordered, ordered, nested, and task lists
- blockquotes and Obsidian Callouts
- tables with horizontal overflow on narrow screens
- inline code and fenced code blocks
- math blocks and display MathJax containers
- images, media, and internal embeds
- horizontal rules and footnotes
- Properties and generated TOC blocks

Decorative treatments such as the first-paragraph drop cap must degrade safely when content begins with a non-paragraph element.

## Built-in Catalog Architecture

The current catalog assumes exactly one built-in package. Replace that assumption with a built-in collection keyed by template ID:

- Keep `BUILT_IN_TEMPLATE_ID` and `BUILT_IN_TEMPLATE` as aliases for the default `book-editorial` package so existing imports and fallback behavior remain stable.
- Add `BUILT_IN_TEMPLATES` containing both `book-editorial` and `magazine-research`.
- List every built-in before valid Vault templates, in a deterministic order: `Book Editorial`, then `Magazine Research`.
- Resolve a built-in ID directly from the collection before reading Vault packages.
- Ignore Vault template folders whose IDs collide with any built-in ID; built-ins always win.
- Missing, malformed, or unknown template IDs continue to fall back to `book-editorial`.

No settings migration is required because the existing default template and theme IDs do not change. Existing `minimal` settings continue to normalize to `book-editorial`.

## Error Handling

- If a requested built-in theme is missing, the renderer uses that template's declared default theme through the existing theme selection path.
- Invalid Vault packages remain excluded from the catalog without preventing built-ins from loading.
- The new template introduces no JavaScript, remote assets, network requests, or Markdown mutations.

## Testing

- Catalog tests verify both built-ins are listed in order, each built-in loads by ID, Vault collisions are ignored, and invalid IDs still fall back to `book-editorial`.
- Rendering contract tests verify the new layout exposes title, TOC, Properties, and content slots.
- Styling contract tests cover headings, blockquotes, Callouts, tables, code, task controls, math, embeds, footnotes, and responsive rules.
- Existing settings, rendering, integration, typecheck, build, and release validation suites must remain green.

## Boundaries

- `Book Editorial` remains the default and is not visually changed.
- The approved browser mockup is a visual reference, not runtime code copied wholesale into the plugin.
- The Vault reference HTML remains read-only.
- No template JavaScript or remote assets are added.
- Markdown source files are never edited by the template.
- Custom Vault templates remain supported.
