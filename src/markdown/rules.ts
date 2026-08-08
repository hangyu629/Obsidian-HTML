const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_FOLDER_MAPPINGS = 128;

export interface FolderTemplateMapping {
  folder: string;
  templateId: string;
  themeId?: string;
}

export interface MarkdownTemplateSettings {
  autoEnhanced: boolean;
  defaultTemplateId: string;
  defaultThemeId: string;
  folderMappings: FolderTemplateMapping[];
}

export interface TemplateSelection {
  source: "default" | "folder" | "frontmatter";
  templateId: string;
  themeId: string;
}

export type TemplateResolutionMode = "automatic" | "manual";

function isTemplateId(value: unknown): value is string {
  return typeof value === "string" && TEMPLATE_ID_PATTERN.test(value);
}

function normalizeVaultPath(path: string): string | null {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) {
    return null;
  }

  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

function folderForPath(path: string): string | null {
  const normalized = normalizeVaultPath(path);
  if (!normalized) {
    return null;
  }
  const separator = normalized.lastIndexOf("/");
  return separator === -1 ? "" : normalized.slice(0, separator);
}

function readFrontmatterSelection(frontmatter: unknown): {
  templateId: unknown;
  themeId: unknown;
} {
  if (
    typeof frontmatter !== "object" ||
    frontmatter === null ||
    Array.isArray(frontmatter)
  ) {
    return { templateId: undefined, themeId: undefined };
  }

  const values = frontmatter as Record<string, unknown>;
  const nested = values["html-preview"];
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    const config = nested as Record<string, unknown>;
    return { templateId: config.template, themeId: config.theme };
  }
  return {
    templateId: values["html-preview.template"],
    themeId: values["html-preview.theme"]
  };
}

function selectionFor(
  source: TemplateSelection["source"],
  templateId: unknown,
  themeId: unknown,
  settings: MarkdownTemplateSettings,
  available: ReadonlySet<string>
): TemplateSelection | null {
  if (!isTemplateId(templateId) || !available.has(templateId)) {
    return null;
  }
  return {
    source,
    templateId,
    themeId: isTemplateId(themeId) ? themeId : settings.defaultThemeId
  };
}

export function resolveMarkdownTemplate(
  sourcePath: string,
  frontmatter: unknown,
  settings: MarkdownTemplateSettings,
  available: ReadonlySet<string>,
  mode: TemplateResolutionMode
): TemplateSelection | null {
  const frontmatterSelection = readFrontmatterSelection(frontmatter);
  const fromFrontmatter = selectionFor(
    "frontmatter",
    frontmatterSelection.templateId,
    frontmatterSelection.themeId,
    settings,
    available
  );
  if (fromFrontmatter) {
    return fromFrontmatter;
  }

  const folder = folderForPath(sourcePath);
  if (folder !== null) {
    let best: FolderTemplateMapping | null = null;
    for (const mapping of settings.folderMappings.slice(0, MAX_FOLDER_MAPPINGS)) {
      const mappedFolder = normalizeVaultPath(mapping.folder);
      if (
        !mappedFolder ||
        (folder !== mappedFolder && !folder.startsWith(`${mappedFolder}/`))
      ) {
        continue;
      }
      if (!best || mappedFolder.length > best.folder.length) {
        best = mapping;
      }
    }
    if (best) {
      const fromFolder = selectionFor(
        "folder",
        best.templateId,
        best.themeId,
        settings,
        available
      );
      if (fromFolder) {
        return fromFolder;
      }
    }
  }

  if (mode === "manual") {
    return selectionFor(
      "default",
      settings.defaultTemplateId,
      settings.defaultThemeId,
      settings,
      available
    );
  }
  return null;
}
