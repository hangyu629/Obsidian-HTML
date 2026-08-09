import { describe, expect, it } from "vitest";

import { resolveAnnotationTarget } from "../src/annotations/dom";

describe("resolveAnnotationTarget", () => {
  it("rejects a stale offset that now points to another repeated quote", () => {
    const original = "AAAAA target BBBBB target ZZZZZ";
    const targetStart = original.lastIndexOf("target");
    const target = {
      end: targetStart + "target".length,
      exact: "target",
      prefix: original.slice(Math.max(0, targetStart - 24), targetStart),
      start: targetStart,
      suffix: original.slice(targetStart + "target".length)
    };

    const current = `${"C".repeat(13)}${original}`;
    const resolved = resolveAnnotationTarget(current, target);

    expect(resolved?.start).toBe(targetStart + 13);
  });

  it("does not guess when repeated quotes have no surviving context", () => {
    const resolved = resolveAnnotationTarget("target ... target", {
      end: 6,
      exact: "target",
      prefix: "",
      start: 0,
      suffix: ""
    });

    expect(resolved).toBeNull();
  });
});
