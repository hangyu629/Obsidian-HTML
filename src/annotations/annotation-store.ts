import type { HtmlAnnotation, HtmlAnnotationDocument } from "./types";

export interface AnnotationStorageAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  write(path: string, data: string): Promise<void>;
}

function validateSourcePath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").includes("..")
  ) {
    throw new Error(`Invalid Vault path: ${path}`);
  }
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}

function isAnnotation(value: unknown): value is HtmlAnnotation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const target = candidate.target;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.comment === "string" &&
    typeof candidate.quote === "string" &&
    typeof candidate.sourcePath === "string" &&
    typeof target === "object" &&
    target !== null &&
    !Array.isArray(target) &&
    typeof (target as Record<string, unknown>).start === "number" &&
    typeof (target as Record<string, unknown>).end === "number" &&
    typeof (target as Record<string, unknown>).exact === "string" &&
    typeof (target as Record<string, unknown>).prefix === "string" &&
    typeof (target as Record<string, unknown>).suffix === "string"
  );
}

function parseDocument(value: unknown): HtmlAnnotationDocument | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.annotations)) return null;
  if (!candidate.annotations.every(isAnnotation)) return null;
  return { annotations: candidate.annotations, version: 1 };
}

function serialize(annotations: readonly HtmlAnnotation[]): string {
  return `${JSON.stringify({ annotations: [...annotations], version: 1 }, null, 2)}\n`;
}

export function annotationPagePath(sourcePath: string): string {
  return `.html-preview/annotations/pages/${sourcePath}.json`;
}

export class HtmlAnnotationStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: AnnotationStorageAdapter) {}

  async load(sourcePath: string): Promise<HtmlAnnotation[]> {
    validateSourcePath(sourcePath);
    await this.queue;
    return this.read(sourcePath);
  }

  addFileAnnotation(sourcePath: string, annotation: HtmlAnnotation): Promise<void> {
    validateSourcePath(sourcePath);
    return this.mutate(async () => {
      const path = annotationPagePath(sourcePath);
      const annotations = await this.read(sourcePath);
      const next = annotations.filter((item) => item.id !== annotation.id);
      next.push({ ...annotation, sourcePath });
      await this.write(path, next);
    });
  }

  removeAnnotation(annotation: HtmlAnnotation): Promise<void> {
    validateSourcePath(annotation.sourcePath);
    return this.mutate(async () => {
      const path = annotationPagePath(annotation.sourcePath);
      const annotations = await this.read(annotation.sourcePath);
      await this.write(
        path,
        annotations.filter((item) => item.id !== annotation.id)
      );
    });
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async write(path: string, annotations: readonly HtmlAnnotation[]): Promise<void> {
    const directory = parentPath(path);
    if (directory) {
      const segments = directory.split("/");
      let current = "";
      for (const segment of segments) {
        current = current ? `${current}/${segment}` : segment;
        if (!(await this.adapter.exists(current))) await this.adapter.mkdir(current);
      }
    }
    if (annotations.length === 0) {
      if (await this.adapter.exists(path)) await this.adapter.remove(path);
      return;
    }
    await this.adapter.write(path, serialize(annotations));
  }

  private async read(sourcePath: string): Promise<HtmlAnnotation[]> {
    const path = annotationPagePath(sourcePath);
    if (!(await this.adapter.exists(path))) return [];
    const parsed = parseDocument(JSON.parse(await this.adapter.read(path)) as unknown);
    return parsed?.annotations ?? [];
  }
}
