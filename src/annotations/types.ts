export const ANNOTATION_COLORS = [
  "yellow",
  "green",
  "blue",
  "pink",
  "violet"
] as const;

export type AnnotationColor = (typeof ANNOTATION_COLORS)[number];

export function annotationColor(value: unknown): AnnotationColor | null {
  return typeof value === "string" &&
    ANNOTATION_COLORS.includes(value as AnnotationColor)
    ? (value as AnnotationColor)
    : null;
}

export interface HtmlAnnotationTarget {
  end: number;
  exact: string;
  prefix: string;
  start: number;
  suffix: string;
}

export interface HtmlAnnotation {
  color?: AnnotationColor;
  comment: string;
  id: string;
  quote: string;
  sourcePath: string;
  target: HtmlAnnotationTarget;
}

export function annotationDisplayColor(
  annotation: HtmlAnnotation
): AnnotationColor {
  return annotation.color ?? "yellow";
}

export interface HtmlAnnotationDocument {
  annotations: HtmlAnnotation[];
  version: 1;
}
