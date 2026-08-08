import { parseCleanupDocument } from "./rule-validation";
import type { CleanupDocument, CleanupRule } from "./types";

export interface CleanupStorageAdapter {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  write(path: string, data: string): Promise<void>;
}
export interface CleanupStoreProblem {
  message: string;
  path: string;
}

interface ReadResult {
  rules: CleanupRule[];
  valid: boolean;
}

const FOLDER_RULES_PATH = ".html-preview/cleanup/folder-rules.json";

export function cleanupPageRulePath(sourcePath: string): string {
  return `.html-preview/cleanup/pages/${sourcePath}.json`;
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
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

function serialize(rules: readonly CleanupRule[]): string {
  const document: CleanupDocument = { rules: [...rules], version: 1 };
  return `${JSON.stringify(document, null, 2)}\n`;
}

function mergeById(
  preferred: readonly CleanupRule[],
  existing: readonly CleanupRule[]
): CleanupRule[] {
  const merged = new Map<string, CleanupRule>();
  for (const rule of preferred) {
    merged.set(rule.id, rule);
  }
  for (const rule of existing) {
    if (!merged.has(rule.id)) {
      merged.set(rule.id, rule);
    }
  }
  return [...merged.values()];
}

export class CleanupRuleStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly adapter: CleanupStorageAdapter,
    private readonly onProblem: (problem: CleanupStoreProblem) => void = () => {}
  ) {}

  async loadEffective(sourcePath: string): Promise<CleanupRule[]> {
    validateSourcePath(sourcePath);
    await this.queue;
    const [folderResult, fileResult] = await Promise.all([
      this.readDocument(FOLDER_RULES_PATH),
      this.readDocument(cleanupPageRulePath(sourcePath))
    ]);
    const folderRules = folderResult.rules.filter(
      (rule) =>
        rule.scope === "folder" &&
        (rule.sourcePath === "." ||
          sourcePath.startsWith(`${rule.sourcePath}/`))
    );
    return mergeById(folderRules, fileResult.rules);
  }

  addFileRule(sourcePath: string, rule: CleanupRule): Promise<void> {
    validateSourcePath(sourcePath);
    return this.mutate(async () => {
      const path = cleanupPageRulePath(sourcePath);
      const result = await this.readForMutation(path);
      const fileRule: CleanupRule = {
        ...rule,
        scope: "file",
        sourcePath
      };
      this.assertRules([fileRule]);
      const rules = result.rules.filter((item) => item.id !== fileRule.id);
      rules.push(fileRule);
      await this.writeDocument(path, rules);
    });
  }

  removeRule(rule: CleanupRule): Promise<void> {
    return this.mutate(async () => {
      const path =
        rule.scope === "folder"
          ? FOLDER_RULES_PATH
          : cleanupPageRulePath(rule.sourcePath);
      const result = await this.readForMutation(path);
      await this.writeDocument(
        path,
        result.rules.filter((item) => item.id !== rule.id)
      );
    });
  }

  resetFileRules(sourcePath: string): Promise<void> {
    validateSourcePath(sourcePath);
    return this.mutate(async () => {
      const path = cleanupPageRulePath(sourcePath);
      await this.readForMutation(path);
      await this.writeDocument(path, []);
    });
  }

  promoteToFolder(sourcePath: string, ruleId: string): Promise<CleanupRule> {
    validateSourcePath(sourcePath);
    return this.mutate(async () => {
      const filePath = cleanupPageRulePath(sourcePath);
      const fileResult = await this.readForMutation(filePath);
      const rule = fileResult.rules.find((item) => item.id === ruleId);
      if (!rule) {
        throw new Error(`Cleanup rule was not found: ${ruleId}`);
      }
      const folderResult = await this.readForMutation(FOLDER_RULES_PATH);
      const promoted: CleanupRule = {
        ...rule,
        scope: "folder",
        sourcePath: parentPath(sourcePath) || "."
      };
      this.assertRules([promoted]);

      const folderRules = folderResult.rules.filter(
        (item) => item.id !== promoted.id
      );
      folderRules.push(promoted);
      await this.writeDocument(FOLDER_RULES_PATH, folderRules);
      await this.writeDocument(
        filePath,
        fileResult.rules.filter((item) => item.id !== ruleId)
      );
      return promoted;
    });
  }

  migrateFile(oldPath: string, newPath: string): Promise<void> {
    validateSourcePath(oldPath);
    validateSourcePath(newPath);
    return this.mutate(async () => {
      const oldRulePath = cleanupPageRulePath(oldPath);
      if (!(await this.adapter.exists(oldRulePath))) {
        return;
      }
      const sourceResult = await this.readForMutation(oldRulePath);
      const newRulePath = cleanupPageRulePath(newPath);
      const targetResult = await this.readForMutation(newRulePath);
      const movedRules = sourceResult.rules.map((rule) => ({
        ...rule,
        scope: "file" as const,
        sourcePath: newPath
      }));
      await this.writeDocument(
        newRulePath,
        mergeById(movedRules, targetResult.rules)
      );
      await this.adapter.remove(oldRulePath);
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

  private async readDocument(path: string): Promise<ReadResult> {
    if (!(await this.adapter.exists(path))) {
      return { rules: [], valid: true };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await this.adapter.read(path)) as unknown;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.onProblem({ message: `Failed to parse cleanup data: ${detail}`, path });
      return { rules: [], valid: false };
    }
    const document = parseCleanupDocument(parsed);
    if (!document) {
      this.onProblem({ message: "Unsupported or invalid cleanup data", path });
      return { rules: [], valid: false };
    }
    return { rules: document.rules, valid: true };
  }

  private async readForMutation(path: string): Promise<ReadResult> {
    const result = await this.readDocument(path);
    if (!result.valid) {
      throw new Error(`Cannot overwrite invalid cleanup data: ${path}`);
    }
    return result;
  }

  private assertRules(rules: readonly CleanupRule[]): void {
    if (!parseCleanupDocument({ rules, version: 1 })) {
      throw new Error("Invalid cleanup rule");
    }
  }

  private async ensureParentDirectories(path: string): Promise<void> {
    const directory = parentPath(path);
    if (!directory) {
      return;
    }
    const segments = directory.split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!(await this.adapter.exists(current))) {
        await this.adapter.mkdir(current);
      }
    }
  }

  private async writeDocument(
    path: string,
    rules: readonly CleanupRule[]
  ): Promise<void> {
    this.assertRules(rules);
    await this.ensureParentDirectories(path);
    await this.adapter.write(path, serialize(rules));
  }
}
