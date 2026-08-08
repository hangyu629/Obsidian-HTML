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
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea?.value).toBe("");
    const pointer = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    textarea?.dispatchEvent(pointer);
    expect(pointer.defaultPrevented).toBe(false);

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

  it("uses visible text offsets and restores legacy offsets before another selection", () => {
    const page = `<!doctype html><html><head></head><body><script>/* ${"metadata ".repeat(40)} */</script><style>/* ${"ignored ".repeat(20)} */</style><p>Alpha beta gamma</p><p>${"Later body text. ".repeat(40)}</p></body></html>`;
    const firstFrame = document.body.appendChild(document.createElement("iframe"));
    const firstWindow = firstFrame.contentWindow as Window & typeof globalThis;
    firstWindow.document.open();
    firstWindow.document.write(page);
    firstWindow.document.close();
    const firstPostMessage = vi.spyOn(firstWindow.parent, "postMessage");
    firstWindow.eval(createAnnotationRuntimeScript("render-first", []));
    const firstText = firstWindow.document.querySelector("p")?.firstChild;
    expect(firstText).toBeInstanceOf(firstWindow.Text);

    const firstRange = firstWindow.document.createRange();
    firstRange.setStart(firstText as Text, 0);
    firstRange.setEnd(firstText as Text, 10);
    firstWindow.getSelection()?.addRange(firstRange);
    firstWindow.document.dispatchEvent(
      new firstWindow.MouseEvent("mouseup", { bubbles: true })
    );
    const colorButton = [...firstWindow.document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "颜色"
    );
    colorButton?.click();
    firstWindow.document.querySelector<HTMLButtonElement>(
      '[aria-label="绿色"]'
    )?.click();

    const saveMessage = firstPostMessage.mock.calls.find(
      ([message]) => message.type === ANNOTATION_SAVE_MESSAGE_TYPE
    )?.[0];
    expect(saveMessage?.annotation.target).toEqual(
      expect.objectContaining({ start: 0, end: 10 })
    );

    const legacyAnnotation = {
      ...saveMessage.annotation,
      id: "11111111111111111111111111111111",
      sourcePath: "pages/index.html",
      target: {
        ...saveMessage.annotation.target,
        end: saveMessage.annotation.target.end + 500,
        start: saveMessage.annotation.target.start + 500
      }
    };
    const secondFrame = document.body.appendChild(document.createElement("iframe"));
    const secondWindow = secondFrame.contentWindow as Window & typeof globalThis;
    secondWindow.document.open();
    secondWindow.document.write(page);
    secondWindow.document.close();
    secondWindow.eval(
      createAnnotationRuntimeScript("render-second", [legacyAnnotation])
    );

    const mark = secondWindow.document.querySelector<HTMLElement>(
      'mark[data-obsidian-html-preview-annotation]'
    );
    expect(mark?.textContent).toBe("Alpha beta");

    const remainingText = mark?.nextSibling;
    expect(remainingText).toBeInstanceOf(secondWindow.Text);
    const secondRange = secondWindow.document.createRange();
    secondRange.setStart(remainingText as Text, 1);
    secondRange.setEnd(remainingText as Text, 6);
    secondWindow.getSelection()?.addRange(secondRange);
    secondWindow.document.dispatchEvent(
      new secondWindow.MouseEvent("mouseup", { bubbles: true })
    );
    expect(
      secondWindow.document.querySelector('[role="toolbar"]')?.textContent
    ).toContain("注释");

    firstFrame.remove();
    secondFrame.remove();
  });

  it("restores annotations and selection listeners when loaded from the document head", async () => {
    const existing = {
      color: "violet" as const,
      comment: "Existing note",
      id: "11111111111111111111111111111111",
      quote: "Alpha beta",
      sourcePath: "pages/index.html",
      target: {
        end: 10,
        exact: "Alpha beta",
        prefix: "",
        start: 0,
        suffix: " gamma"
      }
    };
    const frame = document.body.appendChild(document.createElement("iframe"));
    const frameWindow = frame.contentWindow as Window & typeof globalThis;
    const runtime = createAnnotationRuntimeScript("render-head", [existing]);
    frameWindow.document.open();
    frameWindow.document.write(
      `<!doctype html><html><head><script>${runtime}</script></head><body><p>Alpha beta gamma</p></body></html>`
    );
    frameWindow.document.close();

    await vi.waitFor(() => {
      expect(
        frameWindow.document.querySelector<HTMLElement>(
          'mark[data-obsidian-html-preview-annotation]'
        )?.textContent
      ).toBe("Alpha beta");
    });
    const mark = frameWindow.document.querySelector<HTMLElement>(
      'mark[data-obsidian-html-preview-annotation]'
    );

    const remainingText = mark?.nextSibling;
    expect(remainingText).toBeInstanceOf(frameWindow.Text);
    const range = frameWindow.document.createRange();
    range.setStart(remainingText as Text, 1);
    range.setEnd(remainingText as Text, 6);
    frameWindow.getSelection()?.addRange(range);
    frameWindow.document.dispatchEvent(
      new frameWindow.MouseEvent("mouseup", { bubbles: true })
    );
    expect(frameWindow.document.querySelector('[role="toolbar"]')).not.toBeNull();

    frame.remove();
  });
});
