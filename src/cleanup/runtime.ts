import type { CleanupCandidate, CleanupRule, ElementFingerprint } from "./types";

export const CLEANUP_HIDDEN_ATTRIBUTE = "data-obsidian-html-preview-hidden";
export const CLEANUP_TARGET_ATTRIBUTE = "data-obsidian-html-preview-target";
export const CLEANUP_MODE_MESSAGE_TYPE =
  "obsidian-html-preview:cleanup-mode" as const;
export const CLEANUP_MODE_STATE_MESSAGE_TYPE =
  "obsidian-html-preview:cleanup-mode-state" as const;
export const CLEANUP_SELECTED_MESSAGE_TYPE =
  "obsidian-html-preview:cleanup-selected" as const;
export const CLEANUP_UNMATCHED_MESSAGE_TYPE =
  "obsidian-html-preview:cleanup-unmatched" as const;

export interface CleanupRuntimeConfig {
  renderId: string;
  rules: readonly CleanupRule[];
}

export function createCleanupCandidate(element: Element): CleanupCandidate | null {
  const normalizedText = (value: string | null): string =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const tag = element.tagName.toLowerCase();
  if (
    tag === "html" ||
    tag === "head" ||
    tag === "body" ||
    element.closest("[data-html-preview-cleanup-ui]")
  ) {
    return null;
  }

  const generatedId = (id: string): boolean =>
    /^[:].*[:]$/.test(id) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) ||
    /^(react|ember|vue|headlessui|radix)[-_:]?[a-z]*\d{3,}$/i.test(id) ||
    /^[0-9a-f]{16,}$/i.test(id);
  const stableId =
    /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(element.id) &&
    !generatedId(element.id)
      ? element.id
      : undefined;
  const stableAttributes = ["data-testid", "data-test", "aria-label", "role"];
  const attributes: Record<string, string> = {};
  for (const name of stableAttributes) {
    const value = element.getAttribute(name);
    if (value && value.length <= 160) {
      attributes[name] = value;
    }
  }
  const classes = [...element.classList]
    .filter((value) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(value))
    .slice(0, 12);

  let selector = "";
  if (stableId && document.querySelectorAll(`#${stableId}`).length === 1) {
    selector = `#${stableId}`;
  }
  if (!selector) {
    for (const name of stableAttributes) {
      const value = attributes[name];
      if (!value || !/^[a-zA-Z0-9 _-]{1,80}$/.test(value)) {
        continue;
      }
      const candidate = `${tag}[${name}="${value}"]`;
      if (document.querySelectorAll(candidate).length === 1) {
        selector = candidate;
        break;
      }
    }
  }
  if (!selector && classes.length > 0) {
    const candidate = `${tag}${classes
      .slice(0, 3)
      .map((value) => `.${value}`)
      .join("")}`;
    if (document.querySelectorAll(candidate).length === 1) {
      selector = candidate;
    }
  }
  if (!selector) {
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current.tagName.toLowerCase() !== "body" && parts.length < 6) {
      const currentTag = current.tagName.toLowerCase();
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (sibling) => sibling.tagName === current!.tagName
          )
        : [];
      const index = Math.max(1, siblings.indexOf(current) + 1);
      parts.unshift(`${currentTag}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    selector = parts.join(" > ");
  }

  const ancestors: ElementFingerprint["ancestors"] = [];
  let parent = element.parentElement;
  while (parent && parent.tagName.toLowerCase() !== "body" && ancestors.length < 5) {
    const parentClasses = [...parent.classList]
      .filter((value) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(value))
      .slice(0, 6);
    const parentId =
      /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(parent.id) &&
      !generatedId(parent.id)
        ? parent.id
        : undefined;
    ancestors.push({
      classes: parentClasses,
      ...(parentId ? { id: parentId } : {}),
      tag: parent.tagName.toLowerCase()
    });
    parent = parent.parentElement;
  }

  return {
    fingerprint: {
      ancestors,
      attributes,
      classes,
      ...(stableId ? { id: stableId } : {}),
      tag,
      text: normalizedText(element.textContent)
    },
    selector
  };
}

export function installCleanupRuntime(
  config: CleanupRuntimeConfig,
  candidateFactory: (element: Element) => CleanupCandidate | null =
    createCleanupCandidate
): () => void {
  const hiddenAttribute = "data-obsidian-html-preview-hidden";
  const targetAttribute = "data-obsidian-html-preview-target";
  const uiAttribute = "data-html-preview-cleanup-ui";
  const modeMessageType = "obsidian-html-preview:cleanup-mode";
  const modeStateMessageType = "obsidian-html-preview:cleanup-mode-state";
  const selectedMessageType = "obsidian-html-preview:cleanup-selected";
  const unmatchedMessageType = "obsidian-html-preview:cleanup-unmatched";
  const cachedStopImmediate = Event.prototype.stopImmediatePropagation;
  let cleanupMode = false;
  let currentTarget: Element | null = null;
  let touchTarget: Element | null = null;
  let controls: HTMLDivElement | null = null;
  let mutationTimer: ReturnType<typeof setTimeout> | null = null;
  let unmatched = new Set<string>();

  const style = document.createElement("style");
  style.setAttribute(uiAttribute, "true");
  style.textContent = `
    [${hiddenAttribute}] { display: none !important; }
    [${targetAttribute}] { outline: 3px solid #7c5cff !important; outline-offset: -3px !important; cursor: crosshair !important; }
    [${uiAttribute}] { font: 13px system-ui, sans-serif !important; }
  `;
  document.head.append(style);

  const normalize = (value: string | null): string =>
    (value ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const classScore = (element: Element, expected: readonly string[]): number => {
    if (expected.length === 0) return 0;
    return expected.filter((name) => element.classList.contains(name)).length /
      expected.length;
  };
  const score = (element: Element, rule: CleanupRule): number => {
    const fingerprint = rule.fingerprint;
    if (element.tagName.toLowerCase() !== fingerprint.tag) return -1;
    let value = 0.2;
    if (fingerprint.id) value += element.id === fingerprint.id ? 0.25 : -0.1;
    const attributes = Object.entries(fingerprint.attributes);
    if (attributes.length > 0) {
      value +=
        0.2 *
        (attributes.filter(([name, expected]) => element.getAttribute(name) === expected)
          .length /
          attributes.length);
    }
    value += 0.15 * classScore(element, fingerprint.classes);
    const text = normalize(element.textContent);
    if (fingerprint.text && text === fingerprint.text) value += 0.25;
    else if (fingerprint.text && (text.includes(fingerprint.text) || fingerprint.text.includes(text))) value += 0.15;
    let ancestor = element.parentElement;
    for (const expected of fingerprint.ancestors) {
      if (!ancestor) break;
      if (ancestor.tagName.toLowerCase() === expected.tag) {
        value += 0.05 + 0.03 * classScore(ancestor, expected.classes);
      }
      ancestor = ancestor.parentElement;
    }
    return Math.min(value, 1);
  };
  const choose = (elements: Element[], rule: CleanupRule, threshold: number): Element | null => {
    const ranked = elements
      .map((element) => ({ element, score: score(element, rule) }))
      .filter((item) => item.score >= threshold)
      .sort((left, right) => right.score - left.score);
    if (!ranked[0]) return null;
    if (ranked[1] && ranked[0].score - ranked[1].score < 0.12) return null;
    return ranked[0].element;
  };
  const resolve = (rule: CleanupRule): Element | null => {
    let direct: Element[] = [];
    try {
      direct = [...document.querySelectorAll(rule.selector)].slice(0, 100);
    } catch {
      return null;
    }
    const directMatch = choose(direct, rule, rule.scope === "folder" ? 0.7 : 0.45);
    if (directMatch) return directMatch;
    return choose(
      [...document.querySelectorAll(rule.fingerprint.tag)].slice(0, 500),
      rule,
      rule.scope === "folder" ? 0.75 : 0.62
    );
  };
  const applyRules = (): void => {
    const nextUnmatched = new Set<string>();
    for (const rule of config.rules) {
      const element = resolve(rule);
      if (element && !element.closest(`[${uiAttribute}]`)) {
        element.setAttribute(hiddenAttribute, rule.id);
      } else {
        nextUnmatched.add(rule.id);
      }
    }
    unmatched = nextUnmatched;
  };
  const reportUnmatched = (): void => {
    if (unmatched.size > 0) {
      window.parent.postMessage(
        {
          renderId: config.renderId,
          ruleIds: [...unmatched],
          type: unmatchedMessageType
        },
        "*"
      );
    }
  };
  const clearTarget = (): void => {
    currentTarget?.removeAttribute(targetAttribute);
    currentTarget = null;
  };
  const setTarget = (element: Element | null): void => {
    clearTarget();
    if (!element || !candidateFactory(element)) return;
    currentTarget = element;
    currentTarget.setAttribute(targetAttribute, "true");
  };
  const removeControls = (): void => {
    controls?.remove();
    controls = null;
    touchTarget = null;
  };
  const submit = (element: Element): void => {
    const candidate = candidateFactory(element);
    if (!candidate) return;
    element.setAttribute(hiddenAttribute, "pending");
    clearTarget();
    removeControls();
    window.parent.postMessage(
      {
        candidate,
        renderId: config.renderId,
        type: selectedMessageType
      },
      "*"
    );
  };
  const showTouchControls = (element: Element): void => {
    removeControls();
    touchTarget = element;
    controls = document.createElement("div");
    controls.setAttribute(uiAttribute, "true");
    controls.style.cssText = "position:fixed;z-index:2147483647;right:12px;bottom:12px;display:flex;gap:8px;padding:8px;background:#202127;color:white;border-radius:6px";
    const hide = document.createElement("button");
    hide.type = "button";
    hide.textContent = "Hide";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    hide.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.isTrusted && touchTarget) submit(touchTarget);
    });
    cancel.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearTarget();
      removeControls();
    });
    controls.append(hide, cancel);
    document.body.append(controls);
  };
  const onMessage = (event: MessageEvent<unknown>): void => {
    const data = event.data as Record<string, unknown> | null;
    if (
      event.source !== window.parent ||
      !data ||
      data.type !== modeMessageType ||
      data.renderId !== config.renderId ||
      typeof data.enabled !== "boolean"
    ) {
      return;
    }
    cachedStopImmediate.call(event);
    cleanupMode = data.enabled;
    if (!cleanupMode) {
      clearTarget();
      removeControls();
    }
  };
  const onPointerOver = (event: Event): void => {
    if (!cleanupMode) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest(`[${uiAttribute}]`)) return;
    setTarget(element);
  };
  const onClick = (event: MouseEvent): void => {
    if (!cleanupMode) return;
    event.preventDefault();
    cachedStopImmediate.call(event);
    if (!event.isTrusted) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element || element.closest(`[${uiAttribute}]`) || !candidateFactory(element)) return;
    const coarse = typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (coarse) {
      setTarget(element);
      showTouchControls(element);
    } else {
      submit(element);
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (cleanupMode && event.key === "Escape") {
      cleanupMode = false;
      clearTarget();
      removeControls();
      window.parent.postMessage(
        {
          enabled: false,
          renderId: config.renderId,
          type: modeStateMessageType
        },
        "*"
      );
    }
  };

  applyRules();
  reportUnmatched();
  window.addEventListener("message", onMessage, true);
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  const observer = new MutationObserver(() => {
    if (unmatched.size === 0) return;
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      mutationTimer = null;
      applyRules();
    }, 50);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    if (mutationTimer !== null) clearTimeout(mutationTimer);
    window.removeEventListener("message", onMessage, true);
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    clearTarget();
    removeControls();
    style.remove();
    for (const element of document.querySelectorAll(`[${hiddenAttribute}]`)) {
      element.removeAttribute(hiddenAttribute);
    }
  };
}

function serializeRuntimeConfig(config: CleanupRuntimeConfig): string {
  return JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function createCleanupRuntimeScript(
  renderId: string,
  rules: readonly CleanupRule[]
): string {
  return `(${installCleanupRuntime.toString()})(${serializeRuntimeConfig({
    renderId,
    rules
  })}, (${createCleanupCandidate.toString()}));`;
}
