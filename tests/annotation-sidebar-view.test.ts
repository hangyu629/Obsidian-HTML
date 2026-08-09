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
  const annotationService = {
    focus: vi.fn(async (_path: string, _id: string) => focusResult),
    load: vi.fn(async (_path: string) => annotations()),
    subscribe: vi.fn((_path: string, listener: () => void) => {
      changeListener = listener;
      return () => {
        changeListener = null;
      };
    })
  };
  const showNotice = vi.fn();
  const app = {};
  const leaf = Object.assign(Object.create(WorkspaceLeaf.prototype), { app });
  const view = new AnnotationSidebarView(leaf, {
    annotationService,
    focusAnnotation: (path, id) => annotationService.focus(path, id),
    showNotice
  });
  document.body.append(view.containerEl);
  view.onload();
  return { annotationService, change: () => changeListener?.(), showNotice, view };
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
  });
});
