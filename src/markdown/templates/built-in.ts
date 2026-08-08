import type { MarkdownTemplatePackage } from "./types";

export const BUILT_IN_TEMPLATE_ID = "book-editorial";

export const BUILT_IN_TEMPLATE: MarkdownTemplatePackage = {
  layout: `
    <article class="book-editorial-page">
      <header class="book-editorial-cover">
        <div class="book-editorial-kicker">Enhanced reading</div>
        <div class="book-editorial-title" data-slot="title"></div>
      </header>
      <div class="book-editorial-shell">
        <section class="book-editorial-properties" data-slot="properties"></section>
        <nav class="book-editorial-toc" data-slot="toc"></nav>
        <main class="book-editorial-content" data-slot="content"></main>
      </div>
    </article>`,
  manifest: {
    defaultTheme: "light",
    id: BUILT_IN_TEMPLATE_ID,
    name: "Book Editorial",
    themes: [
      { id: "light", name: "Light paper", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark forest", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `
    * { box-sizing: border-box; }
    .book-editorial-page {
      min-height: 100%;
      overflow-x: hidden;
      background: var(--book-bg);
      color: var(--book-ink);
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      line-height: 1.72;
      -webkit-font-smoothing: antialiased;
    }
    .book-editorial-page a { color: var(--book-brass); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .book-editorial-page a:hover { color: var(--book-stamp); }
    .book-editorial-cover {
      padding: clamp(4rem, 12vw, 7.5rem) 1.5rem 4rem;
      border-bottom: 1px solid var(--book-rule);
      background: var(--book-cover);
      text-align: center;
    }
    .book-editorial-kicker,
    .book-editorial-toc::before,
    .book-editorial-properties::before {
      display: block;
      color: var(--book-brass);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: .68rem;
      font-weight: 600;
      letter-spacing: .2em;
      line-height: 1.4;
      text-transform: uppercase;
    }
    .book-editorial-kicker { margin-bottom: 1.25rem; }
    .book-editorial-title {
      max-width: 44rem;
      margin: 0 auto;
      font-size: clamp(2.15rem, 6vw, 4.2rem);
      font-weight: 600;
      letter-spacing: 0;
      line-height: 1.1;
      text-wrap: balance;
    }
    .book-editorial-shell { width: min(720px, calc(100% - 3rem)); margin: 0 auto; }
    .book-editorial-properties {
      padding: 2rem 0 1.75rem;
      border-bottom: 1px solid var(--book-rule);
    }
    .book-editorial-properties::before { content: "Properties"; margin-bottom: .8rem; }
    .book-editorial-properties dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem 1.25rem; margin: 0; font-size: .86rem; }
    .book-editorial-properties dt { color: var(--book-ink-muted); font-family: ui-monospace, monospace; font-size: .7rem; letter-spacing: .05em; text-transform: uppercase; }
    .book-editorial-properties dd { margin: 0; color: var(--book-ink); overflow-wrap: anywhere; }
    .book-editorial-toc {
      padding: 2.7rem 0 2.4rem;
      border-bottom: 1px solid var(--book-rule);
    }
    .book-editorial-toc::before { content: "Contents"; margin-bottom: 1rem; }
    .book-editorial-toc ul { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
    .book-editorial-toc li { position: relative; padding-left: 1.25rem; font-size: .92rem; }
    .book-editorial-toc li::before { position: absolute; left: 0; color: var(--book-brass); content: "·"; }
    .book-editorial-toc li[data-level="1"] { padding-left: 0; font-weight: 700; }
    .book-editorial-toc li[data-level="1"]::before { content: ""; }
    .book-editorial-content { padding: 3.5rem 0 6rem; font-size: 1.04rem; }
    .book-editorial-content > :first-child { margin-top: 0; }
    .book-editorial-content h1,
    .book-editorial-content h2,
    .book-editorial-content h3,
    .book-editorial-content h4,
    .book-editorial-content h5,
    .book-editorial-content h6 { color: var(--book-ink); font-weight: 600; line-height: 1.25; text-wrap: balance; }
    .book-editorial-content h1 { margin: 0 0 1.4rem; font-size: 2.25rem; }
    .book-editorial-content h2 { margin: 3.6rem 0 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--book-rule); font-size: 1.8rem; }
    .book-editorial-content h3 { margin: 2.6rem 0 .85rem; font-size: 1.4rem; }
    .book-editorial-content h4,
    .book-editorial-content h5,
    .book-editorial-content h6 { margin: 1.8rem 0 .7rem; font-size: 1.08rem; }
    .book-editorial-content p { margin: 0 0 1.2rem; }
    .book-editorial-content > p:first-of-type::first-letter { float: left; padding: .08em .09em 0 0; color: var(--book-brass); font-size: 3.5rem; line-height: .82; }
    .book-editorial-content strong { color: var(--book-ink); font-weight: 700; }
    .book-editorial-content mark { padding: .05em .2em; background: var(--book-brass-bg); color: inherit; }
    .book-editorial-content ul,
    .book-editorial-content ol { margin: 0 0 1.35rem; padding-left: 1.45rem; }
    .book-editorial-content li { margin: .35rem 0; }
    .book-editorial-content li.task-list-item { list-style: none; margin-left: -1.35rem; }
    .book-editorial-content .task-list-item-checkbox { margin-right: .55rem; accent-color: var(--book-brass); }
    .book-editorial-content blockquote {
      margin: 1.8rem 0;
      padding: .35rem 0 .35rem 1.25rem;
      border-left: 2px solid var(--book-brass);
      color: var(--book-ink-muted);
      font-style: italic;
    }
    .book-editorial-content .callout { margin: 1.7rem 0; border: 1px solid var(--book-rule); border-left: 3px solid var(--book-brass); border-radius: 3px; background: var(--book-raised); box-shadow: none; }
    .book-editorial-content .callout-title { color: var(--book-brass); font-family: ui-monospace, monospace; font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; }
    .book-editorial-content .callout-content { color: var(--book-ink); }
    .book-editorial-content table { display: block; width: 100%; margin: 1.7rem 0; overflow-x: auto; border-collapse: collapse; font-size: .92rem; }
    .book-editorial-content th,
    .book-editorial-content td { min-width: 8rem; padding: .65rem .8rem; border-bottom: 1px solid var(--book-rule); text-align: left; vertical-align: top; }
    .book-editorial-content th { border-bottom-color: var(--book-brass); color: var(--book-brass); font-family: ui-monospace, monospace; font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; }
    .book-editorial-content pre { margin: 1.7rem 0; padding: 1.15rem 1.25rem; overflow-x: auto; border: 1px solid var(--book-rule); border-radius: 3px; background: var(--book-code-bg); color: var(--book-code-ink); font-size: .84rem; line-height: 1.6; }
    .book-editorial-content code { padding: .12em .3em; border-radius: 2px; background: var(--book-code-bg); color: var(--book-code-ink); font-family: ui-monospace, monospace; font-size: .84em; }
    .book-editorial-content pre code { padding: 0; background: transparent; color: inherit; }
    .book-editorial-content hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--book-rule); }
    .book-editorial-content img,
    .book-editorial-content .internal-embed { max-width: 100%; height: auto; }
    .book-editorial-content .internal-embed { margin: 1.5rem 0; }
    .book-editorial-content .math-block,
    .book-editorial-content mjx-container[display="true"] { margin: 1.7rem 0; overflow-x: auto; }
    .book-editorial-content .footnotes { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--book-rule); color: var(--book-ink-muted); font-size: .86rem; }
    .book-editorial-content .footnotes ol { padding-left: 1.3rem; }
    @media (max-width: 600px) {
      .book-editorial-shell { width: min(100% - 2rem, 720px); }
      .book-editorial-content { padding-top: 2.5rem; font-size: 1rem; }
      .book-editorial-title { font-size: clamp(2rem, 11vw, 3rem); }
    }
  `,
  themes: {
    light: `:root {
      color-scheme: light;
      --book-bg: #E7EAE1;
      --book-raised: #F1F3EC;
      --book-cover: #DEE3D6;
      --book-ink: #1E2420;
      --book-ink-muted: #565F56;
      --book-rule: #C6CBBD;
      --book-brass: #8C6A22;
      --book-brass-bg: rgba(140,106,34,.12);
      --book-stamp: #9C3324;
      --book-code-bg: #DDE2D6;
      --book-code-ink: #29352A;
    }`,
    dark: `:root {
      color-scheme: dark;
      --book-bg: #141813;
      --book-raised: #1C211B;
      --book-cover: #10140F;
      --book-ink: #E9E6DA;
      --book-ink-muted: #A6AC9C;
      --book-rule: #333B30;
      --book-brass: #D1A94A;
      --book-brass-bg: rgba(209,169,74,.15);
      --book-stamp: #E07A5F;
      --book-code-bg: #20281F;
      --book-code-ink: #E5E8D9;
    }`
  }
};
