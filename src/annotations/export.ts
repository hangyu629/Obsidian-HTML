import type { HtmlAnnotation } from "./types";

export function annotationExportPath(sourcePath: string): string {
  return `${sourcePath.replace(/\.(?:html?|md)$/i, "")}.annotations.md`;
}

function quoteBlock(value: string): string {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export function exportAnnotationMarkdown(
  sourcePath: string,
  annotations: readonly HtmlAnnotation[]
): string {
  const lines = [
    "# Annotations",
    "",
    `Source: \`${sourcePath}\``,
    "",
    annotations.length === 0
      ? "No annotations were added to this file."
      : annotations
        .map((annotation, index) => {
          const comment = annotation.comment.trim() || "No comment.";
          return [
            `## Annotation ${index + 1}`,
            "",
            quoteBlock(annotation.quote),
            "",
            `- Color: ${annotation.color ?? "yellow"}`,
            `- Location: ${annotation.target.start}-${annotation.target.end}`,
            `- ID: \`${annotation.id}\``,
            "",
            "**Comment**",
            "",
            comment
          ].join("\n");
        })
        .join("\n\n")
  ];
  return `${lines.join("\n")}\n`;
}
