import {
  TEMPLATE_SLOTS,
  type MarkdownTemplateManifest,
  type MarkdownTemplatePackage,
  type MarkdownTemplateTheme,
  type TemplateLayoutResult,
  type TemplatePackageFiles,
  type TemplateSlot
} from "./types";

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_NAME_LENGTH = 160;
const DANGEROUS_TAGS = new Set([
  "embed",
  "form",
  "iframe",
  "meta",
  "object",
  "script"
]);
const ALLOWED_SLOTS = new Set<string>(TEMPLATE_SLOTS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function isRelativeTemplatePath(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.startsWith("\\") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.split("/").includes("..") &&
    !/^[a-z][a-z\d+.-]*:/i.test(value)
  );
}

function parseTheme(value: unknown): MarkdownTemplateTheme | null {
  if (!isPlainObject(value)) {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    !ID_PATTERN.test(value.id) ||
    !boundedString(value.name, MAX_NAME_LENGTH) ||
    typeof value.stylesheet !== "string" ||
    !isRelativeTemplatePath(value.stylesheet)
  ) {
    return null;
  }
  return { id: value.id, name: value.name, stylesheet: value.stylesheet };
}

export function parseTemplateManifest(
  value: unknown
): MarkdownTemplateManifest | null {
  if (
    !isPlainObject(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    !ID_PATTERN.test(value.id) ||
    !boundedString(value.name, MAX_NAME_LENGTH) ||
    !Array.isArray(value.themes) ||
    value.themes.length === 0 ||
    value.themes.length > 32 ||
    typeof value.defaultTheme !== "string" ||
    !ID_PATTERN.test(value.defaultTheme)
  ) {
    return null;
  }

  const themes: MarkdownTemplateTheme[] = [];
  const ids = new Set<string>();
  for (const themeValue of value.themes) {
    const theme = parseTheme(themeValue);
    if (!theme || ids.has(theme.id)) {
      return null;
    }
    ids.add(theme.id);
    themes.push(theme);
  }
  if (!ids.has(value.defaultTheme)) {
    return null;
  }
  return {
    defaultTheme: value.defaultTheme,
    id: value.id,
    name: value.name,
    themes,
    version: 1
  };
}

function isSafeResourceReference(value: string): boolean {
  if (value.startsWith("#")) {
    return true;
  }
  return isRelativeTemplatePath(value);
}

export function validateTemplateLayout(layout: string): TemplateLayoutResult | null {
  if (!boundedString(layout, 200_000)) {
    return null;
  }
  const document = new DOMParser().parseFromString(layout, "text/html");
  const slots = new Set<TemplateSlot>();
  for (const element of document.querySelectorAll("*") as NodeListOf<Element>) {
    const tag = element.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) {
      return null;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        return null;
      }
      if (["src", "href", "action", "poster", "data"].includes(name)) {
        if (!isSafeResourceReference(attribute.value)) {
          return null;
        }
      }
      if (name === "http-equiv" && attribute.value.toLowerCase() === "refresh") {
        return null;
      }
    }
    const slot = element.getAttribute("data-slot");
    if (slot !== null) {
      if (!ALLOWED_SLOTS.has(slot as TemplateSlot) || slots.has(slot as TemplateSlot)) {
        return null;
      }
      slots.add(slot as TemplateSlot);
    }
  }
  if (!slots.has("content")) {
    return null;
  }
  return { html: layout, slots };
}

export function validateTemplatePackage(
  files: TemplatePackageFiles
): MarkdownTemplatePackage | null {
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(files.manifest) as unknown;
  } catch {
    return null;
  }
  const manifest = parseTemplateManifest(manifestValue);
  const layout = validateTemplateLayout(files.layout);
  if (!manifest || !layout || typeof files.styles !== "string") {
    return null;
  }
  const themes: Record<string, string> = {};
  for (const theme of manifest.themes) {
    const stylesheet = files.themes[theme.id];
    if (typeof stylesheet !== "string") {
      return null;
    }
    themes[theme.id] = stylesheet;
  }
  return {
    layout: layout.html,
    manifest,
    styles: files.styles,
    themes
  };
}
