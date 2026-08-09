import { describe, expect, it } from "vitest";

import {
  readerBackupPath,
  ReaderPageStore,
  type ReaderPageStorageAdapter
} from "../src/reader/page-store";

class MemoryAdapter implements ReaderPageStorageAdapter {
  readonly directories = new Set<string>();
  readonly files = new Map<string, string>();
  failWrites = false;
  failRemoves = false;

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new Error(`Missing file: ${path}`);
    return value;
  }

  async remove(path: string): Promise<void> {
    if (this.failRemoves) throw new Error("remove failed");
    this.files.delete(path);
  }

  async write(path: string, data: string): Promise<void> {
    if (this.failWrites) throw new Error("disk full");
    this.files.set(path, data);
  }
}

describe("ReaderPageStore", () => {
  it("mirrors source paths under the hidden originals directory", () => {
    expect(readerBackupPath("Clippings/page.html")).toBe(
      ".html-preview/originals/Clippings/page.html"
    );
  });

  it("rejects invalid Vault paths", async () => {
    const store = new ReaderPageStore(new MemoryAdapter());

    await expect(
      store.save("../page.html", "original", "reader", async () => undefined)
    ).rejects.toThrow("Invalid Vault path");
  });

  it("backs up the original before replacing the source", async () => {
    const adapter = new MemoryAdapter();
    const store = new ReaderPageStore(adapter);
    const events: string[] = [];

    const originalWrite = adapter.write.bind(adapter);
    adapter.write = async (path, data) => {
      events.push(`backup:${path}:${data}`);
      await originalWrite(path, data);
    };

    await store.save("Clippings/page.html", "original", "reader", async (source) => {
      events.push(`source:${source}`);
    });

    expect(events).toEqual([
      "backup:.html-preview/originals/Clippings/page.html:original",
      "source:reader"
    ]);
    expect(await store.hasBackup("Clippings/page.html")).toBe(true);
    expect(adapter.directories).toContain(".html-preview/originals/Clippings");
  });

  it("preserves an existing backup during later saves", async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set(readerBackupPath("Clippings/page.html"), "first original");
    const store = new ReaderPageStore(adapter);

    await store.save("Clippings/page.html", "second original", "reader", async () => undefined);

    expect(adapter.files.get(readerBackupPath("Clippings/page.html"))).toBe(
      "first original"
    );
  });

  it("keeps the backup when source replacement fails", async () => {
    const adapter = new MemoryAdapter();
    const store = new ReaderPageStore(adapter);

    await expect(
      store.save("Clippings/page.html", "original", "reader", async () => {
        throw new Error("modify failed");
      })
    ).rejects.toThrow("modify failed");

    expect(adapter.files.get(readerBackupPath("Clippings/page.html"))).toBe("original");
  });

  it("restores the original before removing the backup", async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set(readerBackupPath("Clippings/page.html"), "original");
    const store = new ReaderPageStore(adapter);

    await store.restore("Clippings/page.html", async (source) => {
      expect(source).toBe("original");
      expect(adapter.files.has(readerBackupPath("Clippings/page.html"))).toBe(true);
    });

    expect(adapter.files.has(readerBackupPath("Clippings/page.html"))).toBe(false);
  });

  it("keeps a recoverable backup when restore fails", async () => {
    const adapter = new MemoryAdapter();
    adapter.files.set(readerBackupPath("Clippings/page.html"), "original");
    const store = new ReaderPageStore(adapter);

    await expect(
      store.restore("Clippings/page.html", async () => {
        throw new Error("modify failed");
      })
    ).rejects.toThrow("modify failed");

    expect(adapter.files.get(readerBackupPath("Clippings/page.html"))).toBe("original");
  });
});
