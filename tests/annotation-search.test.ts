import { describe, expect, it } from "vitest";

import {
  filterAnnotations,
  type AnnotationSearchQuery
} from "../src/annotations/search";
import type { HtmlAnnotation } from "../src/annotations/types";

const annotations: HtmlAnnotation[] = [
  {
    color: "blue",
    comment: "Important follow-up",
    id: "a1",
    quote: "First sales idea",
    sourcePath: "Books/Ads/one.html",
    target: { end: 16, exact: "First sales idea", prefix: "", start: 0, suffix: "" }
  },
  {
    color: "yellow",
    comment: "",
    id: "a2",
    quote: "Second research note",
    sourcePath: "Research/two.md",
    target: { end: 20, exact: "Second research note", prefix: "", start: 0, suffix: "" }
  }
];

const all: AnnotationSearchQuery = {
  color: "all",
  folder: "",
  kind: "all",
  query: ""
};

describe("filterAnnotations", () => {
  it("searches source paths, quotes, and comments", () => {
    expect(filterAnnotations(annotations, { ...all, query: "follow-up" }))
      .toEqual([annotations[0]]);
    expect(filterAnnotations(annotations, { ...all, query: "research" }))
      .toEqual([annotations[1]]);
  });

  it("filters by folder, color, and annotation type", () => {
    expect(filterAnnotations(annotations, { ...all, folder: "Books", color: "blue" }))
      .toEqual([annotations[0]]);
    expect(filterAnnotations(annotations, { ...all, kind: "highlights" }))
      .toEqual([annotations[1]]);
    expect(filterAnnotations(annotations, { ...all, kind: "comments" }))
      .toEqual([annotations[0]]);
  });
});
