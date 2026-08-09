import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnnotationSearchModal } from "../src/annotations/search-modal";
import type { HtmlAnnotation } from "../src/annotations/types";

const annotation: HtmlAnnotation = {
  color: "pink",
  comment: "Worth revisiting",
  id: "a1",
  quote: "A useful excerpt",
  sourcePath: "Books/Ads/one.html",
  target: { end: 16, exact: "A useful excerpt", prefix: "", start: 0, suffix: "" }
};

describe("AnnotationSearchModal", () => {
  beforeEach(() => document.body.replaceChildren());

  it("filters results and opens a selected annotation", async () => {
    const search = vi.fn(async () => [annotation]);
    const open = vi.fn(async () => true);
    const modal = new AnnotationSearchModal({} as never, { open, search });
    modal.open();

    await vi.waitFor(() => {
      expect(modal.contentEl.textContent).toContain("A useful excerpt");
    });
    const input = modal.contentEl.querySelector<HTMLInputElement>(
      '[aria-label="Search annotations"]'
    )!;
    input.value = "revisit";
    input.dispatchEvent(new Event("input"));
    await vi.waitFor(() => {
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: "revisit" }));
    });
    modal.contentEl.querySelector<HTMLButtonElement>(".annotation-search-result")?.click();
    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledWith(annotation.sourcePath, annotation.id);
    });
  });
});
