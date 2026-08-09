import { describe, expect, it, vi } from "vitest";

import { MarkdownTemplateModal } from "../src/markdown/template-modal";

describe("MarkdownTemplateModal", () => {
  it("lists templates and returns the selected theme", async () => {
    const onSelect = vi.fn();
    const modal = new MarkdownTemplateModal({} as never, {
      list: vi.fn(async () => [
        {
          defaultTheme: "light",
          description: "Book-like single-column reading with a paper editorial cover.",
          id: "book-editorial",
          name: "Book Editorial",
          themeIds: ["light", "dark"],
          themeNames: { light: "Light paper", dark: "Dark forest" }
        }
      ]),
      onSelect,
      selected: { source: "folder", templateId: "book-editorial", themeId: "dark" }
    });

    modal.open();
    await Promise.resolve();
    expect(modal.contentEl.querySelector(".enhanced-markdown-template-card")).not.toBeNull();
    expect(modal.contentEl.textContent).toContain("Book-like single-column reading");
    expect(modal.contentEl.textContent).toContain("Dark forest");
    expect(modal.contentEl.textContent).toContain("当前：Book Editorial / Dark forest（文件夹规则）");
    await Promise.resolve();
    const button = modal.contentEl.querySelector("button[data-template-id=book-editorial][data-theme-id=dark]");
    expect(button).not.toBeNull();
    (button as HTMLButtonElement | null)?.click();
    expect(onSelect).toHaveBeenCalledWith({ templateId: "book-editorial", themeId: "dark" });
  });
});
