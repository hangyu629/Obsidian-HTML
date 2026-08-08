export const TEMPLATE_SLOTS = [
  "content",
  "properties",
  "title",
  "toc"
] as const;

export type TemplateSlot = (typeof TEMPLATE_SLOTS)[number];

export interface MarkdownTemplateTheme {
  id: string;
  name: string;
  stylesheet: string;
}

export interface MarkdownTemplateManifest {
  defaultTheme: string;
  id: string;
  name: string;
  themes: MarkdownTemplateTheme[];
  version: 1;
}

export interface TemplatePackageFiles {
  layout: string;
  manifest: string;
  styles: string;
  themes: Record<string, string>;
}

export interface MarkdownTemplatePackage {
  layout: string;
  manifest: MarkdownTemplateManifest;
  styles: string;
  themes: Record<string, string>;
}

export interface MarkdownTemplateSummary {
  defaultTheme: string;
  id: string;
  name: string;
  themeIds: string[];
}

export interface TemplateLayoutResult {
  html: string;
  slots: Set<TemplateSlot>;
}
