import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLEANUP_HIDDEN_ATTRIBUTE,
  CLEANUP_MODE_MESSAGE_TYPE,
  CLEANUP_SELECTED_MESSAGE_TYPE,
  CLEANUP_TARGET_ATTRIBUTE,
  createCleanupCandidate,
  createCleanupRuntimeScript,
  installCleanupRuntime
} from "../src/cleanup/runtime";
import { validRule } from "./fixtures/cleanup-rules";

function cleanupCommand(enabled: boolean, renderId = "secret", source: Window | null = window) {
  return new MessageEvent("message", {
    data: { enabled, renderId, type: CLEANUP_MODE_MESSAGE_TYPE },
    source
  });
}

describe("cleanup runtime", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a stable candidate without generated IDs", () => {
    document.body.innerHTML = `
      <main class="layout">
        <aside id="react-123456789" class="sidebar" aria-label="Related content">
          Related articles
        </aside>
      </main>`;
    const candidate = createCleanupCandidate(document.querySelector("aside")!);

    expect(candidate).toEqual(
      expect.objectContaining({
        fingerprint: expect.objectContaining({
          attributes: { "aria-label": "Related content" },
          tag: "aside",
          text: "Related articles"
        })
      })
    );
    expect(candidate?.fingerprint).not.toHaveProperty("id");
    expect(candidate?.selector).not.toContain("react-123456789");
  });

  it("rejects protected roots and runtime controls", () => {
    const control = document.createElement("button");
    control.dataset.htmlPreviewCleanupUi = "true";
    document.body.append(control);

    expect(createCleanupCandidate(document.body)).toBeNull();
    expect(createCleanupCandidate(control)).toBeNull();
  });

  it("applies existing rules and injects marker styling", () => {
    document.body.innerHTML = `
      <main class="layout">
        <aside class="sidebar" aria-label="Related content">Related articles</aside>
      </main>`;

    const dispose = installCleanupRuntime({ renderId: "secret", rules: [validRule] });

    expect(document.querySelector("aside")?.getAttribute(CLEANUP_HIDDEN_ATTRIBUTE)).toBe(
      validRule.id
    );
    expect(document.querySelector("style")?.textContent).toContain(
      "display: none !important"
    );
    dispose();
  });

  it("reports unmatched rules using the secret render token", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");

    const dispose = installCleanupRuntime({ renderId: "secret", rules: [validRule] });

    expect(postMessage).toHaveBeenCalledWith(
      {
        renderId: "secret",
        ruleIds: [validRule.id],
        type: "obsidian-html-preview:cleanup-unmatched"
      },
      "*"
    );
    dispose();
  });

  it("requires the parent source and current token to enable cleanup mode", () => {
    const dispose = installCleanupRuntime({ renderId: "secret", rules: [] });
    const aside = document.createElement("aside");
    document.body.append(aside);

    window.dispatchEvent(cleanupCommand(true, "wrong"));
    aside.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(aside.hasAttribute(CLEANUP_TARGET_ATTRIBUTE)).toBe(false);

    window.dispatchEvent(cleanupCommand(true, "secret", null));
    aside.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(aside.hasAttribute(CLEANUP_TARGET_ATTRIBUTE)).toBe(false);

    window.dispatchEvent(cleanupCommand(true));
    aside.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(aside.hasAttribute(CLEANUP_TARGET_ATTRIBUTE)).toBe(true);
    dispose();
  });

  it("reports that Escape exited cleanup mode", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    const dispose = installCleanupRuntime({ renderId: "secret", rules: [] });
    window.dispatchEvent(cleanupCommand(true));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(postMessage).toHaveBeenCalledWith(
      {
        enabled: false,
        renderId: "secret",
        type: "obsidian-html-preview:cleanup-mode-state"
      },
      "*"
    );
    dispose();
  });

  it("rejects synthetic cleanup clicks and intercepts them before navigation", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");
    document.body.innerHTML = `<a class="sidebar" href="next.html">Next</a>`;
    const dispose = installCleanupRuntime({ renderId: "secret", rules: [] });
    window.dispatchEvent(cleanupCommand(true));

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("a")?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: CLEANUP_SELECTED_MESSAGE_TYPE }),
      "*"
    );
    dispose();
  });

  it("reapplies unmatched rules when matching DOM is inserted", async () => {
    const dispose = installCleanupRuntime({ renderId: "secret", rules: [validRule] });
    const wrapper = document.createElement("main");
    wrapper.className = "layout";
    wrapper.innerHTML = `<aside class="sidebar" aria-label="Related content">Related articles</aside>`;
    document.body.append(wrapper);

    await vi.runAllTimersAsync();

    expect(document.querySelector("aside")?.getAttribute(CLEANUP_HIDDEN_ATTRIBUTE)).toBe(
      validRule.id
    );
    dispose();
  });

  it("generates a bounded self-contained runtime script", () => {
    const script = createCleanupRuntimeScript("secret", [validRule]);

    expect(script).toContain("installCleanupRuntime");
    expect(script).toContain("aside.sidebar");
    expect(script).toContain("secret");
    expect(script.length).toBeLessThan(30_000);
  });

  it("executes the generated runtime without module-scope dependencies", () => {
    document.body.innerHTML = `<aside class="sidebar">Related</aside>`;
    const script = createCleanupRuntimeScript("secret", []);

    window.eval(script);
    window.dispatchEvent(cleanupCommand(true));
    document
      .querySelector("aside")
      ?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));

    expect(document.querySelector("aside")?.hasAttribute(CLEANUP_TARGET_ATTRIBUTE)).toBe(
      true
    );
  });
});
