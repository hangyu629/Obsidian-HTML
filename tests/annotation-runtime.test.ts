import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOTATION_FOCUS_MESSAGE_TYPE,
  ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE,
  ANNOTATION_RESULT_MESSAGE_TYPE,
  ANNOTATION_SAVE_MESSAGE_TYPE,
  createAnnotationRuntimeScript
} from "../src/annotations/runtime";

function selectText(node: Text, start: number, end: number): void {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function clickByText(text: string): void {
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text
  );
  expect(button).toBeDefined();
  button?.click();
}

describe("annotation runtime", () => {
  beforeEach(() => {
    document.documentElement.innerHTML =
      "<head></head><body><p>Alpha beta gamma</p></body>";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.getSelection()?.removeAllRanges();
  });

  it("creates, edits, and focuses annotations through the contextual runtime", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    const text = document.querySelector("p")?.firstChild;
    expect(text).toBeInstanceOf(Text);
    window.eval(createAnnotationRuntimeScript("render-test", []));

    selectText(text as Text, 0, 10);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(document.querySelector('[role="toolbar"]')?.textContent).toContain("颜色");
    expect(document.querySelector('[role="toolbar"]')?.textContent).toContain("注释");
    clickByText("颜色");
    document.querySelector<HTMLButtonElement>('[aria-label="绿色"]')?.click();

    const saveCall = postMessage.mock.calls.find(
      ([message]) => message.type === ANNOTATION_SAVE_MESSAGE_TYPE
    );
    expect(saveCall?.[0]).toEqual(
      expect.objectContaining({
        annotation: expect.objectContaining({
          color: "green",
          comment: "",
          quote: "Alpha beta"
        }),
        renderId: "render-test",
        requestId: expect.any(String),
        type: ANNOTATION_SAVE_MESSAGE_TYPE
      })
    );

    const requestId = saveCall?.[0].requestId as string;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotation: {
            ...saveCall?.[0].annotation,
            id: "11111111111111111111111111111111",
            sourcePath: "pages/index.html"
          },
          ok: true,
          renderId: "render-test",
          requestId,
          type: ANNOTATION_RESULT_MESSAGE_TYPE
        },
        source: window.parent
      })
    );

    const mark = document.querySelector<HTMLElement>(
      'mark[data-obsidian-html-preview-annotation="11111111111111111111111111111111"]'
    );
    expect(mark?.dataset.annotationColor).toBe("green");
    mark?.click();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");

    mark!.scrollIntoView = vi.fn();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          annotationId: "11111111111111111111111111111111",
          renderId: "render-test",
          requestId: "focus-1",
          type: ANNOTATION_FOCUS_MESSAGE_TYPE
        },
        source: window.parent
      })
    );
    expect(mark?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center"
    });
    expect(postMessage).toHaveBeenCalledWith(
      {
        found: true,
        renderId: "render-test",
        requestId: "focus-1",
        type: ANNOTATION_FOCUS_RESULT_MESSAGE_TYPE
      },
      "*"
    );
  });
});
