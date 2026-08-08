export type NavigationDecision =
  | { kind: "fragment" }
  | { kind: "external"; url: string }
  | { kind: "vault"; path: string; subpath: string }
  | { kind: "blocked"; reason: string };

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function hasValidEncoding(value: string): boolean {
  if (/%(?![\da-fA-F]{2})/.test(value)) {
    return false;
  }

  try {
    decodeURI(value);
    return true;
  } catch {
    return false;
  }
}

function blocked(reason: string): NavigationDecision {
  return { kind: "blocked", reason };
}

function decodePath(path: string): string | null {
  try {
    const decoded = decodeURIComponent(path);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}

function resolveVaultPath(rawPath: string, sourcePath: string): string | null {
  const decodedPath = decodePath(rawPath);
  if (decodedPath === null || decodedPath.includes("\\")) {
    return null;
  }

  const absolute = decodedPath.startsWith("/");
  const sourceSegments = sourcePath.split("/").filter(Boolean);
  sourceSegments.pop();
  const segments = absolute ? [] : sourceSegments;

  for (const segment of decodedPath.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.length > 0 ? segments.join("/") : null;
}

export function classifyNavigation(
  rawHref: string,
  sourcePath: string
): NavigationDecision {
  const href = rawHref.trim();
  if (href.length === 0) {
    return blocked("Empty link");
  }
  if (href.startsWith("#")) {
    return { kind: "fragment" };
  }
  if (href.includes("\\") || !hasValidEncoding(href)) {
    return blocked("Malformed link");
  }

  if (PROTOCOL_PATTERN.test(href)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return blocked("Malformed URL");
    }

    if (!EXTERNAL_PROTOCOLS.has(url.protocol.toLowerCase())) {
      return blocked(`Blocked protocol: ${url.protocol}`);
    }
    return { kind: "external", url: href };
  }

  const hashIndex = href.indexOf("#");
  const subpath = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const rawPath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const path = resolveVaultPath(rawPath, sourcePath);

  return path === null
    ? blocked("Link resolves outside the Vault or is malformed")
    : { kind: "vault", path, subpath };
}
