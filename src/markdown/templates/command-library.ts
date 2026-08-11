import type { MarkdownTemplatePackage } from "./types";

export const COMMAND_LIBRARY_TEMPLATE_ID = "command-library";

export const COMMAND_LIBRARY_TEMPLATE: MarkdownTemplatePackage = {
  layout: `
    <article class="command-library-page">
      <header class="command-library-header">
        <div class="command-library-heading">
          <div class="command-library-kicker">Command library</div>
          <div class="command-library-title" data-slot="title"></div>
        </div>
        <label class="command-library-search">
          <span class="command-library-search-label">Search commands</span>
          <input data-command-library-search type="search" placeholder="Search commands" autocomplete="off">
        </label>
      </header>
      <div class="command-library-shell">
        <nav class="command-library-categories" data-command-library-categories aria-label="Command categories"></nav>
        <main class="command-library-main">
          <section class="command-library-introduction" data-command-library-introduction></section>
          <p class="command-library-empty" data-command-library-empty hidden>No matching commands.</p>
          <section class="command-library-content" data-slot="content"></section>
        </main>
      </div>
    </article>`,
  manifest: {
    defaultTheme: "light",
    description: "Searchable categorized command cards for operational reference notes.",
    id: COMMAND_LIBRARY_TEMPLATE_ID,
    name: "Command Library",
    themes: [
      { id: "light", name: "Light library", stylesheet: "themes/light.css" },
      { id: "dark", name: "Dark library", stylesheet: "themes/dark.css" }
    ],
    version: 1
  },
  styles: `
    * { box-sizing: border-box; }
    .command-library-page {
      min-height: 100%;
      overflow-x: hidden;
      background: var(--command-canvas);
      color: var(--command-ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .command-library-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 2rem;
      padding: clamp(2.25rem, 6vw, 4.6rem) clamp(1.4rem, 6vw, 5rem) 2rem;
      border-bottom: 1px solid var(--command-rule);
      background: var(--command-header);
    }
    .command-library-heading { min-width: 0; }
    .command-library-kicker {
      margin-bottom: .65rem;
      color: var(--command-accent);
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      font-size: .68rem;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .command-library-title {
      max-width: 46rem;
      font-size: clamp(2rem, 5vw, 3.6rem);
      font-weight: 720;
      letter-spacing: 0;
      line-height: 1.08;
      overflow-wrap: anywhere;
    }
    .command-library-search {
      display: grid;
      grid-template-columns: auto minmax(10rem, 17rem);
      align-items: center;
      gap: .6rem;
      flex: 0 1 24rem;
      min-height: 2.5rem;
      padding: 0 .7rem;
      border: 1px solid var(--command-rule-strong);
      border-radius: 6px;
      background: var(--command-raised);
    }
    .command-library-search-label {
      color: var(--command-muted);
      font-family: ui-monospace, monospace;
      font-size: .67rem;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .command-library-search input {
      width: 100%;
      min-width: 0;
      border: 0;
      outline: 0;
      color: var(--command-ink);
      background: transparent;
      font: inherit;
      font-size: .86rem;
    }
    .command-library-search:focus-within { border-color: var(--command-accent); box-shadow: 0 0 0 2px var(--command-focus); }
    .command-library-search input::placeholder { color: var(--command-muted); }
    .command-library-shell {
      display: grid;
      grid-template-columns: minmax(10.5rem, 15rem) minmax(0, 1fr);
      gap: clamp(1.5rem, 4vw, 4.2rem);
      width: min(1180px, calc(100% - 3rem));
      margin: 0 auto;
      padding: 2.5rem 0 6rem;
    }
    .command-library-categories {
      position: sticky;
      top: 1rem;
      align-self: start;
      display: grid;
      gap: .32rem;
      max-height: calc(100vh - 2rem);
      overflow: auto;
      padding-right: .55rem;
    }
    .command-library-category-button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      width: 100%;
      min-height: 2.25rem;
      padding: .45rem .6rem .45rem .72rem;
      border: 1px solid transparent;
      border-left: 3px solid transparent;
      border-radius: 5px;
      color: var(--command-muted);
      background: transparent;
      font: inherit;
      font-size: .82rem;
      text-align: left;
      cursor: pointer;
    }
    .command-library-category-button:hover { color: var(--command-ink); background: var(--command-hover); }
    .command-library-category-button[data-active="true"] { border-color: var(--command-rule); border-left-color: var(--command-accent); color: var(--command-ink); background: var(--command-raised); font-weight: 700; }
    .command-library-category-count { color: var(--command-accent-quiet); font-family: ui-monospace, monospace; font-size: .67rem; }
    .command-library-main { min-width: 0; }
    .command-library-introduction {
      color: var(--command-muted);
      font-size: 1rem;
      line-height: 1.7;
    }
    .command-library-introduction:empty { display: none; }
    .command-library-introduction > :first-child { margin-top: 0; }
    .command-library-introduction > :last-child { margin-bottom: 2.4rem; }
    .command-library-empty {
      margin: 0;
      padding: 1.4rem;
      border: 1px dashed var(--command-rule-strong);
      border-radius: 6px;
      color: var(--command-muted);
      background: var(--command-raised);
      text-align: center;
    }
    .command-library-category { scroll-margin-top: 1.25rem; }
    .command-library-category + .command-library-category { margin-top: 3.5rem; }
    .command-library-category > h2 {
      margin: 0 0 1rem;
      padding-bottom: .65rem;
      border-bottom: 1px solid var(--command-rule);
      color: var(--command-ink);
      font-size: 1.55rem;
      font-weight: 720;
      letter-spacing: 0;
      line-height: 1.18;
    }
    .command-library-card {
      display: block;
      margin: .75rem 0;
      border: 1px solid var(--command-rule);
      border-left: 3px solid var(--command-card-accent, var(--command-accent));
      border-radius: 6px;
      background: var(--command-raised);
      box-shadow: 0 1px 0 var(--command-shadow);
      overflow: hidden;
    }
    .command-library-card:nth-of-type(3n + 1) { --command-card-accent: var(--command-accent); }
    .command-library-card:nth-of-type(3n + 2) { --command-card-accent: var(--command-blue); }
    .command-library-card:nth-of-type(3n) { --command-card-accent: var(--command-amber); }
    .command-library-card .callout-title {
      display: flex;
      align-items: center;
      min-height: 2.8rem;
      gap: .65rem;
      padding: .65rem .75rem .65rem .95rem;
      border-bottom: 1px solid var(--command-rule);
      color: var(--command-ink);
      background: var(--command-card-header);
      font-size: .9rem;
      font-weight: 720;
    }
    .command-library-card .callout-icon { display: none; }
    .command-library-card .callout-title-inner { min-width: 0; overflow-wrap: anywhere; }
    .command-library-language {
      margin-left: auto;
      color: var(--command-accent-quiet);
      font-family: ui-monospace, monospace;
      font-size: .64rem;
      font-weight: 700;
      letter-spacing: .07em;
      text-transform: uppercase;
    }
    .command-library-copy {
      display: grid;
      place-items: center;
      flex: 0 0 1.9rem;
      width: 1.9rem;
      height: 1.9rem;
      margin-left: .15rem;
      padding: 0;
      border: 1px solid var(--command-rule-strong);
      border-radius: 4px;
      color: var(--command-accent);
      background: var(--command-raised);
      cursor: pointer;
    }
    .command-library-copy:hover { color: var(--command-accent-strong); border-color: var(--command-accent); }
    .command-library-copy[data-copy-state="copied"] { color: var(--command-success); border-color: var(--command-success); }
    .command-library-copy svg { width: .9rem; height: .9rem; }
    .command-library-card .copy-code-button { display: none; }
    .command-library-card .callout-content { padding: .85rem .95rem .95rem; }
    .command-library-card pre {
      margin: 0 0 .75rem;
      padding: .85rem .9rem;
      overflow-x: auto;
      border: 1px solid var(--command-code-rule);
      border-radius: 4px;
      background: var(--command-code-bg);
      color: var(--command-code-ink);
      font: .78rem/1.55 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      tab-size: 2;
    }
    .command-library-card pre code { padding: 0; background: transparent; color: inherit; font: inherit; }
    .command-library-card .callout-content > :last-child { margin-bottom: 0; }
    .command-library-card p,
    .command-library-card li { color: var(--command-muted); font-size: .9rem; line-height: 1.58; }
    .command-library-card p { margin: .65rem 0; }
    .command-library-card ul,
    .command-library-card ol { margin: .65rem 0; padding-left: 1.35rem; }
    .command-library-content > p,
    .command-library-content > ul,
    .command-library-content > ol,
    .command-library-content > table,
    .command-library-content > blockquote { margin: 1.1rem 0; }
    .command-library-content a { color: var(--command-link); text-underline-offset: 3px; }
    .command-library-content blockquote { margin-left: 0; padding-left: 1rem; border-left: 3px solid var(--command-blue); color: var(--command-muted); }
    .command-library-content table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
    .command-library-content th,
    .command-library-content td { padding: .55rem .7rem; border-bottom: 1px solid var(--command-rule); text-align: left; vertical-align: top; }
    @media (max-width: 760px) {
      .command-library-header { align-items: stretch; flex-direction: column; gap: 1.25rem; padding: 2.2rem 1rem 1.35rem; }
      .command-library-search { grid-template-columns: auto minmax(0, 1fr); flex-basis: auto; }
      .command-library-shell { display: block; width: min(100% - 2rem, 760px); padding-top: 1rem; }
      .command-library-categories { position: static; display: flex; max-width: none; max-height: none; overflow-x: auto; padding: 0 0 .9rem; border-bottom: 1px solid var(--command-rule); }
      .command-library-category-button { flex: 0 0 auto; width: auto; min-height: 2rem; }
      .command-library-category + .command-library-category { margin-top: 2.5rem; }
      .command-library-card .callout-title { padding-left: .75rem; }
      .command-library-card .callout-content { padding: .75rem; }
    }
  `,
  themes: {
    light: `:root {
      color-scheme: light;
      --command-canvas: #f2f5f3;
      --command-header: #e7eeea;
      --command-raised: #fbfcfa;
      --command-card-header: #f5f8f6;
      --command-hover: #eaf1ed;
      --command-ink: #202a27;
      --command-muted: #64716b;
      --command-rule: #d6dfd9;
      --command-rule-strong: #b9c8bf;
      --command-accent: #25715f;
      --command-accent-strong: #195746;
      --command-accent-quiet: #5f8578;
      --command-blue: #39739d;
      --command-amber: #b67c24;
      --command-success: #23804d;
      --command-link: #236a85;
      --command-focus: rgba(37, 113, 95, .18);
      --command-shadow: rgba(35, 57, 47, .05);
      --command-code-bg: #17241f;
      --command-code-ink: #e4f0e9;
      --command-code-rule: #294338;
    }`,
    dark: `:root {
      color-scheme: dark;
      --command-canvas: #141b1a;
      --command-header: #101716;
      --command-raised: #1b2421;
      --command-card-header: #202b27;
      --command-hover: #27342f;
      --command-ink: #e6ece7;
      --command-muted: #adbab2;
      --command-rule: #35443e;
      --command-rule-strong: #506158;
      --command-accent: #76c3a6;
      --command-accent-strong: #9dd9bd;
      --command-accent-quiet: #9cc9b6;
      --command-blue: #82b6dc;
      --command-amber: #dfae5f;
      --command-success: #79cf91;
      --command-link: #91c9e3;
      --command-focus: rgba(118, 195, 166, .22);
      --command-shadow: rgba(0, 0, 0, .18);
      --command-code-bg: #0e1513;
      --command-code-ink: #dcece3;
      --command-code-rule: #32483d;
    }`
  }
};
