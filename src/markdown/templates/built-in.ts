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
    description: "Book-like single-column reading with a paper editorial cover.",
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

const MAGAZINE_RESEARCH_TEMPLATE: MarkdownTemplatePackage = {
  layout: `
    <article class="magazine-research-page">
      <header class="magazine-research-masthead">
        <div class="magazine-research-index">FIELD<br>REPORT</div>
        <div class="magazine-research-title-block">
          <div class="magazine-research-kicker">Enhanced reading</div>
          <div class="magazine-research-title" data-slot="title"></div>
        </div>
      </header>
      <div class="magazine-research-information">
        <nav class="magazine-research-toc" data-slot="toc"></nav>
        <section class="magazine-research-properties" data-slot="properties"></section>
      </div>
      <main class="magazine-research-content" data-slot="content"></main>
    </article>`,
  manifest: {
    defaultTheme: "light",
    description: "Wide research-report reading with a navy masthead and coral accents.",
    id: "magazine-research",
    name: "Magazine Research",
    themes: [
      { id: "light", name: "Light paper", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark report", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `
    * { box-sizing: border-box; }
    .magazine-research-page { min-height: 100%; overflow-x: hidden; background: var(--magazine-canvas); color: var(--magazine-ink); font-family: "Iowan Old Style", "Songti SC", Palatino, Georgia, serif; line-height: 1.82; }
    .magazine-research-masthead { display: grid; grid-template-columns: 5.6rem minmax(0, 1fr); min-height: 19rem; background: var(--magazine-navy); color: var(--magazine-paper); }
    .magazine-research-index { padding: 1.6rem 1.1rem; border-right: 1px solid var(--magazine-mast-rule); color: var(--magazine-sage); font-family: ui-monospace, monospace; font-size: .66rem; font-weight: 700; letter-spacing: .14em; line-height: 1.55; }
    .magazine-research-title-block { display: flex; flex-direction: column; justify-content: flex-end; padding: 2rem clamp(1.5rem, 7vw, 5rem) 2.7rem; }
    .magazine-research-kicker, .magazine-research-toc::before, .magazine-research-properties::before { display: block; color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .66rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .magazine-research-kicker { margin-bottom: auto; }
    .magazine-research-title { max-width: 44rem; font-size: clamp(2.3rem, 6vw, 4.3rem); font-weight: 600; letter-spacing: 0; line-height: 1.08; text-wrap: balance; }
    .magazine-research-information { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(17rem, 1fr); max-width: 1100px; margin: 0 auto; border: 1px solid var(--magazine-rule); border-top: 0; background: var(--magazine-information); }
    .magazine-research-toc, .magazine-research-properties { padding: 1.5rem clamp(1.35rem, 4vw, 2.5rem); }
    .magazine-research-toc { border-right: 1px solid var(--magazine-rule); }
    .magazine-research-toc::before { content: "Contents"; margin-bottom: .8rem; }
    .magazine-research-properties::before { content: "Properties"; margin-bottom: .8rem; }
    .magazine-research-toc ul { display: grid; gap: .45rem; margin: 0; padding: 0; list-style: none; }
    .magazine-research-toc li { padding-left: 1.25rem; font-size: .9rem; }
    .magazine-research-toc li::before { float: left; width: 1.25rem; margin-left: -1.25rem; color: var(--magazine-coral); content: "·"; }
    .magazine-research-toc li[data-level="1"] { padding-left: 0; font-weight: 700; }
    .magazine-research-toc li[data-level="1"]::before { content: ""; }
    .magazine-research-properties dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem 1rem; margin: 0; font-size: .82rem; }
    .magazine-research-properties dt { color: var(--magazine-muted); font-family: ui-monospace, monospace; font-size: .66rem; letter-spacing: .06em; text-transform: uppercase; }
    .magazine-research-properties dd { margin: 0; overflow-wrap: anywhere; }
    .magazine-research-content { width: min(735px, calc(100% - 3rem)); margin: 0 auto; padding: 4rem 0 6rem; font-size: 1.05rem; }
    .magazine-research-content > :first-child { margin-top: 0; }
    .magazine-research-content h1, .magazine-research-content h2, .magazine-research-content h3, .magazine-research-content h4, .magazine-research-content h5, .magazine-research-content h6 { color: var(--magazine-ink); font-weight: 600; line-height: 1.22; text-wrap: balance; }
    .magazine-research-content h1 { margin: 0 0 1.5rem; font-size: 2.35rem; }
    .magazine-research-content h2 { margin: 3.8rem 0 1.15rem; padding-top: 1rem; border-top: 1px solid var(--magazine-rule); font-size: 1.9rem; }
    .magazine-research-content h3 { margin: 2.7rem 0 .9rem; font-size: 1.45rem; }
    .magazine-research-content h4, .magazine-research-content h5, .magazine-research-content h6 { margin: 2rem 0 .7rem; font-size: 1.08rem; }
    .magazine-research-content p { margin: 0 0 1.25rem; }
    .magazine-research-content > p:first-of-type::first-letter { float: left; padding: .08em .1em 0 0; color: var(--magazine-coral); font-size: 3.9rem; line-height: .78; }
    .magazine-research-content a { color: var(--magazine-link); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .magazine-research-content strong { color: var(--magazine-ink); }
    .magazine-research-content mark { padding: .05em .2em; background: var(--magazine-highlight); color: inherit; }
    .magazine-research-content ul, .magazine-research-content ol { margin: 0 0 1.35rem; padding-left: 1.45rem; }
    .magazine-research-content li { margin: .35rem 0; }
    .magazine-research-content li.task-list-item { list-style: none; margin-left: -1.35rem; }
    .magazine-research-content .task-list-item-checkbox { margin-right: .55rem; accent-color: var(--magazine-coral); }
    .magazine-research-content blockquote { margin: 1.9rem 0; padding: 1rem 1.25rem; border-left: 3px solid var(--magazine-sage); background: var(--magazine-raised); color: var(--magazine-muted); font-size: 1.08rem; }
    .magazine-research-content .callout { margin: 1.8rem 0; border: 1px solid var(--magazine-rule); border-left: 4px solid var(--magazine-coral); border-radius: 3px; background: var(--magazine-raised); box-shadow: none; }
    .magazine-research-content .callout-title { color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .74rem; letter-spacing: .08em; text-transform: uppercase; }
    .magazine-research-content table { display: block; width: 100%; margin: 1.8rem 0; overflow-x: auto; border-collapse: collapse; font-size: .9rem; }
    .magazine-research-content th, .magazine-research-content td { min-width: 8rem; padding: .7rem .8rem; border-bottom: 1px solid var(--magazine-rule); text-align: left; vertical-align: top; }
    .magazine-research-content th { color: var(--magazine-coral); font-family: ui-monospace, monospace; font-size: .67rem; letter-spacing: .08em; text-transform: uppercase; }
    .magazine-research-content pre { margin: 1.8rem 0; padding: 1.2rem; overflow-x: auto; background: var(--magazine-code-bg); color: var(--magazine-code-ink); font-size: .84rem; line-height: 1.6; }
    .magazine-research-content code { padding: .12em .3em; background: var(--magazine-inline-code); color: var(--magazine-code-inline); font-family: ui-monospace, monospace; font-size: .84em; }
    .magazine-research-content pre code { padding: 0; background: transparent; color: inherit; }
    .magazine-research-content hr { margin: 3rem 0; border: 0; border-top: 1px solid var(--magazine-rule); }
    .magazine-research-content img, .magazine-research-content .internal-embed { max-width: 100%; height: auto; }
    .magazine-research-content .internal-embed { margin: 1.5rem 0; }
    .magazine-research-content .math-block, .magazine-research-content mjx-container[display="true"] { margin: 1.7rem 0; overflow-x: auto; }
    .magazine-research-content .footnotes { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--magazine-rule); color: var(--magazine-muted); font-size: .86rem; }
    @media (max-width: 700px) { .magazine-research-masthead { grid-template-columns: 3.6rem minmax(0, 1fr); min-height: 15rem; } .magazine-research-index { padding: 1.25rem .7rem; font-size: .58rem; } .magazine-research-title-block { padding: 1.5rem 1.35rem 2rem; } .magazine-research-information { grid-template-columns: 1fr; } .magazine-research-toc { border-right: 0; border-bottom: 1px solid var(--magazine-rule); } .magazine-research-content { width: min(100% - 2rem, 735px); padding-top: 2.7rem; font-size: 1rem; } }
  `,
  themes: {
    light: `:root { color-scheme: light; --magazine-canvas: #DFE3DF; --magazine-paper: #FBFAF7; --magazine-navy: #15233A; --magazine-ink: #263248; --magazine-muted: #66706D; --magazine-coral: #E7654E; --magazine-sage: #A9BCA9; --magazine-information: #EFF2EC; --magazine-raised: #F4F5F0; --magazine-rule: #D4D8D0; --magazine-link: #A74A3C; --magazine-highlight: rgba(231, 101, 78, .17); --magazine-code-bg: #15233A; --magazine-code-ink: #E8EEE6; --magazine-inline-code: #E5EAE2; --magazine-code-inline: #2C514A; --magazine-mast-rule: rgba(255,255,255,.2); }`,
    dark: `:root { color-scheme: dark; --magazine-canvas: #0E151F; --magazine-paper: #151F2B; --magazine-navy: #0A111A; --magazine-ink: #E8E6DE; --magazine-muted: #B5C0B9; --magazine-coral: #F08A72; --magazine-sage: #9DB79F; --magazine-information: #17222E; --magazine-raised: #1C2935; --magazine-rule: #34444A; --magazine-link: #F3A08B; --magazine-highlight: rgba(240, 138, 114, .2); --magazine-code-bg: #0A111A; --magazine-code-ink: #E8EDE6; --magazine-inline-code: #22313C; --magazine-code-inline: #D9E7DD; --magazine-mast-rule: rgba(232,230,222,.2); }`
  }
};

export const BUILT_IN_TEMPLATES: readonly MarkdownTemplatePackage[] = [
  BUILT_IN_TEMPLATE,
  MAGAZINE_RESEARCH_TEMPLATE
];

export function builtInTemplateFor(templateId: string): MarkdownTemplatePackage | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.manifest.id === templateId);
}
