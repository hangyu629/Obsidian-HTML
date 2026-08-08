import type {
  AncestorFingerprint,
  CleanupCandidate,
  CleanupDocument,
  CleanupRule,
  ElementFingerprint
} from "./types";

const MAX_SELECTOR_LENGTH = 512;
const SAFE_SELECTOR_CHARS = /^[a-zA-Z0-9_#.()\-\s>+~:[\]="']+$/;
const TAG_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const FIELD_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const RULE_ID_PATTERN = /^[0-9a-f]{32}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function parseClasses(value: unknown, maximum = 12): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) {
    return null;
  }
  const classes: string[] = [];
  for (const item of value) {
    if (!isBoundedString(item, 80) || !/^[a-zA-Z0-9_-]+$/.test(item)) {
      return null;
    }
    classes.push(item);
  }
  return classes;
}

function parseAncestor(value: unknown): AncestorFingerprint | null {
  if (!isPlainObject(value) || !isBoundedString(value.tag, 32)) {
    return null;
  }
  if (!TAG_PATTERN.test(value.tag)) {
    return null;
  }
  const classes = parseClasses(value.classes, 6);
  if (!classes) {
    return null;
  }
  if (value.id !== undefined && !isBoundedString(value.id, 128)) {
    return null;
  }
  return {
    classes,
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    tag: value.tag
  };
}

function parseFingerprint(value: unknown): ElementFingerprint | null {
  if (!isPlainObject(value) || !isBoundedString(value.tag, 32)) {
    return null;
  }
  if (!TAG_PATTERN.test(value.tag) || !isBoundedString(value.text, 160)) {
    return null;
  }
  if (value.id !== undefined && !isBoundedString(value.id, 128)) {
    return null;
  }

  const classes = parseClasses(value.classes);
  if (!classes || !isPlainObject(value.attributes)) {
    return null;
  }
  const attributeEntries = Object.entries(value.attributes);
  if (attributeEntries.length > 8) {
    return null;
  }
  const attributes: Record<string, string> = {};
  for (const [name, attributeValue] of attributeEntries) {
    if (
      !FIELD_PATTERN.test(name) ||
      !isBoundedString(attributeValue, 160)
    ) {
      return null;
    }
    attributes[name] = attributeValue;
  }

  if (!Array.isArray(value.ancestors) || value.ancestors.length > 5) {
    return null;
  }
  const ancestors: AncestorFingerprint[] = [];
  for (const ancestorValue of value.ancestors) {
    const ancestor = parseAncestor(ancestorValue);
    if (!ancestor) {
      return null;
    }
    ancestors.push(ancestor);
  }

  return {
    ancestors,
    attributes,
    classes,
    ...(typeof value.id === "string" ? { id: value.id } : {}),
    tag: value.tag,
    text: value.text
  };
}

export function isSupportedCleanupSelector(selector: string): boolean {
  const trimmed = selector.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_SELECTOR_LENGTH ||
    !SAFE_SELECTOR_CHARS.test(trimmed) ||
    /[{},;@]/.test(trimmed) ||
    /^(html|head|body)$/i.test(trimmed)
  ) {
    return false;
  }

  const withoutNth = trimmed.replace(/:nth-of-type\([1-9][0-9]*\)/g, "");
  if (withoutNth.includes(":")) {
    return false;
  }
  const combinators = (trimmed.match(/[>+~]/g)?.length ?? 0) +
    trimmed.split(/\s+/).filter(Boolean).length - 1;
  return combinators <= 8;
}

export function parseCleanupCandidate(value: unknown): CleanupCandidate | null {
  if (
    !isPlainObject(value) ||
    typeof value.selector !== "string" ||
    !isSupportedCleanupSelector(value.selector)
  ) {
    return null;
  }
  const fingerprint = parseFingerprint(value.fingerprint);
  return fingerprint ? { fingerprint, selector: value.selector } : null;
}

function isNormalizedSourcePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_024 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !value.split("/").includes("..")
  );
}

function parseRule(value: unknown): CleanupRule | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const candidate = parseCleanupCandidate(value);
  if (
    !candidate ||
    typeof value.id !== "string" ||
    !RULE_ID_PATTERN.test(value.id) ||
    (value.scope !== "file" && value.scope !== "folder") ||
    !isNormalizedSourcePath(value.sourcePath) ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    return null;
  }
  return {
    ...candidate,
    createdAt: value.createdAt,
    id: value.id,
    scope: value.scope,
    sourcePath: value.sourcePath
  };
}

export function parseCleanupDocument(value: unknown): CleanupDocument | null {
  if (
    !isPlainObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.rules) ||
    value.rules.length > 500
  ) {
    return null;
  }
  const rules: CleanupRule[] = [];
  for (const ruleValue of value.rules) {
    const rule = parseRule(ruleValue);
    if (!rule) {
      return null;
    }
    rules.push(rule);
  }
  return { rules, version: 1 };
}
