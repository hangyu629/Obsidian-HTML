import { setIcon, type Component } from "obsidian";

export interface MountCommandLibraryInput {
  component: Component;
  copyText(text: string): Promise<void>;
  root: HTMLElement;
  showNotice(message: string): void;
}

export interface CommandLibraryResult {
  categoryCount: number;
  commandCount: number;
}

interface CategoryGroup {
  heading: HTMLHeadingElement | null;
  nodes: HTMLElement[];
}

function commandCallouts(nodes: readonly HTMLElement[]): HTMLElement[] {
  const callouts: HTMLElement[] = [];
  for (const node of nodes) {
    if (node.matches('.callout[data-callout="command"]')) {
      callouts.push(node);
    }
    callouts.push(...node.querySelectorAll<HTMLElement>('.callout[data-callout="command"]'));
  }
  return callouts.filter((callout) => callout.querySelector("pre > code"));
}

function categorySlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "commands";
}

function groupContent(content: HTMLElement): CategoryGroup[] {
  const groups: CategoryGroup[] = [{ heading: null, nodes: [] }];
  for (const node of [...content.children]) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === "H2") {
      groups.push({ heading: node as HTMLHeadingElement, nodes: [node] });
    } else {
      const current = groups.at(-1);
      if (current) current.nodes.push(node);
    }
  }
  return groups;
}

function enhanceCallout(callout: HTMLElement, categoryName: string): void {
  const code = callout.querySelector<HTMLElement>("pre > code");
  if (!code) return;
  callout.classList.add("command-library-card");
  callout.dataset.commandCategory = categoryName;
  const title = callout.querySelector<HTMLElement>(".callout-title");
  if (!title || title.querySelector(".command-library-copy")) return;

  const language = code.className.match(/(?:^|\s)language-([^\s]+)/)?.[1];
  if (language) {
    const languageLabel = document.createElement("span");
    languageLabel.className = "command-library-language";
    languageLabel.textContent = language;
    title.append(languageLabel);
  }
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "command-library-copy";
  copy.dataset.commandText = code.textContent ?? "";
  copy.setAttribute("aria-label", "Copy command");
  setIcon(copy, "copy");
  title.append(copy);
}

function setActiveCategory(categories: HTMLElement, targetId: string): void {
  for (const button of categories.querySelectorAll<HTMLElement>(".command-library-category-button")) {
    button.dataset.active = String(button.dataset.categoryTarget === targetId);
  }
}

function categoryButtonFor(root: HTMLElement, targetId: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(".command-library-category-button")]
    .find((button) => button.dataset.categoryTarget === targetId);
}

function categoryFor(root: HTMLElement, targetId: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(".command-library-category")]
    .find((section) => section.id === targetId);
}

function filterCards(
  root: HTMLElement,
  query: string
): void {
  const normalized = query.trim().toLocaleLowerCase();
  let visibleCount = 0;
  for (const section of root.querySelectorAll<HTMLElement>(".command-library-category")) {
    let sectionVisible = false;
    for (const card of section.querySelectorAll<HTMLElement>(".command-library-card")) {
      const haystack = `${card.dataset.commandCategory ?? ""} ${card.textContent ?? ""}`.toLocaleLowerCase();
      card.hidden = normalized.length > 0 && !haystack.includes(normalized);
      sectionVisible ||= !card.hidden;
      if (!card.hidden) visibleCount += 1;
    }
    section.hidden = normalized.length > 0 && !sectionVisible;
    const button = categoryButtonFor(root, section.id);
    if (button) button.hidden = section.hidden;
  }
  const empty = root.querySelector<HTMLElement>("[data-command-library-empty]");
  if (empty) empty.hidden = visibleCount > 0;
}

export function mountCommandLibrary(input: MountCommandLibraryInput): CommandLibraryResult {
  const content = input.root.querySelector<HTMLElement>('[data-slot="content"]');
  const categories = input.root.querySelector<HTMLElement>("[data-command-library-categories]");
  const introduction = input.root.querySelector<HTMLElement>("[data-command-library-introduction]");
  const empty = input.root.querySelector<HTMLElement>("[data-command-library-empty]");
  if (!content || !categories) {
    return { categoryCount: 0, commandCount: 0 };
  }

  categories.replaceChildren();
  const groups = groupContent(content);
  const introductionGroup = groups[0];
  const hasHeadings = groups.some((group) => group.heading);
  if (hasHeadings && introduction && introductionGroup) {
    introduction.replaceChildren(...introductionGroup.nodes);
  }

  const candidates = hasHeadings
    ? groups.filter((group) => group.heading)
    : [{ heading: null, nodes: introductionGroup?.nodes ?? [] }];
  const idCounts = new Map<string, number>();
  let commandCount = 0;
  let categoryCount = 0;

  for (const group of candidates) {
    const callouts = commandCallouts(group.nodes);
    if (callouts.length === 0) continue;
    const name = group.heading?.textContent?.trim() || "Commands";
    const slug = categorySlug(name);
    const occurrence = (idCounts.get(slug) ?? 0) + 1;
    idCounts.set(slug, occurrence);
    const section = document.createElement("section");
    section.className = "command-library-category";
    section.id = `command-category-${slug}${occurrence === 1 ? "" : `-${occurrence}`}`;
    const first = group.nodes[0];
    first?.before(section);
    section.append(...group.nodes);
    for (const callout of callouts) enhanceCallout(callout, name);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-library-category-button";
    button.dataset.categoryTarget = section.id;
    const label = document.createElement("span");
    label.textContent = name;
    const count = document.createElement("span");
    count.className = "command-library-category-count";
    count.textContent = String(callouts.length);
    button.append(label, count);
    categories.append(button);
    categoryCount += 1;
    commandCount += callouts.length;
  }

  if (empty) empty.hidden = commandCount > 0;
  const search = input.root.querySelector<HTMLInputElement>("[data-command-library-search]");
  if (search) {
    input.component.registerDomEvent(search, "input", () => {
      filterCards(input.root, search.value);
    });
  }
  input.component.registerDomEvent(input.root, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "/" &&
      search &&
      document.activeElement !== search &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      search.focus();
    } else if (event.key === "Escape" && search && search.value) {
      search.value = "";
      filterCards(input.root, "");
    }
  });
  input.component.registerDomEvent(categories, "click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>(".command-library-category-button");
    if (!button) return;
    const targetId = button.dataset.categoryTarget;
    const target = targetId ? categoryFor(input.root, targetId) : null;
    if (!target) return;
    setActiveCategory(categories, target.id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  input.component.registerDomEvent(content, "click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>(".command-library-copy");
    if (!button) return;
    const command = button.dataset.commandText ?? "";
    void input.copyText(command).then(() => {
      button.dataset.copyState = "copied";
      button.setAttribute("aria-label", "Command copied");
      setIcon(button, "check");
      const timeout = window.setTimeout(() => {
        delete button.dataset.copyState;
        button.setAttribute("aria-label", "Copy command");
        setIcon(button, "copy");
      }, 1200);
      input.component.register(() => window.clearTimeout(timeout));
    }).catch(() => {
      input.showNotice("Unable to copy command.");
    });
  });
  const firstButton = categories.querySelector<HTMLElement>(".command-library-category-button");
  if (firstButton?.dataset.categoryTarget) {
    setActiveCategory(categories, firstButton.dataset.categoryTarget);
  }
  return { categoryCount, commandCount };
}
