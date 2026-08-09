import { describe, expect, it, vi } from "vitest";

import { ReaderPageConfirmationModal } from "../src/reader/page-confirmation-modal";

function deferred(): {
  promise: Promise<void>;
  reject(error: unknown): void;
  resolve(): void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

describe("ReaderPageConfirmationModal", () => {
  it("renders the save variant and confirms asynchronously", async () => {
    const pending = deferred();
    const onConfirm = vi.fn(() => pending.promise);
    const onError = vi.fn();
    const modal = new ReaderPageConfirmationModal({} as never, {
      mode: "save",
      onConfirm,
      onError,
      sourcePath: "Clippings/page.html"
    });

    modal.open();
    expect(modal.titleEl.textContent).toBe("Save reading page");
    expect(modal.contentEl.textContent).toContain("Clippings/page.html");
    expect(modal.contentEl.textContent).toContain("hidden backup");
    const cancel = modal.contentEl.querySelector<HTMLButtonElement>("[data-reader-cancel]");
    const confirm = modal.contentEl.querySelector<HTMLButtonElement>("[data-reader-confirm]");
    expect(confirm?.dataset.icon).toBeUndefined();

    confirm?.click();
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(cancel?.disabled).toBe(true);
    expect(confirm?.disabled).toBe(true);
    expect(confirm?.textContent).toBe("Saving...");

    pending.resolve();
    await Promise.resolve();
    expect(document.body.contains(modal.contentEl)).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders the restore variant and recovers controls after failure", async () => {
    const onError = vi.fn();
    const modal = new ReaderPageConfirmationModal({} as never, {
      mode: "restore",
      onConfirm: async () => {
        throw new Error("restore failed");
      },
      onError,
      sourcePath: "Clippings/page.html"
    });

    modal.open();
    expect(modal.titleEl.textContent).toBe("Restore original page");
    expect(modal.contentEl.textContent).toContain("replace the current HTML");
    expect(modal.contentEl.querySelector<HTMLElement>("[data-icon]")?.dataset.icon).toBe(
      "history"
    );

    const confirm = modal.contentEl.querySelector<HTMLButtonElement>("[data-reader-confirm]");
    const cancel = modal.contentEl.querySelector<HTMLButtonElement>("[data-reader-cancel]");
    confirm?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(cancel?.disabled).toBe(false);
    expect(confirm?.disabled).toBe(false);
    expect(confirm?.textContent).toBe("Restore original");
    modal.close();
  });
});
