export type CleanupScope = "file" | "folder";

export interface AncestorFingerprint {
  classes: string[];
  id?: string;
  tag: string;
}

export interface ElementFingerprint {
  ancestors: AncestorFingerprint[];
  attributes: Record<string, string>;
  classes: string[];
  id?: string;
  tag: string;
  text: string;
}

export interface CleanupCandidate {
  fingerprint: ElementFingerprint;
  selector: string;
}

export interface CleanupRule extends CleanupCandidate {
  createdAt: string;
  id: string;
  scope: CleanupScope;
  sourcePath: string;
}

export interface CleanupDocument {
  rules: CleanupRule[];
  version: 1;
}

