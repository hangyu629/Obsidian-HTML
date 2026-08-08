import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnnotationContextualUi,
  type AnnotationDraft
} from "../src/annotations/contextual-ui";
import {
  annotationFromMark,
  applyAnnotationHighlights,
  focusAnnotationMark
} from "../src/annotations/dom";
import type { HtmlAnnotation } from "../src/annotations/types";

const target = {
  end: 10,
  exact: "Alpha beta",
  prefix: "",
  start: 0,
  suffix: " gamma"
};

function annotation(overrides: Partial<HtmlAnnotation> = {}): HtmlAnnotation {
  return {
    color: "green",
    comment: "Existing note",
    id: "11111111111111111111111111111111",
    quote: "Alpha beta",
    sourcePath: "notes/a.md",
    target,
    ...overrides
  };
}

function harness(onSave = vi.fn(async (_draft: AnnotationDraft) => true)) {
  const host = document.createElement("div");
  document.body.append(host);
  const onDelete = vi.fn(async () => true);
  const ui = new AnnotationContextualUi(host, { onDelete, onSave });
  return { host, onDelete, onSave, ui };
}

function clickByText(host: HTMLElement, text: string): void {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text
  );
  expect(button).toBeDefined();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("AnnotationContextualUi", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("shows color and annotation choices for a captured selection", () => {
    const { host, ui } = harness();

    ui.showSelection({ quote: "Alpha beta", target }, new DOMRect(80, 40, 120, 20));

    const toolbar = host.querySelector('[role="toolbar"]');
    expect(toolbar?.textContent).toContain("颜色");
    expect(toolbar?.textContent).toContain("注释");
  });

  it("saves a color choice as a highlight-only annotation", async () => {
    const { host, onSave, ui } = harness();
    ui.showSelection({ quote: "Alpha beta", target }, new DOMRect(80, 40, 120, 20));

    clickByText(host, "颜色");
    const green = host.querySelector<HTMLButtonElement>('[aria-label="绿色"]');
    green?.click();
    await vi.waitFor(() => {
      expect(host.querySelector('[role="toolbar"]')).toBeNull();
    });

    expect(onSave).toHaveBeenCalledWith({
      color: "green",
      comment: "",
      quote: "Alpha beta",
      target
    });
  });

  it("opens the nearby editor for a comment and saves with the keyboard", async () => {
    const { host, onSave, ui } = harness();
    ui.showSelection({ quote: "Alpha beta", target }, new DOMRect(80, 40, 120, 20));

    clickByText(host, "注释");
    const editor = host.querySelector<HTMLElement>('[role="dialog"]');
    const textarea = editor?.querySelector<HTMLTextAreaElement>("textarea");
    expect(document.activeElement).toBe(textarea);
    expect(editor?.textContent).toContain("仅高亮");
    textarea!.value = "New thought";
    textarea?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter", metaKey: true })
    );
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith({
      color: "yellow",
      comment: "New thought",
      quote: "Alpha beta",
      target
    });
  });

  it("edits and deletes an existing annotation without changing its id", async () => {
    const { host, onDelete, onSave, ui } = harness();
    const existing = annotation();
    ui.showAnnotation(existing, new DOMRect(80, 40, 120, 20));
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Updated note";

    clickByText(host, "保存修改");
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledWith({
      color: "green",
      comment: "Updated note",
      id: existing.id,
      quote: existing.quote,
      target: existing.target
    });

    ui.showAnnotation(existing, new DOMRect(80, 40, 120, 20));
    clickByText(host, "删除高亮");
    await Promise.resolve();
    expect(onDelete).toHaveBeenCalledWith(existing);
  });

  it("keeps the editor and comment when persistence fails", async () => {
    const onSave = vi.fn(async () => false);
    const { host, ui } = harness(onSave);
    ui.showSelection({ quote: "Alpha beta", target }, new DOMRect(80, 40, 120, 20));
    clickByText(host, "注释");
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea")!;
    textarea.value = "Do not lose this";

    clickByText(host, "保存批注");
    await Promise.resolve();

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Do not lose this"
    );
  });

  it("destroys contextual surfaces and listeners", () => {
    const { host, ui } = harness();
    ui.showSelection({ quote: "Alpha beta", target }, new DOMRect(80, 40, 120, 20));

    ui.destroy();

    expect(host.querySelector(".annotation-contextual-surface")).toBeNull();
  });
});

describe("annotation mark helpers", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("renders the annotation color and resolves a clicked mark", () => {
    const root = document.createElement("div");
    root.textContent = "Alpha beta gamma";
    document.body.append(root);
    const current = annotation();

    applyAnnotationHighlights(root, [current]);

    const mark = root.querySelector("mark")!;
    expect(mark.dataset.annotationColor).toBe("green");
    expect(annotationFromMark(root, mark.firstChild)).toBe(current.id);
  });

  it("focuses a matching mark and reports missing ids", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.textContent = "Alpha beta gamma";
    document.body.append(root);
    applyAnnotationHighlights(root, [annotation()]);
    const mark = root.querySelector("mark") as HTMLElement;
    mark.scrollIntoView = vi.fn();

    expect(focusAnnotationMark(root, annotation().id)).toBe(true);
    expect(mark.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center"
    });
    expect(mark.classList.contains("is-annotation-focus")).toBe(true);
    vi.advanceTimersByTime(1_200);
    expect(mark.classList.contains("is-annotation-focus")).toBe(false);
    expect(focusAnnotationMark(root, "missing")).toBe(false);
  });
});
