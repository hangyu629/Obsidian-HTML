import type { CleanupCandidate, CleanupRule } from "../../src/cleanup/types";

export const validCandidate: CleanupCandidate = {
  selector: "aside.sidebar",
  fingerprint: {
    ancestors: [{ tag: "main", classes: ["layout"] }],
    attributes: { "aria-label": "Related content" },
    classes: ["sidebar"],
    tag: "aside",
    text: "Related articles"
  }
};
export const validRule: CleanupRule = {
  ...validCandidate,
  createdAt: "2026-08-07T12:00:00.000Z",
  id: "0123456789abcdef0123456789abcdef",
  scope: "file",
  sourcePath: "Clippings/page.html"
};
