import { describe, expect, it } from "vitest";

import {
  annotationExportPath,
  exportAnnotationMarkdown
} from "../src/annotations/export";
import type { HtmlAnnotation } from "../src/annotations/types";

const annotation: HtmlAnnotation = {
  color: "green",
  comment: "Review the **important** point\nThen compare `a < b`.",
  id: "a1",
  quote: "First line\nSecond line > keep this",
  sourcePath: "Books/广告/article.html",
  target: {
    end: 42,
    exact: "First line\nSecond line > keep this",
    prefix: "Before ",
    start: 7,
    suffix: " After"
  }
};

describe("exportAnnotationMarkdown", () => {
  it("writes beside the source without overwriting the original file", () => {
    expect(annotationExportPath("Books/广告/article.html"))
      .toBe("Books/广告/article.annotations.md");
    expect(annotationExportPath("note.md")).toBe("note.annotations.md");
    expect(annotationExportPath("page.htm")).toBe("page.annotations.md");
  });

  it("includes source, quote, color, location, and comment", () => {
    const markdown = exportAnnotationMarkdown(annotation.sourcePath, [annotation]);

    expect(markdown).toContain("# Annotations");
    expect(markdown).toContain("Source: `Books/广告/article.html`");
    expect(markdown).toContain("## Annotation 1");
    expect(markdown).toContain("> First line");
    expect(markdown).toContain("> Second line > keep this");
    expect(markdown).toContain("- Color: green");
    expect(markdown).toContain("- Location: 7-42");
    expect(markdown).toContain("Review the **important** point");
    expect(markdown).toContain("Then compare `a < b`.");
  });

  it("renders an explicit empty state", () => {
    expect(exportAnnotationMarkdown("empty.md", [])).toContain(
      "No annotations were added to this file."
    );
  });
});
