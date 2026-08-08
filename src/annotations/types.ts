export interface HtmlAnnotationTarget {
  end: number;
  exact: string;
  prefix: string;
  start: number;
  suffix: string;
}

export interface HtmlAnnotation {
  comment: string;
  id: string;
  quote: string;
  sourcePath: string;
  target: HtmlAnnotationTarget;
}

export interface HtmlAnnotationDocument {
  annotations: HtmlAnnotation[];
  version: 1;
}
