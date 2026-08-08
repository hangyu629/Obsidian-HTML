import { Component, MarkdownRenderer, type App } from "obsidian";

import { scopeTemplateCss } from "./css-scope";
import { markdownTemplatePath } from "./templates/catalog";
import { BUILT_IN_TEMPLATE } from "./templates/built-in";
import type { MarkdownTemplatePackage } from "./templates/types";

export interface RenderEnhancedMarkdownInput {
  app: App;
  component: Component;
  frontmatter?: Record<string, unknown>;
  resolveAsset?: (vaultPath: string) => string | null;
  root: HTMLElement;
  source: string;
  sourcePath: string;
  template: MarkdownTemplatePackage;
  themeId?: string;
}

export interface RenderEnhancedMarkdownResult {
  dependencies: Set<string>;
  rootSelector: string;
}

let nextRootId = 0;

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "section";
}

function sourceTitle(sourcePath: string): string {
  const name = sourcePath.split("/").pop() ?? sourcePath;
  return name.replace(/\.md$/i, "");
}

function renderProperties(slot: HTMLElement, frontmatter: Record<string, unknown>): void {
  const list = document.createElement("dl");
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === "position") continue;
    const term = document.createElement("dt");
    term.textContent = key;
    const detail = document.createElement("dd");
    detail.textContent = Array.isArray(value)
      ? value.map((item) => String(item)).join(", ")
      : String(value ?? "");
    list.append(term, detail);
  }
  if (list.children.length > 0) slot.append(list);
  else slot.remove();
}

function renderToc(slot: HTMLElement, content: HTMLElement): void {
  const headings = [...content.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  if (headings.length === 0) {
    slot.remove();
    return;
  }
  const used = new Set<string>();
  const list = document.createElement("ul");
  for (const heading of headings) {
    const base = `enhanced-heading-${slugify(heading.textContent ?? "")}`;
    let id = base;
    let suffix = 2;
    while (used.has(id) || document.getElementById(id)) {
      id = `${base}-${suffix++}`;
    }
    used.add(id);
    heading.id = id;
    const item = document.createElement("li");
    item.dataset.level = heading.tagName.slice(1);
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = heading.textContent ?? "";
    item.append(link);
    list.append(item);
  }
  slot.append(list);
}

function isLocalTemplateReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.startsWith("#") &&
    !trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !/^[a-z][a-z\d+.-]*:/i.test(trimmed)
  );
}

function resolveTemplateAssets(
  root: HTMLElement,
  templateId: string,
  resolveAsset: ((vaultPath: string) => string | null) | undefined,
  dependencies: Set<string>
): void {
  if (!resolveAsset) return;
  const packageRoot = markdownTemplatePath(templateId);
  for (const element of root.querySelectorAll("[src], [href], [poster], [data]")) {
    for (const attribute of ["src", "href", "poster", "data"]) {
      const value = element.getAttribute(attribute);
      if (!value || !isLocalTemplateReference(value)) continue;
      const path = `${packageRoot}/${value}`;
      const resolved = resolveAsset(path);
      if (resolved) {
        element.setAttribute(attribute, resolved);
        dependencies.add(path);
      }
    }
  }
}

function resolveCssAssets(
  css: string,
  templateId: string,
  resolveAsset: ((vaultPath: string) => string | null) | undefined,
  dependencies: Set<string>
): string {
  if (!resolveAsset) return css;
  const packageRoot = markdownTemplatePath(templateId);
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (full, quote: string, value: string) => {
    if (!isLocalTemplateReference(value)) return full;
    const path = `${packageRoot}/${value.trim()}`;
    const resolved = resolveAsset(path);
    if (!resolved) return full;
    dependencies.add(path);
    return `url(${quote}${resolved}${quote})`;
  });
}

export async function renderEnhancedMarkdown(
  input: RenderEnhancedMarkdownInput
): Promise<RenderEnhancedMarkdownResult> {
  const template = input.template.manifest.id ? input.template : BUILT_IN_TEMPLATE;
  const parsed = new DOMParser().parseFromString(template.layout, "text/html");
  const content = parsed.querySelector('[data-slot="content"]');
  if (!content) {
    return renderEnhancedMarkdown({ ...input, template: BUILT_IN_TEMPLATE });
  }

  const rootId = `enhanced-markdown-${++nextRootId}`;
  const rootSelector = `[data-enhanced-markdown-root="${escapeCssString(rootId)}"]`;
  input.root.classList.add("enhanced-markdown-root");
  input.root.setAttribute("data-enhanced-markdown-root", rootId);
  const dependencies = new Set<string>();
  const nodes = [...parsed.body.childNodes].map((node) => node.cloneNode(true));
  input.root.replaceChildren(...nodes);

  const contentSlot = input.root.querySelector('[data-slot="content"]');
  if (!contentSlot || !(contentSlot instanceof HTMLElement)) {
    return { dependencies, rootSelector };
  }
  const titleSlot = input.root.querySelector('[data-slot="title"]');
  if (titleSlot instanceof HTMLElement) {
    titleSlot.textContent = sourceTitle(input.sourcePath);
  }
  const propertiesSlot = input.root.querySelector('[data-slot="properties"]');
  if (propertiesSlot instanceof HTMLElement) {
    renderProperties(propertiesSlot, input.frontmatter ?? {});
  }

  await MarkdownRenderer.render(
    input.app,
    input.source,
    contentSlot,
    input.sourcePath,
    input.component
  );

  const tocSlot = input.root.querySelector('[data-slot="toc"]');
  if (tocSlot instanceof HTMLElement) renderToc(tocSlot, contentSlot);

  const themeId = input.themeId ?? template.manifest.defaultTheme;
  const theme = template.themes[themeId] ?? template.themes[template.manifest.defaultTheme] ?? "";
  const css = resolveCssAssets(`${template.styles}\n${theme}`, template.manifest.id, input.resolveAsset, dependencies);
  const style = document.createElement("style");
  style.dataset.enhancedMarkdownTemplate = "true";
  style.textContent = scopeTemplateCss(css, rootSelector);
  input.root.prepend(style);
  resolveTemplateAssets(input.root, template.manifest.id, input.resolveAsset, dependencies);

  return { dependencies, rootSelector };
}
