import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Migration } from "@tab-zen/shared";

/** Current content version — bump when extraction logic improves */
export const CURRENT_CONTENT_VERSION = 9;

/** Registry of migrations — each defines what actions to take when upgrading */
export const MIGRATIONS: Migration[] = [
  {
    version: 2,
    actions: [
      {
        type: "re-extract-content",
        behavior: "silent",
        reason: "Improved content extraction with syntax highlighting, code blocks, and URL resolution",
      },
    ],
  },
];

export interface PageExtractResult {
  title: string;
  byline: string | null;
  content: string;        // markdown
  excerpt: string | null;
  siteName: string | null;
}

/**
 * Whether we should attempt content extraction for this URL.
 * Returns false for YouTube (handled by transcript extraction),
 * non-http protocols, and chrome-internal pages.
 */
export function shouldExtractContent(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  } catch {
    return false;
  }
  if (isYouTubeWatchUrl(url)) return false;
  return true;
}

/**
 * Resolve relative URLs in a raw HTML string.
 * Must be called BEFORE linkedom/Readability parse the HTML, because
 * linkedom in a service worker resolves getAttribute("href") against
 * the chrome-extension:// origin.
 */
function resolveRelativeUrls(html: string, sourceUrl: string): string {
  try {
    const origin = new URL(sourceUrl).origin;
    const baseUrl = sourceUrl.replace(/\/[^/]*$/, "/");

    // Resolve href="/path" and src="/path" (root-relative)
    let result = html.replace(
      /(href|src)="(\/[^"]*?)"/g,
      (_match, attr, path) => `${attr}="${origin}${path}"`,
    );

    // Resolve href="path" and src="path" (relative, not protocol/anchor/data/root)
    result = result.replace(
      /(href|src)="(?!https?:\/\/|mailto:|#|data:|\/\/|\/[^/])([^"]*?)"/g,
      (_match, attr, path) => {
        try {
          return `${attr}="${new URL(path, baseUrl).href}"`;
        } catch {
          return _match;
        }
      },
    );

    return result;
  } catch {
    return html;
  }
}

/** Convert HTML string to markdown using Turndown. Runs in background service worker. */
export function htmlToMarkdown(html: string, sourceUrl?: string): string {
  if (!html || !html.trim()) return "";

  // If sourceUrl provided, resolve any remaining relative URLs in the HTML
  // (most should already be resolved before Readability, this is a safety net)
  const processedHtml = sourceUrl ? resolveRelativeUrls(html, sourceUrl) : html;

  // Turndown uses `document` internally to parse HTML strings, which doesn't
  // exist in MV3 service workers. Parse with linkedom and pass the DOM node.
  // Wrap in <html><body> so linkedom places content in document.body.
  const { document: doc } = parseHTML(`<html><body>${processedHtml}</body></html>`);
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Preserve language info from <code class="language-xxx">, language labels
  // in sibling elements (e.g. TypeScript docs: <pre><p>ts</p><code>...</code></pre>),
  // or auto-detect from content.
  // Strip anchor tags that wrap headings (common blog pattern: <a href="#id"><h2>...</h2></a>)
  // These produce broken markdown like [## Heading](url)
  td.addRule("headingAnchorStrip", {
    filter: (node) => {
      if (node.nodeName !== "A") return false;
      // Check if this anchor contains a heading as a child
      const hasHeading = node.querySelector?.("h1, h2, h3, h4, h5, h6");
      return !!hasHeading;
    },
    replacement: (_content, node) => {
      // Just return the inner content — Turndown will process the heading inside
      const el = node as Element;
      const heading = el.querySelector?.("h1, h2, h3, h4, h5, h6");
      if (heading) {
        const level = parseInt(heading.nodeName[1]);
        const prefix = "#".repeat(level);
        return `\n\n${prefix} ${heading.textContent?.trim() || ""}\n\n`;
      }
      return _content;
    },
  });

  td.addRule("fencedCodeWithLang", {
    filter: (node) => {
      if (node.nodeName !== "PRE") return false;
      // Match if there's a <code> anywhere inside, or if it looks like a code block
      const hasCode = node.querySelector?.("code") !== null && node.querySelector?.("code") !== undefined;
      const firstChild = node.firstChild;
      const firstChildIsCode = firstChild?.nodeName === "CODE";
      return hasCode || firstChildIsCode;
    },
    replacement: (_content, node) => {
      const el = node as Element;
      const codeEl = el.querySelector?.("code");

      // Extract code text, preserving line breaks from block-level children
      // (some sites like typescriptlang.org wrap each line in <p> tags)
      let text = extractCodeText(codeEl || node);

      // Try to find language from:
      // 1. class="language-xxx" on <code>
      let lang = "";
      const className = codeEl?.getAttribute?.("class") || "";
      const langMatch = className.match(/(?:language-|lang-)(\w+)/);
      if (langMatch) {
        lang = langMatch[1];
      }

      // 2. A short text node or <p> before <code> (e.g. <pre><p>ts</p><code>...)
      //    Also check parent <pre>'s children if codeEl is nested deeper
      if (!lang) {
        const preChildren = Array.from(node.childNodes || []);
        for (const child of preChildren) {
          // Stop if we've reached the code element or its parent
          if (child === codeEl || (child as Element).querySelector?.("code")) break;
          const childText = (child.textContent || "").trim();
          // Short text (1-15 chars) before code is likely a language label
          if (childText && childText.length <= 15 && /^[a-zA-Z][\w+-]*$/.test(childText)) {
            lang = childText.toLowerCase();
            // Remove this label from the code text if it leaked in
            const firstLine = text.split("\n")[0];
            if (firstLine.trim() === childText) {
              text = text.split("\n").slice(1).join("\n");
            } else if (text.startsWith(childText)) {
              text = text.slice(childText.length).replace(/^\s*\n?/, "");
            }
            break;
          }
        }
      }

      // 3. Auto-detect from content
      if (!lang) {
        lang = detectLanguage(text);
      }

      // Strip trailing "Try" links (TypeScript playground links)
      text = text.replace(/\s*Try\s*$/, "");

      return `\n\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  let markdown = td.turndown(doc.body as any);

  // Convert standalone $ prompt + bare command into a fenced bash code block
  markdown = markdown.replace(
    /^[ \t]*\$[ \t]*\n+(.+)$/gm,
    "```bash\n$1\n```",
  );
  // Strip any remaining lone $ lines
  markdown = markdown.replace(/^[ \t]*\$[ \t]*$/gm, "");

  return markdown;
}

/**
 * Extract text from a code element, preserving line breaks.
 * Some sites wrap each line in <p>, <div>, or <br> — textContent
 * collapses these into a single line. This function inserts newlines
 * at block-element boundaries.
 */
function extractCodeText(node: Node): string {
  const blockTags = new Set(["P", "DIV", "BR", "LI", "TR"]);
  const lines: string[] = [];
  let currentLine = "";

  function walk(n: Node) {
    if (n.nodeType === 3) {
      // Text node
      currentLine += n.textContent || "";
    } else if (n.nodeType === 1) {
      const el = n as Element;
      // Skip anchor tags (e.g. "Try" playground links)
      if (el.nodeName === "A") return;
      if (blockTags.has(el.nodeName)) {
        // Flush current line before block element
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }
      }
      for (const child of Array.from(n.childNodes)) {
        walk(child);
      }
      if (blockTags.has(el.nodeName) && currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
    }
  }

  walk(node);
  if (currentLine) lines.push(currentLine);

  return lines.join("\n");
}

/** Best-effort language detection from code content */
function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // JSON: starts with { or [
  if (/^\s*[\{\[]/.test(trimmed) && /[\}\]]\s*$/.test(trimmed)) return "json";

  // HTML/XML: starts with < tag
  if (/^\s*<[a-zA-Z!]/.test(trimmed)) return "html";

  // YAML: key: value pattern, no braces
  if (/^\s*[\w-]+\s*:(?:\s|$)/m.test(trimmed) && !trimmed.includes("{")) return "yaml";

  // CSS: has selectors with { } and properties with :
  if (/[.#@]\w+.*\{[\s\S]*?:/.test(trimmed)) return "css";

  // SQL: common keywords
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(trimmed)) return "sql";

  // Python: def/import/class with colon, no semicolons
  if (/^\s*(def |import |from |class )/m.test(trimmed) && !trimmed.includes(";")) return "python";

  // Rust: fn/let mut/impl/pub fn
  if (/^\s*(fn |let mut |impl |pub fn |use std::)/m.test(trimmed)) return "rust";

  // Go: func/package/import with Go patterns
  if (/^\s*(func |package |import \()/m.test(trimmed)) return "go";

  // Bash/shell: shebang, common commands, $variables
  if (/^#!\/bin\/(ba)?sh/m.test(trimmed) || /^\s*(export |echo |if \[\[|npm |pnpm |yarn |git |cd |mkdir |curl )/m.test(trimmed)) return "bash";

  // TypeScript: import/export with types, interface, type
  if (/^\s*(interface |type \w+ =|export (interface|type))/m.test(trimmed)) return "typescript";

  // JavaScript/TypeScript: import/export/const/function with common patterns
  if (/^\s*(import |export |const |let |function |=>|require\()/m.test(trimmed)) return "javascript";

  return "";
}

/**
 * Extract content from a browser tab using Readability + Turndown.
 *
 * Injects a trivial function to grab the page HTML (no CSP issues),
 * then runs Readability + Turndown in the background service worker
 * using linkedom as the DOM parser (lightweight, no Node.js deps).
 */
export async function extractPageContent(
  browserTabId: number,
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: () => document.documentElement.outerHTML,
    });

    const rawHtml = results?.[0]?.result;
    if (!rawHtml || typeof rawHtml !== "string") return null;

    // Resolve relative URLs BEFORE parsing — linkedom resolves against extension origin
    const resolvedHtml = resolveRelativeUrls(rawHtml, url);

    const { document } = parseHTML(resolvedHtml);
    const article = new Readability(document as any).parse();
    if (!article || !article.content) return null;

    const markdown = htmlToMarkdown(article.content, url);
    if (!markdown.trim()) return null;

    return {
      title: article.title ?? "",
      byline: article.byline ?? null,
      content: markdown,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
    };
  } catch (e) {
    console.warn("[TabZen] Page content extraction failed:", e);
    return null;
  }
}

/**
 * Extract page content via fetch (no browser tab needed).
 * Falls back to this when the page isn't open in a tab.
 * Works for server-rendered pages; won't work for SPAs that require JS.
 */
export async function extractPageContentViaFetch(
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });

    if (!response.ok) return null;

    const rawHtml = await response.text();
    if (!rawHtml) return null;

    // Resolve relative URLs BEFORE parsing — linkedom resolves against extension origin
    const resolvedHtml = resolveRelativeUrls(rawHtml, url);

    const { document } = parseHTML(resolvedHtml);
    const article = new Readability(document as any).parse();
    if (!article || !article.content) return null;

    const markdown = htmlToMarkdown(article.content, url);
    if (!markdown.trim()) return null;

    return {
      title: article.title ?? "",
      byline: article.byline ?? null,
      content: markdown,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
    };
  } catch (e) {
    console.warn("[TabZen] Fetch extraction failed:", e);
    return null;
  }
}

/**
 * Get pending migrations for a tab based on its contentVersion.
 */
export function getPendingMigrations(tabContentVersion?: number): Migration[] {
  const currentVersion = tabContentVersion || 0;
  if (currentVersion >= CURRENT_CONTENT_VERSION) return [];
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  // If tab is behind current version but no specific migration entries exist,
  // return a default re-extract action so the banner still shows
  if (pending.length === 0 && currentVersion < CURRENT_CONTENT_VERSION) {
    return [{
      version: CURRENT_CONTENT_VERSION,
      actions: [{ type: "re-extract-content", behavior: "prompted", reason: "Content extraction improvements available" }],
    }];
  }
  return pending;
}
