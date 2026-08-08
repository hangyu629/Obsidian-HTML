import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreviewCoordinator } from "../src/preview/preview-coordinator";

describe("PreviewCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes a view after its source changes", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    coordinator.subscribe("view-1", "pages/index.html", new Set(), refresh);

    coordinator.notify("pages/index.html");
    vi.advanceTimersByTime(249);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes a view when a known dependency changes", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    coordinator.subscribe(
      "view-1",
      "pages/index.html",
      new Set(["pages/assets/style.css"]),
      refresh
    );

    coordinator.notify("pages/assets/style.css");
    vi.advanceTimersByTime(250);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated file changes", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    coordinator.subscribe("view-1", "pages/index.html", new Set(), refresh);

    coordinator.notify("notes/today.md");
    vi.runAllTimers();

    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses trailing debounce for a burst of writes", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    coordinator.subscribe("view-1", "pages/index.html", new Set(), refresh);

    coordinator.notify("pages/index.html");
    vi.advanceTimersByTime(200);
    coordinator.notify("pages/index.html");
    vi.advanceTimersByTime(200);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("uses updated paths and dependencies", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    coordinator.subscribe("view-1", "pages/index.html", new Set(), refresh);
    coordinator.update(
      "view-1",
      "renamed/index.html",
      new Set(["renamed/theme.css"])
    );

    coordinator.notify("pages/index.html");
    coordinator.notify("renamed/theme.css");
    vi.advanceTimersByTime(250);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops pending and future refreshes after unsubscribe", () => {
    const coordinator = new PreviewCoordinator(250);
    const refresh = vi.fn();
    const unsubscribe = coordinator.subscribe(
      "view-1",
      "pages/index.html",
      new Set(),
      refresh
    );

    coordinator.notify("pages/index.html");
    unsubscribe();
    vi.runAllTimers();
    coordinator.notify("pages/index.html");
    vi.runAllTimers();

    expect(refresh).not.toHaveBeenCalled();
  });

  it("cancels all subscriptions when disposed", () => {
    const coordinator = new PreviewCoordinator(250);
    const first = vi.fn();
    const second = vi.fn();
    coordinator.subscribe("view-1", "one.html", new Set(), first);
    coordinator.subscribe("view-2", "two.html", new Set(), second);
    coordinator.notify("one.html");
    coordinator.notify("two.html");

    coordinator.dispose();
    vi.runAllTimers();

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});

