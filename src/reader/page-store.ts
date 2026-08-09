export interface ReaderPageStorageAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  write(path: string, data: string): Promise<void>;
}

function validateSourcePath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").includes("..")
  ) {
    throw new Error(`Invalid Vault path: ${path}`);
  }
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}

export function readerBackupPath(sourcePath: string): string {
  validateSourcePath(sourcePath);
  return `.html-preview/originals/${sourcePath}`;
}

export class ReaderPageStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: ReaderPageStorageAdapter) {}

  async hasBackup(sourcePath: string): Promise<boolean> {
    await this.queue;
    validateSourcePath(sourcePath);
    return this.adapter.exists(readerBackupPath(sourcePath));
  }

  save(
    sourcePath: string,
    originalSource: string,
    readerSource: string,
    replaceSource: (source: string) => Promise<void>
  ): Promise<void> {
    return this.mutate(async () => {
      validateSourcePath(sourcePath);
      const backupPath = readerBackupPath(sourcePath);
      if (!(await this.adapter.exists(backupPath))) {
        await this.ensureParentDirectory(backupPath);
        await this.adapter.write(backupPath, originalSource);
      }
      await replaceSource(readerSource);
    });
  }

  restore(
    sourcePath: string,
    replaceSource: (source: string) => Promise<void>
  ): Promise<void> {
    return this.mutate(async () => {
      validateSourcePath(sourcePath);
      const backupPath = readerBackupPath(sourcePath);
      if (!(await this.adapter.exists(backupPath))) {
        throw new Error("No original HTML backup exists for this file.");
      }
      const originalSource = await this.adapter.read(backupPath);
      await replaceSource(originalSource);
      await this.adapter.remove(backupPath);
    });
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async ensureParentDirectory(path: string): Promise<void> {
    const parent = parentPath(path);
    if (parent.length === 0 || (await this.adapter.exists(parent))) {
      return;
    }
    await this.ensureParentDirectory(parent);
    await this.adapter.mkdir(parent);
  }
}
