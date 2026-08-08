import type { CleanupRule } from "../cleanup/types";

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
