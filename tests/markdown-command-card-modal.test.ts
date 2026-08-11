import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMAND_CARD_LANGUAGES,
  type CommandCardInput,
  type CommandCardLanguage
} from "../src/markdown/command-card";
import { InsertCommandCardModal } from "../src/markdown/command-card-modal";

function field<T extends HTMLElement>(
  modal: InsertCommandCardModal,
  name: string
): T {
  const element = modal.contentEl.querySelector<T>(
    `[data-command-card-field="${name}"]`
  );
  if (!element) throw new Error(`Missing ${name} field`);
  return element;
}

function openModal(options: {
  initialCommand?: string;
  initialLanguage?: CommandCardLanguage;
  onInsert?: (
    input: CommandCardInput & { language: CommandCardLanguage }
  ) => void;
} = {}): InsertCommandCardModal {
  const modal = new InsertCommandCardModal({} as never, {
    initialCommand: options.initialCommand ?? "git status",
    initialLanguage: options.initialLanguage ?? "bash",
    onInsert: options.onInsert ?? vi.fn()
  });
  modal.open();
  return modal;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("InsertCommandCardModal", () => {
  it("owns dialog width without overflowing the modal content", () => {
    const modal = openModal();
    const css = readFileSync("styles.css", "utf8");

    expect(modal.modalEl.classList.contains("command-card-insert-dialog")).toBe(true);
    expect(css).toMatch(
      /\.command-card-insert-dialog\s*\{[^}]*width:\s*min\(680px,\s*calc\(100vw - 32px\)\)/s
    );
    expect(css).toMatch(/\.command-card-modal\s*\{[^}]*width:\s*100%/s);
    expect(css).not.toMatch(
      /\.command-card-modal\s*\{[^}]*width:\s*min\(620px,\s*82vw\)/s
    );

    modal.close();
    expect(modal.modalEl.classList.contains("command-card-insert-dialog")).toBe(false);
  });

  it("renders structured fields with all supported languages", () => {
    const modal = openModal({
      initialCommand: "npm run check",
      initialLanguage: "typescript"
    });

    expect(modal.titleEl.textContent).toBe("Insert command card");
    expect(field<HTMLInputElement>(modal, "title")).toBeInstanceOf(HTMLInputElement);
    expect(field<HTMLTextAreaElement>(modal, "command").value).toBe("npm run check");
    expect(field<HTMLTextAreaElement>(modal, "description")).toBeInstanceOf(HTMLTextAreaElement);

    const language = field<HTMLSelectElement>(modal, "language");
    expect(language.value).toBe("typescript");
    expect(Array.from(language.options, (option) => option.value))
      .toEqual([...COMMAND_CARD_LANGUAGES]);
    expect(modal.contentEl.querySelector("[data-command-card-action=cancel]")).not.toBeNull();
    expect(modal.contentEl.querySelector("[data-command-card-action=insert]")).not.toBeNull();
  });

  it("shows exact validation messages without submitting", () => {
    const onInsert = vi.fn();
    const modal = openModal({ initialCommand: "", onInsert });
    const insert = modal.contentEl.querySelector<HTMLButtonElement>(
      "[data-command-card-action=insert]"
    );

    insert?.click();
    expect(modal.contentEl.querySelector(".command-card-modal-error")?.textContent)
      .toBe("Enter a title.");

    field<HTMLInputElement>(modal, "title").value = "Check status";
    insert?.click();
    expect(modal.contentEl.querySelector(".command-card-modal-error")?.textContent)
      .toBe("Enter a command.");
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("submits normalized values once with Cmd/Ctrl + Enter", () => {
    const onInsert = vi.fn();
    const modal = openModal({ initialCommand: "\ngit status\n", onInsert });
    field<HTMLInputElement>(modal, "title").value = "  Check\n status ";
    field<HTMLTextAreaElement>(modal, "description").value = "Working tree state.";
    field<HTMLSelectElement>(modal, "language").value = "shell";

    modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter",
      metaKey: true
    }));
    modal.contentEl.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      ctrlKey: true,
      key: "Enter"
    }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith({
      command: "git status",
      description: "Working tree state.",
      language: "shell",
      title: "Check status"
    });
  });

  it("closes on cancel or Escape without submitting", () => {
    const cancelInsert = vi.fn();
    const cancelModal = openModal({ onInsert: cancelInsert });
    cancelModal.contentEl.querySelector<HTMLButtonElement>(
      "[data-command-card-action=cancel]"
    )?.click();
    expect(cancelInsert).not.toHaveBeenCalled();
    expect(cancelModal.contentEl.isConnected).toBe(false);

    const escapeInsert = vi.fn();
    const escapeModal = openModal({ onInsert: escapeInsert });
    escapeModal.contentEl.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Escape"
    }));
    expect(escapeInsert).not.toHaveBeenCalled();
    expect(escapeModal.contentEl.isConnected).toBe(false);
  });
});
