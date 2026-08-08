import {
  BUILT_IN_TEMPLATE,
  BUILT_IN_TEMPLATES,
  builtInTemplateFor
} from "./built-in";
import { parseTemplateManifest, validateTemplatePackage } from "./validation";
import type {
  MarkdownTemplatePackage,
  MarkdownTemplateSummary,
  TemplatePackageFiles
} from "./types";

export const MARKDOWN_TEMPLATE_ROOT = ".html-preview/markdown-templates";

export function markdownTemplatePath(templateId: string): string {
  return `${MARKDOWN_TEMPLATE_ROOT}/${templateId}`;
}

export interface MarkdownTemplateCatalogAdapter {
  exists(path: string): Promise<boolean>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
  read(path: string): Promise<string>;
}

function isTemplateId(value: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/.test(value);
}

function pathJoin(root: string, relative: string): string {
  return `${root}/${relative}`;
}

export class MarkdownTemplateCatalog {
  constructor(private readonly adapter: MarkdownTemplateCatalogAdapter) {}

  async list(): Promise<MarkdownTemplateSummary[]> {
    const summaries: MarkdownTemplateSummary[] = BUILT_IN_TEMPLATES.map((template) => ({
      defaultTheme: template.manifest.defaultTheme,
      id: template.manifest.id,
      name: template.manifest.name,
      themeIds: template.manifest.themes.map((theme) => theme.id)
    }));
    const root = `${MARKDOWN_TEMPLATE_ROOT}/`;
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await this.adapter.list(root);
    } catch {
      return summaries;
    }
    const ids = listing.folders
      .filter((folder) => folder.startsWith(root))
      .map((folder) => folder.slice(root.length).replace(/\/$/, ""))
      .filter(isTemplateId)
      .filter((id) => !builtInTemplateFor(id))
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort();
    for (const id of ids) {
      const packageValue = await this.loadPackage(id);
      if (!packageValue || packageValue.manifest.id !== id) {
        continue;
      }
      summaries.push({
        defaultTheme: packageValue.manifest.defaultTheme,
        id,
        name: packageValue.manifest.name,
        themeIds: packageValue.manifest.themes.map((theme) => theme.id)
      });
    }
    return summaries;
  }

  async load(templateId: string): Promise<MarkdownTemplatePackage> {
    const builtIn = builtInTemplateFor(templateId);
    if (builtIn) return builtIn;
    if (!isTemplateId(templateId)) {
      return BUILT_IN_TEMPLATE;
    }
    return (await this.loadPackage(templateId)) ?? BUILT_IN_TEMPLATE;
  }

  private async loadPackage(
    templateId: string
  ): Promise<MarkdownTemplatePackage | null> {
    const root = markdownTemplatePath(templateId);
    try {
      const manifestText = await this.adapter.read(pathJoin(root, "template.json"));
      const manifestValue = parseTemplateManifest(JSON.parse(manifestText) as unknown);
      if (!manifestValue || manifestValue.id !== templateId) {
        return null;
      }
      const themes: Record<string, string> = {};
      for (const theme of manifestValue.themes) {
        themes[theme.id] = await this.adapter.read(pathJoin(root, theme.stylesheet));
      }
      const files: TemplatePackageFiles = {
        layout: await this.adapter.read(pathJoin(root, "layout.html")),
        manifest: manifestText,
        styles: await this.adapter.read(pathJoin(root, "styles.css")),
        themes
      };
      return validateTemplatePackage(files);
    } catch {
      return null;
    }
  }
}
