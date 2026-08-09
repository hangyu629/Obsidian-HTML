import { WorkspaceLeaf } from "obsidian";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnnotationSidebarView,
  ANNOTATION_SIDEBAR_VIEW_TYPE
} from "../src/annotations/sidebar-view";
import type { HtmlAnnotation } from "../src/annotations/types";

function annotations(): HtmlAnnotation[] {
  return [
    {
      color: "green",
      comment: "Core conclusion",
      id: "33333333333333333333333333333333",
      quote: "Gamma",
      sourcePath: "notes/a.md",
      target: { end: 17, exact: "Gamma", prefix: "Alpha beta ", start: 11, suffix: "" }
    },
    {
      color: "blue",
      comment: "",
      id: "11111111111111111111111111111111",
      quote: "Alpha",
      sourcePath: "notes/a.md",
      target: { end: 5, exact: "Alpha", prefix: "", start: 0, suffix: " beta" }
    },
    {
      color: "yellow",
      comment: "Follow this idea",
      id: "22222222222222222222222222222222",
      quote: "beta",
      sourcePath: "notes/a.md",
      target: { end: 10, exact: "beta", prefix: "Alpha ", start: 6, suffix: " Gamma" }
    }
  ];
}

function harness(focusResult = true) {
  let changeListener: (() => void) | null = null;
  let currentAnnotations = annotations();
  const annotationService = {
    focus: vi.fn(async (_path: string, _id: string) => focusResult),
    load: vi.fn(async (_path: string) => [...currentAnnotations]),
    remove: vi.fn(async (annotation: HtmlAnnotation) => {
      currentAnnotations = currentAnnotations.filter((item) => item.id !== annotation.id);
      changeListener?.();
    }),
    save: vi.fn(async (_path: string, annotation: HtmlAnnotation) => {
      currentAnnotations = [
        ...currentAnnotations.filter((item) => item.id !== annotation.id),
        annotation
      ];
      changeListener?.();
    }),
    subscribe: vi.fn((_path: string, listener: () => void) => {
      changeListener = listener;
      return () => {
        changeListener = null;
      };
    })
  };
  const showNotice = vi.fn();
  const exportAnnotations = vi.fn(async () => undefined);
  const searchAnnotations = vi.fn();
  const copyText = vi.fn(async () => undefined);
  const app = {};
  const leaf = Object.assign(Object.create(WorkspaceLeaf.prototype), { app });
  const view = new AnnotationSidebarView(leaf, {
    annotationService,
    focusAnnotation: (path, id) => annotationService.focus(path, id),
    removeAnnotation: (annotation) => annotationService.remove(annotation),
    saveAnnotation: (path, annotation) => annotationService.save(path, annotation),
    exportAnnotations,
    searchAnnotations,
    copyText,
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();
  return {
    annotationService,
    change: () => changeListener?.(),
    exportAnnotations,
    searchAnnotations,
    copyText,
    showNotice,
    view
  };
}

function clickByText(host: HTMLElement, text: string): void {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text
  );
  expect(button).toBeDefined();
  button?.click();
}

describe("AnnotationSidebarView", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("renders annotations in document order with color and optional comments", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");

    expect(view.getViewType()).toBe(ANNOTATION_SIDEBAR_VIEW_TYPE);
    expect(view.getDisplayText()).toBe("注释");
    expect(view.contentEl.querySelector(".annotation-sidebar-count")?.textContent).toBe("3");
    const items = [...view.contentEl.querySelectorAll<HTMLElement>(
      ".annotation-sidebar-item"
    )];
    expect(items.map((item) => item.querySelector(".annotation-sidebar-quote")?.textContent))
      .toEqual(["Alpha", "beta", "Gamma"]);
    expect(items[0]?.dataset.annotationColor).toBe("blue");
    expect(items[0]?.querySelector(".annotation-sidebar-comment")).toBeNull();
    expect(items[1]?.querySelector(".annotation-sidebar-comment")?.textContent)
      .toBe("Follow this idea");
    expect(items[1]?.querySelector(".annotation-sidebar-comment-label")?.textContent)
      .toBe("批注");
    expect(items[1]?.querySelector(".annotation-sidebar-note")?.textContent)
      .toContain("Follow this idea");
    expect(items[0]?.querySelector(".annotation-sidebar-highlight-label")?.textContent)
      .toBe("仅高亮");
  });

  it("filters comment and highlight-only entries", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");

    clickByText(view.contentEl, "仅高亮");
    expect(view.contentEl.querySelectorAll(".annotation-sidebar-item")).toHaveLength(1);
    expect(view.contentEl.querySelector(".annotation-sidebar-quote")?.textContent).toBe("Alpha");

    clickByText(view.contentEl, "有批注");
    expect(view.contentEl.querySelectorAll(".annotation-sidebar-item")).toHaveLength(2);
  });

  it("toggles a compact management band and preserves it across filters", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");
    const filters = view.contentEl.querySelector<HTMLElement>(
      ".annotation-sidebar-filters"
    )!;
    const toggle = view.contentEl.querySelector<HTMLButtonElement>(
      ".annotation-sidebar-management-toggle"
    );

    expect(filters.hasAttribute("aria-label")).toBe(false);
    const filterLabelId = filters.getAttribute("aria-labelledby")!;
    expect(filters.querySelector(`#${filterLabelId}`)?.textContent).toBe("筛选注释");
    expect(toggle).not.toBeNull();
    const managementId = toggle?.getAttribute("aria-controls") ?? "";
    expect(managementId).not.toBe("");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(true);

    toggle?.click();
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(false);
    clickByText(view.contentEl, "有批注");
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(false);

    await view.setSource("notes/b.md");
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(true);
  });

  it("toggles management controls without replacing annotation entries", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");
    const entry = view.contentEl.querySelector(".annotation-sidebar-entry");
    const toggle = view.contentEl.querySelector<HTMLButtonElement>(
      ".annotation-sidebar-management-toggle"
    )!;
    expect(toggle.hasAttribute("title")).toBe(false);
    expect(toggle.hasAttribute("aria-label")).toBe(false);
    expect(toggle.classList.contains("clickable-icon")).toBe(false);
    expect(toggle.querySelector(".annotation-sidebar-sr-only")?.textContent)
      .toBe("整理注释");

    toggle.click();

    expect(view.contentEl.querySelector(".annotation-sidebar-entry")).toBe(entry);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const managementId = toggle.getAttribute("aria-controls")!;
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(false);

    toggle.click();

    expect(view.contentEl.querySelector(".annotation-sidebar-entry")).toBe(entry);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(view.contentEl.querySelector<HTMLElement>(`#${managementId}`)?.hidden)
      .toBe(true);
  });

  it("uses icon-only export and delete actions in the compact management row", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");

    const management = view.contentEl.querySelector(".annotation-sidebar-management")!;
    expect(management.children).toHaveLength(4);
    expect(management.querySelectorAll("select")).toHaveLength(2);
    const exportButton = management.querySelector<HTMLButtonElement>(
      '[aria-label="Export annotations as Markdown"]'
    )!;
    const deleteButton = management.querySelector<HTMLButtonElement>(
      '[aria-label="Delete filtered annotations"]'
    )!;
    expect(exportButton.textContent).toBe("");
    expect(deleteButton.textContent).toBe("");
    expect(exportButton.dataset.icon).toBe("file-down");
    expect(deleteButton.dataset.icon).toBe("trash-2");
  });

  it("changes sort order and confirms before deleting filtered annotations", async () => {
    const { annotationService, view } = harness();
    await view.setSource("notes/a.md");

    const sort = view.contentEl.querySelector<HTMLSelectElement>(
      '[aria-label="Annotation sort order"]'
    )!;
    sort.value = "newest";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
    expect([
      ...view.contentEl.querySelectorAll<HTMLElement>(".annotation-sidebar-item")
    ].map((item) => item.querySelector(".annotation-sidebar-quote")?.textContent)).toEqual([
      "Gamma",
      "beta",
      "Alpha"
    ]);

    clickByText(view.contentEl, "有批注");
    document.body.replaceChildren(view.containerEl);
    view.contentEl.querySelector<HTMLButtonElement>(
      ".annotation-sidebar-management-toggle"
    )?.click();
    view.contentEl.querySelector<HTMLButtonElement>('[aria-label="Delete filtered annotations"]')?.click();

    expect(annotationService.remove).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("将删除 2 条注释");
    document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Confirm deleting filtered annotations"]'
    )?.click();

    await vi.waitFor(() => {
      expect(annotationService.remove).toHaveBeenCalledTimes(2);
    });
    expect(view.contentEl.querySelectorAll(".annotation-sidebar-item")).toHaveLength(0);
    expect(view.contentEl.textContent).toContain("没有符合当前筛选条件的注释");
  });

  it("exports all annotations for the active source", async () => {
    const { exportAnnotations, view } = harness();
    await view.setSource("notes/a.md");

    const button = view.contentEl.querySelector<HTMLButtonElement>(
      '[aria-label="Export annotations as Markdown"]'
    );
    expect(button).toBeDefined();
    button?.click();

    await vi.waitFor(() => {
      expect(exportAnnotations).toHaveBeenCalledWith("notes/a.md", expect.any(Array));
    });
  });

  it("opens the Vault annotation search", () => {
    const { searchAnnotations, view } = harness();
    view.contentEl.querySelector<HTMLButtonElement>(
      '[aria-label="Search all annotations"]'
    )?.click();
    expect(searchAnnotations).toHaveBeenCalledOnce();
  });

  it("copies an annotation quote and comment", async () => {
    const { copyText, view } = harness();
    await view.setSource("notes/a.md");
    view.contentEl.querySelector<HTMLButtonElement>(
      '[data-annotation-action="copy"]'
    )?.click();
    await vi.waitFor(() => {
      expect(copyText).toHaveBeenCalledWith("Alpha");
    });
  });

  it("applies a color to the filtered annotations", async () => {
    const { annotationService, view } = harness();
    await view.setSource("notes/a.md");
    const select = view.contentEl.querySelector<HTMLSelectElement>(
      '[aria-label="Batch annotation color"]'
    )!;
    select.value = "violet";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledTimes(3);
    });
    expect(annotationService.save).toHaveBeenCalledWith(
      "notes/a.md",
      expect.objectContaining({ color: "violet" })
    );
  });

  it("focuses a clicked annotation and marks unresolved anchors", async () => {
    const { annotationService, showNotice, view } = harness(false);
    await view.setSource("notes/a.md");
    const item = view.contentEl.querySelector<HTMLButtonElement>(
      ".annotation-sidebar-item"
    )!;

    item.click();

    await vi.waitFor(() => {
      expect(annotationService.focus).toHaveBeenCalledWith(
        "notes/a.md",
        "11111111111111111111111111111111"
      );
    });
    expect(item.classList.contains("is-unresolved")).toBe(true);
    expect(showNotice).toHaveBeenCalledWith(
      "无法定位这条注释，原文可能已经发生变化。"
    );
  });

  it("omits the redundant repair action from annotation cards", async () => {
    const { view } = harness();
    await view.setSource("notes/a.md");

    const actions = [...view.contentEl.querySelectorAll<HTMLElement>(
      "[data-annotation-action]"
    )].map((element) => element.dataset.annotationAction);
    expect(actions).not.toContain("repair");
    expect(new Set(actions)).toEqual(new Set(["copy", "delete", "edit"]));
  });

  it("edits and deletes annotations from the sidebar without breaking focus navigation", async () => {
    const { annotationService, view } = harness();
    await view.setSource("notes/a.md");

    const editButton = view.contentEl.querySelector<HTMLButtonElement>(
      '[data-annotation-action="edit"]'
    )!;
    editButton.click();

    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      '[aria-label="Annotation comment"]'
    )!;
    const pink = document.body.querySelector<HTMLButtonElement>(
      '[data-annotation-color-choice="pink"]'
    )!;
    textarea.value = "Updated from sidebar";
    pink.click();
    document.body.querySelector<HTMLButtonElement>('[aria-label="Save annotation"]')?.click();

    await vi.waitFor(() => {
      expect(annotationService.save).toHaveBeenCalledWith(
        "notes/a.md",
        expect.objectContaining({
          color: "pink",
          comment: "Updated from sidebar",
          id: "11111111111111111111111111111111"
        })
      );
    });

    document.body.querySelector<HTMLButtonElement>('[data-annotation-action="delete"]')?.click();
    await vi.waitFor(() => {
      expect(annotationService.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: "11111111111111111111111111111111" })
      );
    });
    expect(annotationService.focus).not.toHaveBeenCalled();
  });

  it("shows clear empty states for no source and no annotations", async () => {
    const { annotationService, view } = harness();
    expect(view.contentEl.textContent).toContain("打开 HTML 或 Markdown 文件以查看注释");
    annotationService.load.mockResolvedValueOnce([]);

    await view.setSource("notes/empty.md");

    expect(view.contentEl.textContent).toContain("当前文件还没有注释");
  });

  it("uses a compact unframed sidebar with all five color markers", () => {
    const css = readFileSync("styles.css", "utf8");

    expect(css).toContain(".annotation-sidebar-list");
    expect(css).toContain(".annotation-sidebar-item");
    expect(css).toContain('.annotation-sidebar-item[data-annotation-color="yellow"]');
    expect(css).toContain('.annotation-sidebar-item[data-annotation-color="green"]');
    expect(css).toContain('.annotation-sidebar-item[data-annotation-color="blue"]');
    expect(css).toContain('.annotation-sidebar-item[data-annotation-color="pink"]');
    expect(css).toContain('.annotation-sidebar-item[data-annotation-color="violet"]');
    expect(css).toContain(".annotation-sidebar-item.is-unresolved");
    expect(css).toContain(".annotation-sidebar-management[hidden]");
    expect(css).toMatch(
      /\.annotation-sidebar-management\[hidden\]\s*\{[^}]*display:\s*none;/
    );
    expect(css).toContain("white-space: normal");
  });

  it("aligns sidebar sections as a compact toolbar and lightweight list", () => {
    const css = readFileSync("styles.css", "utf8");

    expect(css).not.toMatch(/\.annotation-sidebar\s*\{[^}]*container-type:/);
    expect(css).not.toContain("@container");
    expect(css).toMatch(
      /\.annotation-sidebar\s*\{[^}]*--annotation-sidebar-gutter:\s*12px;/
    );
    expect(css.match(/padding-inline:\s*var\(--annotation-sidebar-gutter\);/g))
      .toHaveLength(3);
    expect(css).toMatch(
      /\.annotation-sidebar-management\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 30px 30px;[^}]*margin-inline:\s*var\(--annotation-sidebar-gutter\);[^}]*padding-inline:\s*0;/
    );
    expect(css).toMatch(
      /\.annotation-sidebar-entry\s*\{[^}]*position:\s*relative;[^}]*border-bottom:\s*1px solid var\(--background-modifier-border\);/
    );
    expect(css).toMatch(
      /\.annotation-sidebar-actions\s*\{[^}]*position:\s*absolute;[^}]*top:\s*8px;[^}]*right:\s*0;/
    );
  });
});
