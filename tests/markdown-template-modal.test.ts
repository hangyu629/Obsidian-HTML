import { describe, expect, it, vi } from "vitest";

import { MarkdownTemplateModal } from "../src/markdown/template-modal";

describe("MarkdownTemplateModal", () => {
  it("lists templates and returns the selected theme", async () => {
    const onSelect = vi.fn();
    const modal = new MarkdownTemplateModal({} as never, {
      list: vi.fn(async () => [
        { defaultTheme: "light", id: "book-editorial", name: "Book Editorial", themeIds: ["light", "dark"] }
      ]),
      onSelect
    });

    modal.open();
    await Promise.resolve();
    await Promise.resolve();
    const button = modal.contentEl.querySelector("button[data-template-id=book-editorial][data-theme-id=dark]");
    expect(button).not.toBeNull();
    (button as HTMLButtonElement | null)?.click();
    expect(onSelect).toHaveBeenCalledWith({ templateId: "book-editorial", themeId: "dark" });
  });
});
