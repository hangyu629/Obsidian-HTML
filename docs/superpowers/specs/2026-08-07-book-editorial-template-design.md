# Book Editorial Built-in Template Design

## Goal

Replace the weak `minimal` built-in Markdown template with `book-editorial`, a complete editorial reading template based on the reference page `广告是怎么被卖出去的：美国广告业简史` in the user's Vault. It becomes the only built-in template and global default.

## Visual System

- Light theme: pale sage paper (`#E7EAE1`), raised paper (`#F1F3EC`), near-black green ink, brass (`#8C6A22`), and restrained brick-red (`#9C3324`).
- Dark theme: near-black forest paper, warm off-white ink, gold and coral accents.
- Typography: Palatino/Iowan/Georgia serif reading text; system monospace for small labels, metadata, and table headings.
- Layout: a centered cover title, separated metadata and TOC blocks, then a 720px single-column reading surface. The page is responsive and has no horizontal overflow.

## Markdown Coverage

The template styles DOM produced by Obsidian's native `MarkdownRenderer`; Markdown syntax is neither parsed nor transformed by the template. It covers headings, paragraphs, links, emphasis, highlight, lists, task lists, blockquotes, callouts, tables, code blocks, math containers, images, embeds, horizontal rules, footnotes, Properties, and the generated TOC.

## Built-in Migration

- `BUILT_IN_TEMPLATE_ID` changes from `minimal` to `book-editorial`.
- The template has `light` and `dark` themes.
- Fresh settings default to `book-editorial` / `light`.
- Stored settings that reference `minimal` normalize to `book-editorial` so existing manual actions and folder mappings continue to work.
- Invalid/missing templates fall back to `book-editorial`.

## Boundaries

- The user reference HTML is read-only and is not copied into the plugin or Vault template data.
- No template JavaScript is introduced.
- Markdown source files remain unchanged.
- Vault-provided custom templates remain supported and appear alongside `book-editorial` in the chooser.
