interface CssBlock {
  body: string;
  header: string;
}

function assertNoExternalResources(css: string): void {
  if (/\@import\b/i.test(css)) {
    throw new Error("Template CSS cannot use external CSS resources");
  }
  const urls = css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi);
  for (const match of urls) {
    const value = match[2]?.trim().toLowerCase() ?? "";
    if (/^(https?:|\/\/|data:)/.test(value)) {
      throw new Error("Template CSS cannot use external CSS resources");
    }
  }
}

function splitCssBlocks(css: string): (CssBlock | string)[] {
  const blocks: (CssBlock | string)[] = [];
  let start = 0;
  let headerStart = 0;
  let quote = "";
  let comment = false;
  let parentheses = 0;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index] ?? "";
    const next = css[index + 1] ?? "";
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (quote) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "(") {
      parentheses += 1;
      continue;
    }
    if (character === ")") {
      parentheses = Math.max(0, parentheses - 1);
      continue;
    }
    if (parentheses > 0) {
      continue;
    }
    if (character === "{") {
      let depth = 1;
      let end = index + 1;
      let nestedQuote = "";
      let nestedComment = false;
      for (; end < css.length; end += 1) {
        const nested = css[end] ?? "";
        const nestedNext = css[end + 1] ?? "";
        if (nestedComment) {
          if (nested === "*" && nestedNext === "/") {
            nestedComment = false;
            end += 1;
          }
          continue;
        }
        if (!nestedQuote && nested === "/" && nestedNext === "*") {
          nestedComment = true;
          end += 1;
          continue;
        }
        if (nestedQuote) {
          if (nested === "\\") {
            end += 1;
          } else if (nested === nestedQuote) {
            nestedQuote = "";
          }
          continue;
        }
        if (nested === "'" || nested === '"') {
          nestedQuote = nested;
        } else if (nested === "{") {
          depth += 1;
        } else if (nested === "}" && --depth === 0) {
          break;
        }
      }
      if (depth !== 0) {
        return [css];
      }
      if (headerStart < index) {
        blocks.push(css.slice(start, headerStart));
      }
      blocks.push({
        body: css.slice(index + 1, end),
        header: css.slice(headerStart, index)
      });
      start = end + 1;
      headerStart = start;
      index = end;
    }
  }
  if (start < css.length) {
    blocks.push(css.slice(start));
  }
  return blocks;
}

function splitSelectors(selectors: string): string[] {
  const result: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = "";
  for (let index = 0; index < selectors.length; index += 1) {
    const character = selectors[index] ?? "";
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
    } else if (character === "'" || character === '"') quote = character;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses -= 1;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (character === "," && parentheses === 0 && brackets === 0) {
      result.push(selectors.slice(start, index));
      start = index + 1;
    }
  }
  result.push(selectors.slice(start));
  return result;
}

function scopeSelector(selector: string, rootSelector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed === ":root" || trimmed === "html" || trimmed === "body") {
    return rootSelector;
  }
  if (trimmed.startsWith(":root")) {
    return `${rootSelector}${trimmed.slice(5)}`;
  }
  return `${rootSelector} ${trimmed}`;
}

function scopeRules(css: string, rootSelector: string): string {
  return splitCssBlocks(css)
    .map((part) => {
      if (typeof part === "string") return part;
      const header = part.header.trim();
      if (!header) return `{${part.body}}`;
      if (/^@(?:media|supports|container|layer|document)\b/i.test(header)) {
        return `${part.header}{${scopeRules(part.body, rootSelector)}}`;
      }
      if (/^@(?:keyframes|-webkit-keyframes)\b/i.test(header)) {
        return `${part.header}{${part.body}}`;
      }
      if (header.startsWith("@")) {
        return `${part.header}{${part.body}}`;
      }
      return `${splitSelectors(part.header)
        .map((selector) => scopeSelector(selector, rootSelector))
        .join(", ")}{${part.body}}`;
    })
    .join("");
}

export function scopeTemplateCss(css: string, rootSelector: string): string {
  assertNoExternalResources(css);
  if (!rootSelector.trim()) {
    throw new Error("A template CSS root selector is required");
  }
  return scopeRules(css, rootSelector);
}
