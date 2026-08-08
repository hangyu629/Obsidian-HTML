# HTML Preview Page Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users hide unwanted regions from HTML previews with reversible file- or folder-scoped rules stored inside the Vault, without modifying HTML source files.

**Architecture:** Pure rule validators and a serialized Vault store own trusted persisted data. A self-contained iframe cleanup runtime selects and hides elements, while `HtmlPreviewView` validates token-bound messages, performs storage mutations, and exposes Obsidian toolbar and modal controls.

**Tech Stack:** TypeScript, Obsidian Plugin API, browser DOM/iframe APIs, Vitest, jsdom, esbuild.

## Global Constraints

- Original HTML and asset files remain byte-for-byte unchanged.
- Cleanup data is stored under `.html-preview/cleanup/` inside the Vault.
- Default rules are file-scoped; users may promote a rule to its containing folder.
- Desktop pointer selection and mobile touch confirmation are both supported.
- JavaScript-disabled previews do not run or apply cleanup rules.
- Runtime messages require the active iframe source, random render token, trusted user input, bounded schemas, and host-side validation.
- No Electron, Node runtime, local HTTP server, or desktop-only API may enter the plugin bundle.

---

### Task 1: Cleanup rule model, validation, and locator scoring

**Files:**
- Create: `src/cleanup/types.ts`
- Create: `src/cleanup/rule-validation.ts`
- Create: `src/cleanup/locator.ts`
- Test: `tests/cleanup-rule-validation.test.ts`
- Test: `tests/cleanup-locator.test.ts`

**Interfaces:**
- Produces `CleanupRule`, `CleanupCandidate`, `ElementFingerprint`, and `CleanupScope`.
- Produces `parseCleanupCandidate(value: unknown): CleanupCandidate | null`.
- Produces `parseCleanupDocument(value: unknown): CleanupDocument | null`.
- Produces `scoreFingerprint(element: Element, fingerprint: ElementFingerprint): number`.
- Produces `resolveCleanupRule(document: Document, rule: CleanupRule): Element | null`.

- [ ] **Step 1: Write validation and locator tests**

```ts
expect(parseCleanupCandidate(validCandidate)).toEqual(validCandidate);
expect(parseCleanupCandidate({ ...validCandidate, selector: "body, html" })).toBeNull();
expect(resolveCleanupRule(document, fileRule)).toBe(document.querySelector("aside.sidebar"));
expect(resolveCleanupRule(document, ambiguousFolderRule)).toBeNull();
```

Cover 128-bit IDs, ISO timestamps, selector length and syntax, protected roots, generated IDs, bounded text/classes/ancestors, exact selector resolution, fingerprint fallback, file/folder thresholds, and ambiguity.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/cleanup-rule-validation.test.ts tests/cleanup-locator.test.ts`

Expected: FAIL because `src/cleanup/rule-validation.ts` and `src/cleanup/locator.ts` do not exist.

- [ ] **Step 3: Implement the rule contracts and pure locator**

```ts
export interface CleanupRule extends CleanupCandidate {
  id: string;
  createdAt: string;
  scope: "file" | "folder";
  sourcePath: string;
}

export function resolveCleanupRule(document: Document, rule: CleanupRule): Element | null {
  const direct = safeQuery(document, rule.selector);
  return chooseConfidentMatch(direct, rule.fingerprint, rule.scope);
}
```

Reject selector lists, combinator depth above eight, selectors outside the supported subset, `html/head/body`, payload fields above documented bounds, and non-plain objects.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- tests/cleanup-rule-validation.test.ts tests/cleanup-locator.test.ts && npm run typecheck`

Expected: both test files pass and TypeScript reports zero errors.

```bash
git add src/cleanup tests/cleanup-rule-validation.test.ts tests/cleanup-locator.test.ts
git commit -m "feat: validate and resolve cleanup rules"
```

### Task 2: Vault cleanup rule store

**Files:**
- Create: `src/cleanup/rule-store.ts`
- Test: `tests/cleanup-rule-store.test.ts`

**Interfaces:**
- Consumes `CleanupRule`, `CleanupDocument`, and `parseCleanupDocument`.
- Produces `CleanupStorageAdapter` with `exists`, `read`, `write`, `mkdir`, `rename`, and `remove`.
- Produces `CleanupRuleStore.loadEffective(sourcePath): Promise<CleanupRule[]>`.
- Produces `addFileRule`, `removeRule`, `resetFileRules`, `promoteToFolder`, and `migrateFile`.

- [ ] **Step 1: Write an in-memory adapter and failing store tests**

```ts
const store = new CleanupRuleStore(adapter);
await store.addFileRule("Clippings/page.html", rule);
expect(await store.loadEffective("Clippings/page.html")).toEqual([rule]);
await store.promoteToFolder("Clippings/page.html", rule.id);
expect((await store.loadEffective("Clippings/other.html"))[0]?.scope).toBe("folder");
```

Cover mirrored paths, folder prefix matching, serialized concurrent adds, remove, reset, promotion de-duplication, corrupt JSON preservation, unsupported versions, write failure, missing files, and rename migration with target merge.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/cleanup-rule-store.test.ts`

Expected: FAIL because `src/cleanup/rule-store.ts` does not exist.

- [ ] **Step 3: Implement queued adapter-backed storage**

```ts
const pageRulePath = (sourcePath: string) =>
  `.html-preview/cleanup/pages/${sourcePath}.json`;

private mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = this.queue.then(operation, operation);
  this.queue = result.then(() => undefined, () => undefined);
  return result;
}
```

Create parent directories lazily, validate every read, never overwrite corrupt/unsupported documents, and use version `1` JSON.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- tests/cleanup-rule-store.test.ts && npm run typecheck`

Expected: store tests pass and TypeScript reports zero errors.

```bash
git add src/cleanup/rule-store.ts tests/cleanup-rule-store.test.ts
git commit -m "feat: persist cleanup rules in the Vault"
```

### Task 3: Secure iframe cleanup runtime

**Files:**
- Create: `src/cleanup/runtime.ts`
- Modify: `src/preview/bridge-script.ts`
- Modify: `src/preview/document-builder.ts`
- Modify: `src/preview/types.ts`
- Test: `tests/cleanup-runtime.test.ts`
- Modify: `tests/bridge-script.test.ts`
- Modify: `tests/document-builder.test.ts`

**Interfaces:**
- Consumes serialized `CleanupRule[]` and the active `renderId`.
- Produces `createCleanupRuntimeScript(renderId, rules): string`.
- Produces `createCleanupCandidate(element: Element): CleanupCandidate | null` for direct locator testing.
- Produces self-contained `installCleanupRuntime(config): () => void` for runtime lifecycle testing.
- Extends `BuildPreviewInput` with `cleanupRules: readonly CleanupRule[]`.
- Produces runtime messages `cleanup-selected`, `cleanup-unmatched`, and parent command `cleanup-mode`.

- [ ] **Step 1: Write failing runtime and builder tests**

```ts
const dispose = installCleanupRuntime({ renderId: "secret", rules: [rule] });
expect(document.querySelector("aside")?.hasAttribute(HIDDEN_ATTRIBUTE)).toBe(true);
window.dispatchEvent(parentCleanupModeCommand(true));
candidate.dispatchEvent(new MouseEvent("click", { bubbles: true }));
expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "cleanup-selected" }), "*");
expect(createCleanupCandidate(candidate)).toEqual(expect.objectContaining({ selector: "aside.sidebar" }));
dispose();
```

Cover initial rule replay, marker style, unmatched reporting, mutation replay, command source validation, protected elements, synthetic-event rejection, candidate generation, desktop hover state, touch select-confirm-cancel state, cleanup interception before navigation, and self-removing secret runtime script. Verify a real trusted click in the manual Desktop and mobile smoke test; do not add a test-only trust bypass to production code.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/cleanup-runtime.test.ts tests/bridge-script.test.ts tests/document-builder.test.ts`

Expected: FAIL because `src/cleanup/runtime.ts` does not exist and builder input lacks cleanup rules.

- [ ] **Step 3: Implement a self-contained runtime and inject it before navigation**

```ts
export function createCleanupRuntimeScript(renderId: string, rules: readonly CleanupRule[]): string {
  return `(${installCleanupRuntime.toString()})(${JSON.stringify({ renderId, rules })});`;
}
```

The installer must be self-contained, register its cleanup click listener before the navigation listener, cache trusted DOM methods it relies on, mark resolved elements, debounce mutation replay, and remove injected controls when cleanup mode exits.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- tests/cleanup-runtime.test.ts tests/bridge-script.test.ts tests/document-builder.test.ts && npm run typecheck`

Expected: runtime and existing preview tests pass with zero type errors.

```bash
git add src/cleanup/runtime.ts src/preview tests/cleanup-runtime.test.ts tests/bridge-script.test.ts tests/document-builder.test.ts
git commit -m "feat: add secure iframe cleanup runtime"
```

### Task 4: Obsidian controller, rule manager, rename integration, and release docs

**Files:**
- Create: `src/cleanup/rules-modal.ts`
- Modify: `src/html-preview-view.ts`
- Modify: `src/main.ts`
- Modify: `src/settings.ts`
- Modify: `styles.css`
- Modify: `tests/html-preview-view.test.ts`
- Create: `tests/cleanup-plugin-integration.test.ts`
- Modify: `README.md`
- Modify: `manifest.json`, `versions.json`, `package.json`

**Interfaces:**
- Consumes `CleanupRuleStore`, effective rules, runtime messages, and existing diagnostics.
- Extends `HtmlPreviewEnvironment` with `cleanupStore` and `showNotice(message)`.
- Produces toolbar cleanup toggle, undo, manager actions, persistence rollback, promotion, reset, and file rename migration.

- [ ] **Step 1: Write failing view and plugin integration tests**

```ts
expect(view.actions.map((action) => action.title)).toContain("Clean up page");
dispatchCleanupCandidate(frame, candidate, "render-test");
await flushPromises();
expect(cleanupStore.addFileRule).toHaveBeenCalledWith("pages/index.html", expect.any(Object));
expect(buildInput.cleanupRules).toEqual(effectiveRules);
```

Cover invalid source/token/schema rejection, file-rule creation, storage failure rerender and Notice, undo, manager restore/promote/reset, JavaScript-disabled action, stale loads, rename migration, view cleanup, and existing navigation behavior.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/html-preview-view.test.ts tests/cleanup-plugin-integration.test.ts`

Expected: FAIL because the view environment and plugin do not expose cleanup storage or actions.

- [ ] **Step 3: Implement the controller, modal, plugin wiring, and styling**

```ts
const effectiveRules = settings.allowScripts
  ? await cleanupStore.loadEffective(file.path)
  : [];

frame.contentWindow?.postMessage(
  { type: "obsidian-html-preview:cleanup-mode", enabled },
  "*"
);
```

Use Obsidian icon actions with tooltips, keep iframe content full-bleed, use Obsidian CSS variables in the manager, instantiate `CleanupRuleStore` once in the plugin, and migrate page data on `TFile` rename.

- [ ] **Step 4: Update release documentation and version**

Document cleanup mode, Vault data paths, file/folder rules, undo/reset, JavaScript requirement, sync caveat, and unsupported embedded content. Increment plugin/package version to `0.2.0` and map it in `versions.json`.

- [ ] **Step 5: Run final verification and commit**

Run: `npm run check && npm audit --audit-level=high && git diff --check`

Expected: all tests pass, type checking and production build succeed, release validation accepts `0.2.0`, audit reports zero high vulnerabilities, and Git reports no whitespace errors.

```bash
git add src tests README.md styles.css package.json package-lock.json manifest.json versions.json
git commit -m "feat: ship persistent page cleanup"
```
