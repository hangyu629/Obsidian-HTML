export const NAVIGATION_MESSAGE_TYPE = "obsidian-html-preview:navigate" as const;

export function createRenderId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createBridgeScript(renderId: string): string {
  const messageType = JSON.stringify(NAVIGATION_MESSAGE_TYPE);
  const serializedRenderId = JSON.stringify(renderId);

  return `(() => {
    const messageType = ${messageType};
    const renderId = ${serializedRenderId};
    const bridgeScript = document.currentScript;
    document.addEventListener("click", (event) => {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = event.target instanceof Element ? event.target : null;
      const anchor = element?.closest("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      window.parent.postMessage({ type: messageType, renderId, href }, "*");
    }, true);
    bridgeScript?.remove();
  })();`;
}
