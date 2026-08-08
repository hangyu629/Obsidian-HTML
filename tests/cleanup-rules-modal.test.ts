import { describe, expect, it, vi } from "vitest";

import { CleanupRulesModal } from "../src/cleanup/rules-modal";
import type { CleanupRule } from "../src/cleanup/types";
import { validRule } from "./fixtures/cleanup-rules";

const folderRule: CleanupRule = {
  ...validRule,
  id: "abcdefabcdefabcdefabcdefabcdefab",
  scope: "folder",
  sourcePath: "Clippings"
};

function createModal(rules: readonly CleanupRule[] = [validRule, folderRule]) {
  const onError = vi.fn();
  const onPromote = vi.fn(async () => undefined);
  const onReset = vi.fn(async () => undefined);
  const onRestore = vi.fn(async () => undefined);
  const modal = new CleanupRulesModal({} as never, {
    onError,
    onPromote,
    onReset,
    onRestore,
    rules,
    sourcePath: "Clippings/page.html",
    unmatchedRuleIds: new Set([folderRule.id])
  });
  modal.onOpen();
  return { modal, onError, onPromote, onReset, onRestore };
}

async function click(element: Element | null): Promise<void> {
  expect(element).not.toBeNull();
  element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

describe("CleanupRulesModal", () => {
  it("lists effective file and folder rules with unmatched status", () => {
    const { modal } = createModal();

    expect(modal.titleEl.textContent).toBe("Cleanup rules");
    expect(modal.contentEl.querySelectorAll(".html-preview-cleanup-rule")).toHaveLength(
      2
    );
    expect(modal.contentEl.textContent).toContain(validRule.selector);
    expect(modal.contentEl.textContent).toContain("File");
    expect(modal.contentEl.textContent).toContain("Folder");
    expect(modal.contentEl.textContent).toContain("Not matched on this page");
  });

  it("restores an individual rule", async () => {
    const { modal, onRestore } = createModal();

    await click(
      modal.contentEl.querySelector(
        `[data-cleanup-action="restore"][data-rule-id="${validRule.id}"]`
      )
    );

    expect(onRestore).toHaveBeenCalledWith(validRule);
  });

  it("offers folder promotion only for a current-file rule", async () => {
    const { modal, onPromote } = createModal();

    expect(
      modal.contentEl.querySelector(
        `[data-cleanup-action="promote"][data-rule-id="${folderRule.id}"]`
      )
    ).toBeNull();
    await click(
      modal.contentEl.querySelector(
        `[data-cleanup-action="promote"][data-rule-id="${validRule.id}"]`
      )
    );

    expect(onPromote).toHaveBeenCalledWith(validRule);
  });

  it("resets file rules without removing folder rules", async () => {
    const { modal, onReset } = createModal();

    await click(
      modal.contentEl.querySelector('[data-cleanup-action="reset-file"]')
    );

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("reports failed manager operations", async () => {
    const { modal, onError, onRestore } = createModal();
    onRestore.mockRejectedValueOnce(new Error("disk full"));

    await click(
      modal.contentEl.querySelector(
        `[data-cleanup-action="restore"][data-rule-id="${validRule.id}"]`
      )
    );

    expect(onError).toHaveBeenCalledWith("disk full");
  });
});
