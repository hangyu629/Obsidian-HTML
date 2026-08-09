import { buildPreviewDocument } from "../preview/document-builder";
import type { BuildPreviewInput, BuildPreviewResult } from "../preview/types";
import type { ReadableArticle } from "./extractor";

export const SAVED_READER_META_NAME = "obsidian-html-reader";

export type ReaderTheme = "light" | "dark";

export interface BuildReaderPreviewInput
  extends Omit<
    BuildPreviewInput,
    "allowScripts" | "cleanupRules" | "source"
  > {
  article: ReadableArticle;
  theme: ReaderTheme;
}

export interface BuildReaderPreviewResult extends BuildPreviewResult {
  standaloneHtml: string;
}

const BLOCKED_SELECTOR = [
  "script",
  "style",
  "link",
  "iframe",
  "frame",
  "frameset",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "object",
  "embed",
  "applet",
  "portal",
  "base",
  "template",
  "meta[http-equiv='refresh']"
].join(",");

const READER_STYLE = `
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, ui-serif, Georgia, Cambria, "Times New Roman", serif;
    line-height: 1.72;
    background: var(--reader-bg);
    color: var(--reader-fg);
  }
  html[data-reader-theme="light"] {
    --reader-bg: #f5efe4;
    --reader-surface: rgba(255,255,255,0.78);
    --reader-fg: #1f1a16;
    --reader-muted: #6a5b4e;
    --reader-border: rgba(111, 92, 73, 0.18);
    --reader-accent: #9d5b4b;
    --reader-code: #f3ead9;
  }
  html[data-reader-theme="dark"] {
    --reader-bg: #141a22;
    --reader-surface: rgba(20, 28, 39, 0.78);
    --reader-fg: #edf1f7;
    --reader-muted: #9da9bb;
    --reader-border: rgba(201, 214, 234, 0.16);
    --reader-accent: #f08e6d;
    --reader-code: #1b2430;
  }
  .html-reader-shell {
    width: min(920px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 40px 0 72px;
  }
  .html-reader-header {
    padding: 28px 32px 26px;
    border: 1px solid var(--reader-border);
    border-radius: 8px;
    background: var(--reader-surface);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
  }
  .html-reader-site, .html-reader-meta { color: var(--reader-muted); }
  .html-reader-site {
    margin: 0 0 10px;
    font: 600 12px/1.4 system-ui, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .html-reader-title { margin: 0; font-size: clamp(2.1rem, 4vw, 3.2rem); line-height: 1.08; }
  .html-reader-excerpt { margin: 14px 0 0; font-size: 1.05rem; color: var(--reader-muted); }
  .html-reader-meta { margin: 16px 0 0; font: 500 0.93rem/1.5 system-ui, sans-serif; }
  .html-reader-article {
    margin-top: 20px;
    padding: 34px 32px 38px;
    border: 1px solid var(--reader-border);
    border-radius: 8px;
    background: var(--reader-surface);
  }
  .html-reader-article :where(h1, h2, h3, h4) { line-height: 1.18; margin: 1.8em 0 0.6em; }
  .html-reader-article :where(p, ul, ol, blockquote, pre, table, figure) { margin: 1em 0; }
  .html-reader-article :where(a) { color: var(--reader-accent); text-decoration-thickness: 0.08em; }
  .html-reader-article :where(img, video) {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
  .html-reader-article :where(blockquote) {
    margin-inline: 0;
    padding-left: 16px;
    border-left: 3px solid var(--reader-accent);
    color: var(--reader-muted);
  }
  .html-reader-article :where(pre, code, kbd, samp) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .html-reader-article :where(pre) {
    overflow-x: auto;
    padding: 14px 16px;
    border-radius: 6px;
    background: var(--reader-code);
  }
  .html-reader-article :where(code):not(pre code) {
    padding: 0.12em 0.36em;
    border-radius: 4px;
    background: var(--reader-code);
  }
  .html-reader-article :where(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.97rem;
  }
  .html-reader-article :where(th, td) {
    padding: 10px 12px;
    border-bottom: 1px solid var(--reader-border);
    text-align: left;
    vertical-align: top;
  }
  @media (max-width: 720px) {
    .html-reader-shell { width: min(100vw - 24px, 920px); padding-top: 18px; }
    .html-reader-header, .html-reader-article { padding-inline: 18px; }
    .html-reader-title { font-size: 2rem; }
  }
`;

function isUnsafeUrl(value: string, tagName: string, attributeName: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (/^(javascript|vbscript):/.test(normalized)) return true;
  if (normalized.startsWith("data:")) {
    return !(tagName === "img" && attributeName === "src" && normalized.startsWith("data:image/"));
  }
  return false;
}

function sanitizeSrcset(value: string, element: Element): string | null {
  const candidates = value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
  if (candidates.length === 0) return null;
  for (const candidate of candidates) {
    const [url] = candidate.split(/\s+/, 1);
    if (!url || isUnsafeUrl(url, element.tagName.toLowerCase(), "srcset")) {
      return null;
    }
  }
  return candidates.join(", ");
}

function sanitizeElementAttributes(element: Element): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (name === "style" || name === "srcdoc" || name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }
    if (name === "srcset") {
      const nextValue = sanitizeSrcset(attribute.value, element);
      if (nextValue) {
        element.setAttribute(attribute.name, nextValue);
      } else {
        element.removeAttribute(attribute.name);
      }
      continue;
    }
    if (
      name === "href" ||
      name === "src" ||
      name === "poster" ||
      name === "xlink:href"
    ) {
      if (isUnsafeUrl(attribute.value, element.tagName.toLowerCase(), name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function sanitizeArticleContent(content: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(`<body>${content}</body>`, "text/html");
  parsed.body.querySelectorAll(BLOCKED_SELECTOR).forEach((element) => element.remove());
  parsed.body.querySelectorAll("*").forEach((element) => sanitizeElementAttributes(element));
  const fragment = document.createDocumentFragment();
  fragment.append(...parsed.body.childNodes);
  return fragment;
}

function appendTextElement(
  document: Document,
  parent: HTMLElement,
  tagName: string,
  className: string,
  text: string
): void {
  if (text.trim().length === 0) return;
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
}

export function isSavedReaderPage(source: string): boolean {
  return new RegExp(`<meta\\s+name=["']${SAVED_READER_META_NAME}["']`, "i").test(source);
}

export function buildStandaloneReaderPage(
  article: ReadableArticle,
  theme: ReaderTheme
): string {
  const document = new DOMParser().parseFromString("<!doctype html><html><head></head><body></body></html>", "text/html");
  document.documentElement.lang = article.lang ?? "en";
  document.documentElement.setAttribute("data-reader-theme", theme);
  if (article.dir) {
    document.documentElement.setAttribute("dir", article.dir);
  }

  const charset = document.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const viewport = document.createElement("meta");
  viewport.setAttribute("name", "viewport");
  viewport.setAttribute("content", "width=device-width, initial-scale=1");
  const marker = document.createElement("meta");
  marker.setAttribute("name", SAVED_READER_META_NAME);
  marker.setAttribute("content", "1");
  const title = document.createElement("title");
  title.textContent = article.title;
  const style = document.createElement("style");
  style.textContent = READER_STYLE;
  document.head.append(charset, viewport, marker, title, style);

  const shell = document.createElement("main");
  shell.className = "html-reader-shell";
  const header = document.createElement("header");
  header.className = "html-reader-header";
  appendTextElement(document, header, "p", "html-reader-site", article.siteName);
  appendTextElement(document, header, "h1", "html-reader-title", article.title);
  appendTextElement(document, header, "p", "html-reader-excerpt", article.excerpt);
  appendTextElement(
    document,
    header,
    "p",
    "html-reader-meta",
    [article.byline, article.length > 0 ? `${article.length} characters` : ""]
      .filter((value) => value.trim().length > 0)
      .join(" • ")
  );
  const articleEl = document.createElement("article");
  articleEl.className = "html-reader-article";
  articleEl.append(sanitizeArticleContent(article.content));
  shell.append(header, articleEl);
  document.body.append(shell);

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

export function buildReaderPreview(
  input: BuildReaderPreviewInput
): BuildReaderPreviewResult {
  const standaloneHtml = buildStandaloneReaderPage(input.article, input.theme);
  const preview = buildPreviewDocument({
    annotations: input.annotations,
    allowScripts: false,
    cleanupRules: [],
    knownVaultPaths: input.knownVaultPaths,
    renderId: input.renderId,
    resourceUrl: input.resourceUrl,
    source: standaloneHtml,
    sourcePath: input.sourcePath
  });
  return { ...preview, standaloneHtml };
}
