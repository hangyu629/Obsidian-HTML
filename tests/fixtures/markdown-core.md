---
title: Markdown core fixture
tags:
  - docs
html-preview:
  template: editorial
  theme: light
---

# Heading 1
## Heading 2

Paragraph with **bold**, *italic*, ~~strike~~, `inline code`, [a link](https://example.com), and ==highlight==.

> A standard blockquote with a [reference link](https://example.com).

- unordered item
  - nested item
1. ordered item
- [x] completed task
- [ ] open task

> [!note] Callout
> Native Obsidian callout content.

| Column | Value |
| --- | --- |
| A | B |

```ts
const example = "code block";
```

$$x^2 + y^2 = z^2$$

[[Internal note]] and ![[image.png]]

---

Footnote reference[^history].

[^history]: A footnote that should remain available through Obsidian's native renderer.
