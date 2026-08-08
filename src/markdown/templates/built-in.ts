import type { MarkdownTemplatePackage } from "./types";

export const BUILT_IN_TEMPLATE_ID = "minimal";

export const BUILT_IN_TEMPLATE: MarkdownTemplatePackage = {
  layout: `
    <article class="html-preview-markdown-minimal">
      <header class="html-preview-markdown-header">
        <div data-slot="title"></div>
        <div data-slot="properties"></div>
      </header>
      <div class="html-preview-markdown-body">
        <aside data-slot="toc"></aside>
        <main data-slot="content"></main>
      </div>
    </article>`,
  manifest: {
    defaultTheme: "light",
    id: BUILT_IN_TEMPLATE_ID,
    name: "Minimal",
    themes: [{ id: "light", name: "Light", stylesheet: "themes/light.css" }],
    version: 1
  },
  styles: `
    .html-preview-markdown-minimal { max-width: 920px; margin: 0 auto; padding: 48px 32px; }
    .html-preview-markdown-header { margin-bottom: 32px; }
    .html-preview-markdown-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; }
    .html-preview-markdown-body [data-slot="toc"]:empty { display: none; }
    @media (min-width: 900px) {
      .html-preview-markdown-body { grid-template-columns: 180px minmax(0, 1fr); }
    }
  `,
  themes: { light: ":root { color-scheme: light; }" }
};
