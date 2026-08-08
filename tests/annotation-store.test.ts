import { describe, expect, it } from "vitest";

import {
  HtmlAnnotationStore,
  annotationPagePath,
  type AnnotationStorageAdapter
} from "../src/annotations/annotation-store";

class MemoryAdapter implements AnnotationStorageAdapter {
  readonly directories = new Set<string>();
  readonly files = new Map<string, string>();

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`Missing file: ${path}`);
    return value;
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }
}

describe("HtmlAnnotationStore", () => {
  it("stores file annotations in a mirrored Vault path", async () => {
    const adapter = new MemoryAdapter();
    const store = new HtmlAnnotationStore(adapter);
    const annotation = {
      comment: "intro note",
      id: "11111111111111111111111111111111",
      quote: "Alpha",
      sourcePath: "pages/index.html",
      target: { end: 5, exact: "Alpha", prefix: "", start: 0, suffix: " beta" }
    };

    await store.addFileAnnotation("pages/index.html", annotation);

    expect(adapter.files.has(annotationPagePath("pages/index.html"))).toBe(true);
    expect(await store.load("pages/index.html")).toEqual([annotation]);
  });

  it("removes individual annotations without touching other entries", async () => {
    const adapter = new MemoryAdapter();
    const store = new HtmlAnnotationStore(adapter);
    const first = {
      comment: "first",
      id: "11111111111111111111111111111111",
      quote: "Alpha",
      sourcePath: "pages/index.html",
      target: { end: 5, exact: "Alpha", prefix: "", start: 0, suffix: " beta" }
    };
    const second = {
      comment: "second",
      id: "22222222222222222222222222222222",
      quote: "beta",
      sourcePath: "pages/index.html",
      target: { end: 10, exact: "beta", prefix: "Alpha ", start: 6, suffix: " gamma" }
    };
    await store.addFileAnnotation("pages/index.html", first);
    await store.addFileAnnotation("pages/index.html", second);

    await store.removeAnnotation(second);

    expect(await store.load("pages/index.html")).toEqual([first]);
  });
});
