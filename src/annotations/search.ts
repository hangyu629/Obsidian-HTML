import type { AnnotationColor, HtmlAnnotation } from "./types";

export type AnnotationSearchKind = "all" | "comments" | "highlights";

export interface AnnotationSearchQuery {
  color: AnnotationColor | "all";
  folder: string;
  kind: AnnotationSearchKind;
  query: string;
}

export const DEFAULT_ANNOTATION_SEARCH_QUERY: AnnotationSearchQuery = {
  color: "all",
  folder: "",
  kind: "all",
  query: ""
};

export function filterAnnotations(
  annotations: readonly HtmlAnnotation[],
  query: AnnotationSearchQuery
): HtmlAnnotation[] {
  const needle = query.query.trim().toLocaleLowerCase();
  const folder = query.folder.trim().replace(/\/+$/, "");
  return annotations.filter((annotation) => {
    const hasComment = annotation.comment.trim().length > 0;
    const matchesText = !needle || [
      annotation.comment,
      annotation.quote,
      annotation.sourcePath
    ].some((value) => value.toLocaleLowerCase().includes(needle));
    const matchesFolder = !folder ||
      annotation.sourcePath === folder ||
      annotation.sourcePath.startsWith(`${folder}/`);
    const matchesColor = query.color === "all" || annotation.color === query.color;
    const matchesKind = query.kind === "all" ||
      (query.kind === "comments" && hasComment) ||
      (query.kind === "highlights" && !hasComment);
    return matchesText && matchesFolder && matchesColor && matchesKind;
  });
}
