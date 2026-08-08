import { describe, expect, it } from "vitest";

import { createRenderId } from "../src/preview/bridge-script";

describe("createRenderId", () => {
  it("creates opaque 128-bit hexadecimal render identifiers", () => {
    const ids = Array.from({ length: 20 }, () => createRenderId());

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[0-9a-f]{32}$/.test(id))).toBe(true);
  });
});

