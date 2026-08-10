import { Component } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mountCommandLibrary } from "../src/markdown/command-library";

function commandCallout(title: string, command?: string, description = "Description"): string {
  return `
    <div class="callout" data-callout="command">
      <div class="callout-title"><div class="callout-title-inner">${title}</div></div>
      <div class="callout-content">
        ${command === undefined ? "" : `<pre><code class="language-bash">${command}</code></pre>`}
        <p>${description}</p>
      </div>
    </div>`;
}

function createRoot(content: string): HTMLElement {
  const root = document.createElement("article");
  root.innerHTML = `
    <header><input data-command-library-search><p data-command-library-empty hidden>No results</p></header>
    <aside data-command-library-categories></aside>
    <section data-command-library-introduction></section>
    <main data-slot="content">${content}</main>`;
  return root;
}

function mount(root: HTMLElement, options: {
  copyText?: (text: string) => Promise<void>;
  showNotice?: (message: string) => void;
} = {}) {
  const component = new Component();
  const copyText = options.copyText ?? vi.fn(async () => undefined);
  const showNotice = options.showNotice ?? vi.fn();
  const result = mountCommandLibrary({
    component,
    copyText,
    root,
    showNotice
  });
  return { component, copyText, result, showNotice };
}

describe("mountCommandLibrary", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("groups valid command callouts by second-level heading", () => {
    const root = createRoot(`
      <p>Quick commands for daily work.</p>
      <h2>Git</h2>
      ${commandCallout("Undo commit", "git reset --soft HEAD~1")}
      <div class="callout" data-callout="note"><p>Keep backups.</p></div>
      <h2>Docker</h2>
      ${commandCallout("Follow logs", "docker compose logs -f api")}
    `);

    const { result } = mount(root);

    expect(result).toEqual({ categoryCount: 2, commandCount: 2 });
    expect(root.querySelectorAll(".command-library-category")).toHaveLength(2);
    expect(root.querySelectorAll(".command-library-card")).toHaveLength(2);
    expect(root.querySelector('[data-command-library-introduction]')?.textContent)
      .toContain("Quick commands for daily work.");
    expect(root.querySelector('.callout[data-callout="note"]')?.classList.contains("command-library-card"))
      .toBe(false);
    expect([...root.querySelectorAll(".command-library-category-button")].map((item) => item.textContent))
      .toEqual(["Git1", "Docker1"]);
  });

  it("uses unique category targets for duplicate headings", () => {
    const root = createRoot(`
      <h2>Git</h2>${commandCallout("Status", "git status")}
      <h2>Git</h2>${commandCallout("Log", "git log --oneline")}
    `);

    mount(root);

    const targets = [...root.querySelectorAll<HTMLElement>(".command-library-category")]
      .map((section) => section.id);
    expect(targets).toEqual(["command-category-git", "command-category-git-2"]);
  });

  it("leaves command callouts without a code block unchanged", () => {
    const root = createRoot(`<h2>Git</h2>${commandCallout("Missing command")}`);

    const { result } = mount(root);

    expect(result).toEqual({ categoryCount: 0, commandCount: 0 });
    expect(root.querySelector('.callout[data-callout="command"]')?.classList.contains("command-library-card"))
      .toBe(false);
  });

  it("creates a Commands category when headings are absent", () => {
    const root = createRoot(commandCallout("List files", "ls -la"));

    const { result } = mount(root);

    expect(result).toEqual({ categoryCount: 1, commandCount: 1 });
    expect(root.querySelector(".command-library-category-button")?.textContent).toBe("Commands1");
    expect(root.querySelector(".command-library-category")?.id).toBe("command-category-commands");
  });

  it("filters cards and empty categories by title, command, description, and category", () => {
    const root = createRoot(`
      <h2>Git</h2>${commandCallout("Undo commit", "git reset --soft HEAD~1", "Keep staged work.")}
      <h2>Docker</h2>${commandCallout("Follow logs", "docker compose logs -f api", "Watch the API service.")}
    `);
    const { result } = mount(root);
    expect(result.commandCount).toBe(2);

    const search = root.querySelector<HTMLInputElement>("[data-command-library-search]")!;
    search.value = "api service";
    search.dispatchEvent(new Event("input"));

    const cards = [...root.querySelectorAll<HTMLElement>(".command-library-card")];
    expect(cards.map((card) => card.hidden)).toEqual([true, false]);
    expect([...root.querySelectorAll<HTMLElement>(".command-library-category")].map((item) => item.hidden))
      .toEqual([true, false]);
    expect(root.querySelector<HTMLElement>("[data-command-library-empty]")?.hidden).toBe(true);

    search.value = "not present";
    search.dispatchEvent(new Event("input"));
    expect(root.querySelector<HTMLElement>("[data-command-library-empty]")?.hidden).toBe(false);
  });

  it("supports search keyboard controls and category navigation", () => {
    const root = createRoot(`<h2>Git</h2>${commandCallout("Status", "git status")}`);
    document.body.append(root);
    mount(root);
    const search = root.querySelector<HTMLInputElement>("[data-command-library-search]")!;
    const section = root.querySelector<HTMLElement>(".command-library-category")!;
    section.scrollIntoView = vi.fn();

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(document.activeElement).toBe(search);
    search.value = "status";
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(search.value).toBe("");

    root.querySelector<HTMLButtonElement>(".command-library-category-button")!.click();
    expect(section.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("copies the exact multiline command and reports clipboard failures", async () => {
    const root = createRoot(`<h2>Git</h2>${commandCallout("Sync", "git fetch origin\ngit rebase origin/main")}`);
    const copyText = vi.fn(async () => undefined);
    const { showNotice } = mount(root, { copyText });

    const copy = root.querySelector<HTMLButtonElement>(".command-library-copy")!;
    expect(copy.dataset.icon).toBe("copy");
    copy.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(copyText).toHaveBeenCalledWith("git fetch origin\ngit rebase origin/main");
    expect(showNotice).not.toHaveBeenCalled();

    const failedRoot = createRoot(`<h2>Git</h2>${commandCallout("Sync", "git fetch origin")}`);
    const failedNotice = vi.fn();
    mount(failedRoot, {
      copyText: async () => { throw new Error("denied"); },
      showNotice: failedNotice
    });
    failedRoot.querySelector<HTMLButtonElement>(".command-library-copy")!.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(failedNotice).toHaveBeenCalledWith("Unable to copy command.");
  });

  it("removes command-library handlers when the render component unloads", async () => {
    const root = createRoot(`<h2>Git</h2>${commandCallout("Status", "git status")}`);
    const copyText = vi.fn(async () => undefined);
    const { component } = mount(root, { copyText });
    const copy = root.querySelector<HTMLButtonElement>(".command-library-copy")!;

    component.unload();
    copy.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(copyText).not.toHaveBeenCalled();
  });
});
