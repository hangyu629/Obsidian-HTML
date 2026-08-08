import type { CleanupRule } from "../cleanup/types";
import type { HtmlAnnotation } from "../annotations/types";

export type DiagnosticLevel = "info" | "warning" | "error";

export interface PreviewDiagnostic {
  code:
    | "invalid-resource-url"
    | "missing-resource"
    | "replaced-base"
    | "scripts-disabled";
  level: DiagnosticLevel;
  message: string;
  value?: string;
}

export interface BuildPreviewInput {
  allowScripts: boolean;
  cleanupRules: readonly CleanupRule[];
  annotations?: readonly HtmlAnnotation[];
  knownVaultPaths: ReadonlySet<string>;
  renderId: string;
  resourceUrl: string;
  source: string;
  sourcePath: string;
}

export interface BuildPreviewResult {
  dependencies: Set<string>;
  diagnostics: PreviewDiagnostic[];
  html: string;
}

export interface PreviewNavigationMessage {
  type: "obsidian-html-preview:navigate";
  renderId: string;
  href: string;
}
