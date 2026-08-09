import { describe, expect, it } from "vitest";

import {
  createAnnotationLocatorRuntimeSource,
  resolveAnnotationOffsets
} from "../src/annotations/locator";
import { createAnnotationRuntimeScript } from "../src/annotations/runtime";

const target = {
  end: 25,
  exact: "target",
  prefix: "AAAAA target BBBBB ",
  start: 19,
  suffix: " ZZZZZ"
};

describe("annotation locator runtime source", () => {
  it("is embedded in the iframe annotation runtime", () => {
    const script = createAnnotationRuntimeScript("render-id");

    expect(script).toContain(createAnnotationLocatorRuntimeSource());
    expect(script).toContain(
      "const resolveTarget = (target) => resolveAnnotationOffsets(visibleText(), target);"
    );
  });

  it("runs the same locator implementation in the iframe runtime", () => {
    const runtimeResolve = Function(
      `${createAnnotationLocatorRuntimeSource()}\nreturn resolveAnnotationOffsets;`
    )() as typeof resolveAnnotationOffsets;
    const current = `${"C".repeat(13)}AAAAA target BBBBB target ZZZZZ`;

    expect(runtimeResolve(current, target)).toEqual(
      resolveAnnotationOffsets(current, target)
    );
    expect(runtimeResolve("target ... target", {
      end: 6,
      exact: "target",
      prefix: "",
      start: 0,
      suffix: ""
    })).toBeNull();
  });
});
