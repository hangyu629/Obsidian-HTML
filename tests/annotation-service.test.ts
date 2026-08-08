import { describe, expect, it, vi } from "vitest";

import { AnnotationService } from "../src/annotations/annotation-service";
import type { HtmlAnnotation } from "../src/annotations/types";

function annotation(sourcePath = "notes/a.md"): HtmlAnnotation {
  return {
    color: "green",
    comment: "A note",
    id: "11111111111111111111111111111111",
    quote: "Alpha",
    sourcePath,
    target: { end: 5, exact: "Alpha", prefix: "", start: 0, suffix: " beta" }
  };
}

function harness() {
  const store = {
    load: vi.fn(async () => [] as HtmlAnnotation[]),
    removeAnnotation: vi.fn(async () => undefined),
    saveFileAnnotation: vi.fn(async () => undefined)
  };
  return { service: new AnnotationService(store), store };
}

describe("AnnotationService", () => {
  it("emits one source-scoped notification after save and remove", async () => {
    const { service } = harness();
    const current = annotation();
    const listener = vi.fn();
    const other = vi.fn();
    service.subscribe("notes/a.md", listener);
    service.subscribe("notes/b.md", other);

    await service.save("notes/a.md", current);
    await service.remove(current);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops notifying after a subscription is removed", async () => {
    const { service } = harness();
    const listener = vi.fn();
    const unsubscribe = service.subscribe("notes/a.md", listener);
    unsubscribe();

    await service.save("notes/a.md", annotation());

    expect(listener).not.toHaveBeenCalled();
  });

  it("routes focus to the newest matching rendered view", async () => {
    const { service } = harness();
    const older = vi.fn(async () => false);
    const newer = vi.fn(async () => true);
    service.registerView({ sourcePath: "notes/a.md", focusAnnotation: older });
    const unregister = service.registerView({
      sourcePath: "notes/a.md",
      focusAnnotation: newer
    });

    expect(await service.focus("notes/a.md", annotation().id)).toBe(true);
    expect(newer).toHaveBeenCalledWith(annotation().id);
    expect(older).not.toHaveBeenCalled();

    unregister();
    expect(await service.focus("notes/a.md", annotation().id)).toBe(false);
    expect(older).toHaveBeenCalledWith(annotation().id);
  });
});
