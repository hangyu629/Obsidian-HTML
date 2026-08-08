import { describe, expect, it, vi } from "vitest";

import {
  CleanupRuleStore,
  type CleanupStorageAdapter
} from "../src/cleanup/rule-store";
import type { CleanupRule } from "../src/cleanup/types";
import { validRule } from "./fixtures/cleanup-rules";

class MemoryAdapter implements CleanupStorageAdapter {
  readonly directories = new Set<string>();
  readonly files = new Map<string, string>();
  failWrites = false;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      throw new Error(`Missing file: ${path}`);
    }
    return value;
  }

  async write(path: string, data: string): Promise<void> {
    if (this.failWrites) {
      throw new Error("disk full");
    }
    this.files.set(path, data);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async rename(from: string, to: string): Promise<void> {
    const value = this.files.get(from);
    if (value === undefined) {
      throw new Error(`Missing source: ${from}`);
    }
    this.files.set(to, value);
    this.files.delete(from);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
  }
}

const pagePath = (sourcePath: string) =>
  `.html-preview/cleanup/pages/${sourcePath}.json`;
const folderRulesPath = ".html-preview/cleanup/folder-rules.json";

function rule(id: string, sourcePath = "Clippings/page.html"): CleanupRule {
  return { ...validRule, id, sourcePath };
}

describe("CleanupRuleStore", () => {
  it("stores file rules in a mirrored Vault path", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);

    await store.addFileRule("Clippings/page.html", validRule);

    expect(adapter.files.has(pagePath("Clippings/page.html"))).toBe(true);
    expect(await store.loadEffective("Clippings/page.html")).toEqual([validRule]);
    expect(adapter.directories).toContain(
      ".html-preview/cleanup/pages/Clippings"
    );
  });

  it("serializes concurrent additions without losing a rule", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    const first = rule("11111111111111111111111111111111");
    const second = rule("22222222222222222222222222222222");

    await Promise.all([
      store.addFileRule("Clippings/page.html", first),
      store.addFileRule("Clippings/page.html", second)
    ]);

    expect(await store.loadEffective("Clippings/page.html")).toEqual([
      first,
      second
    ]);
  });

  it("promotes a file rule to its containing folder", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    await store.addFileRule("Clippings/page.html", validRule);

    const promoted = await store.promoteToFolder(
      "Clippings/page.html",
      validRule.id
    );

    expect(promoted).toEqual({
      ...validRule,
      scope: "folder",
      sourcePath: "Clippings"
    });
    expect(await store.loadEffective("Clippings/page.html")).toEqual([promoted]);
    expect(await store.loadEffective("Clippings/other.html")).toEqual([promoted]);
    expect(await store.loadEffective("Elsewhere/page.html")).toEqual([]);
  });

  it("supports root-folder promotion", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    const rootRule = rule(validRule.id, "page.html");
    await store.addFileRule("page.html", rootRule);

    const promoted = await store.promoteToFolder("page.html", rootRule.id);

    expect(promoted.sourcePath).toBe(".");
    expect(await store.loadEffective("Nested/other.html")).toEqual([promoted]);
  });

  it("removes individual rules and resets only current file rules", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    const first = rule("11111111111111111111111111111111");
    const second = rule("22222222222222222222222222222222");
    await store.addFileRule("Clippings/page.html", first);
    await store.addFileRule("Clippings/page.html", second);
    const folderRule = await store.promoteToFolder(
      "Clippings/page.html",
      first.id
    );

    await store.removeRule(second);
    expect(await store.loadEffective("Clippings/page.html")).toEqual([folderRule]);
    await store.addFileRule("Clippings/page.html", second);
    await store.resetFileRules("Clippings/page.html");
    expect(await store.loadEffective("Clippings/page.html")).toEqual([folderRule]);
    await store.removeRule(folderRule);
    expect(await store.loadEffective("Clippings/page.html")).toEqual([]);
  });

  it("preserves corrupt JSON and reports it without applying rules", async () => {
    const adapter = new MemoryAdapter();
    const onError = vi.fn();
    const path = pagePath("Clippings/page.html");
    adapter.files.set(path, "{bad json");
    const store = new CleanupRuleStore(adapter, onError);

    expect(await store.loadEffective("Clippings/page.html")).toEqual([]);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ path, message: expect.stringContaining("parse") })
    );
    await expect(
      store.addFileRule("Clippings/page.html", validRule)
    ).rejects.toThrow("Cannot overwrite invalid cleanup data");
    expect(adapter.files.get(path)).toBe("{bad json");
  });

  it("preserves unsupported schema versions", async () => {
    const adapter = new MemoryAdapter();
    const path = folderRulesPath;
    adapter.files.set(path, JSON.stringify({ version: 2, rules: [] }));
    const store = new CleanupRuleStore(adapter);

    expect(await store.loadEffective("Clippings/page.html")).toEqual([]);
    await expect(
      store.promoteToFolder("Clippings/page.html", validRule.id)
    ).rejects.toThrow();
    expect(adapter.files.get(path)).toBe('{"version":2,"rules":[]}');
  });

  it("rejects failed writes without changing stored data", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    await store.addFileRule("Clippings/page.html", validRule);
    const original = adapter.files.get(pagePath("Clippings/page.html"));
    adapter.failWrites = true;

    await expect(
      store.addFileRule(
        "Clippings/page.html",
        rule("33333333333333333333333333333333")
      )
    ).rejects.toThrow("disk full");
    expect(adapter.files.get(pagePath("Clippings/page.html"))).toBe(original);
  });

  it("migrates file rules and merges an existing target", async () => {
    const adapter = new MemoryAdapter();
    const store = new CleanupRuleStore(adapter);
    const sourceRule = rule("11111111111111111111111111111111", "Old/page.html");
    const targetRule = rule("22222222222222222222222222222222", "New/page.html");
    await store.addFileRule("Old/page.html", sourceRule);
    await store.addFileRule("New/page.html", targetRule);

    await store.migrateFile("Old/page.html", "New/page.html");

    expect(adapter.files.has(pagePath("Old/page.html"))).toBe(false);
    expect(await store.loadEffective("New/page.html")).toEqual([
      { ...sourceRule, sourcePath: "New/page.html" },
      targetRule
    ]);
  });
});
