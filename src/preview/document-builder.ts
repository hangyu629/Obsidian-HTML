import { createBridgeScript } from "./bridge-script";
import { classifyNavigation } from "./navigation";
import type {
  BuildPreviewInput,
  BuildPreviewResult,
  PreviewDiagnostic
} from "./types";

const RESOURCE_SELECTORS: ReadonlyArray<readonly [string, string]> = [
  ["[src]", "src"],
  ["link[href]", "href"],
  ["[poster]", "poster"],
  ["object[data]", "data"]
];

function getBaseUrl(resourceUrl: string, diagnostics: PreviewDiagnostic[]): string {
  try {
    return new URL(".", resourceUrl).href;
  } catch {
    diagnostics.push({
      code: "invalid-resource-url",
      level: "error",
      message: `Could not derive a resource base URL from: ${resourceUrl}`,
      value: resourceUrl
    });
    return "about:blank";
  }
}

function isLocalReference(value: string): boolean {
  const reference = value.trim();
  return (
    reference.length > 0 &&
    !reference.startsWith("#") &&
    !reference.startsWith("//") &&
    !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(reference)
  );
}

function collectReference(
  value: string,
  input: BuildPreviewInput,
  dependencies: Set<string>,
  diagnostics: PreviewDiagnostic[],
  diagnosedMissing: Set<string>
): void {
  if (!isLocalReference(value)) {
    return;
  }

  const decision = classifyNavigation(value, input.sourcePath);
  if (decision.kind !== "vault") {
    return;
  }
  if (input.knownVaultPaths.has(decision.path)) {
    dependencies.add(decision.path);
    return;
  }
  if (diagnosedMissing.has(decision.path)) {
    return;
  }

  diagnosedMissing.add(decision.path);
  diagnostics.push({
    code: "missing-resource",
    level: "warning",
    message: `Local resource was not found in the Vault: ${decision.path}`,
    value
  });
}

function collectDependencies(
  document: Document,
  input: BuildPreviewInput,
  diagnostics: PreviewDiagnostic[]
): Set<string> {
  const dependencies = new Set<string>();
  const diagnosedMissing = new Set<string>();

  for (const [selector, attribute] of RESOURCE_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (value !== null) {
        collectReference(value, input, dependencies, diagnostics, diagnosedMissing);
      }
    }
  }

  for (const element of document.querySelectorAll("[srcset]")) {
    const srcset = element.getAttribute("srcset")?.trim();
    if (!srcset || srcset.startsWith("data:")) {
      continue;
    }
    for (const candidate of srcset.split(",")) {
      const value = candidate.trim().split(/\s+/, 1)[0];
      if (value) {
        collectReference(value, input, dependencies, diagnostics, diagnosedMissing);
      }
    }
  }

  return dependencies;
}

function installBase(document: Document, href: string, diagnostics: PreviewDiagnostic[]): void {
  const authorBases = [...document.querySelectorAll("base")];
  if (authorBases.length > 0) {
    diagnostics.push({
      code: "replaced-base",
      level: "warning",
      message: "The document base URL was replaced with its Vault folder."
    });
    for (const base of authorBases) {
      base.remove();
    }
  }

  const base = document.createElement("base");
  base.href = href;
  document.head.prepend(base);
}

function installBridge(
  document: Document,
  renderId: string,
  cleanupRules: BuildPreviewInput["cleanupRules"],
  annotations: BuildPreviewInput["annotations"]
): void {
  const script = document.createElement("script");
  script.dataset.htmlPreviewBridge = "true";
  script.textContent = createBridgeScript(renderId, cleanupRules, annotations ?? []);
  document.head.insertBefore(script, document.head.children[1] ?? null);
}

export function buildPreviewDocument(input: BuildPreviewInput): BuildPreviewResult {
  const diagnostics: PreviewDiagnostic[] = [];
  const parser = new DOMParser();
  const document = parser.parseFromString(input.source, "text/html");

  if (!input.allowScripts) {
    const authorScripts = [...document.querySelectorAll("script")];
    for (const script of authorScripts) {
      script.remove();
    }
    if (authorScripts.length > 0) {
      diagnostics.push({
        code: "scripts-disabled",
        level: "info",
        message: `Removed ${authorScripts.length} page script(s) because JavaScript is disabled.`
      });
    }
  }

  const dependencies = collectDependencies(document, input, diagnostics);
  installBase(document, getBaseUrl(input.resourceUrl, diagnostics), diagnostics);
  installBridge(document, input.renderId, input.cleanupRules, input.annotations ?? []);

  return {
    dependencies,
    diagnostics,
    html: `<!doctype html>\n${document.documentElement.outerHTML}`
  };
}

export type {
  BuildPreviewInput,
  BuildPreviewResult,
  PreviewDiagnostic
} from "./types";
