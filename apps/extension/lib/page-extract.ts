import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

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

/** Convert HTML string to markdown using Turndown. Runs in background service worker. */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  // Turndown uses `document` internally to parse HTML strings, which doesn't
  // exist in MV3 service workers. Parse with linkedom and pass the DOM node.
  // Wrap in <html><body> so linkedom places content in document.body.
  const { document: doc } = parseHTML(`<html><body>${html}</body></html>`);
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Preserve language info from <code class="language-xxx"> or auto-detect
  td.addRule("fencedCodeWithLang", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      node.firstChild !== null &&
      node.firstChild.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild as Element;
      const text = code.textContent || "";
      // Try class="language-xxx" or "lang-xxx" first
      const className = code.getAttribute("class") || "";
      const langMatch = className.match(/(?:language-|lang-)(\w+)/);
      const lang = langMatch ? langMatch[1] : detectLanguage(text);
      return `\n\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  return td.turndown(doc.body as any);
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
  console.log("[TabZen] extractPageContent called for:", url);

  if (!shouldExtractContent(url)) {
    console.log("[TabZen] Skipping extraction (filtered out):", url);
    return null;
  }

  try {
    // Inject a trivial function that returns the page HTML
    console.log("[TabZen] Injecting script into tab", browserTabId);
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: () => document.documentElement.outerHTML,
    });

    const rawHtml = results?.[0]?.result;
    if (!rawHtml || typeof rawHtml !== "string") {
      console.log("[TabZen] No HTML returned from tab", browserTabId);
      return null;
    }
    console.log("[TabZen] Got HTML:", rawHtml.length, "chars from", url);

    // Parse HTML in the service worker using linkedom + Readability
    const { document } = parseHTML(rawHtml);
    const article = new Readability(document as any).parse();

    if (!article || !article.content) {
      console.log("[TabZen] Readability returned no content for:", url);
      return null;
    }
    console.log("[TabZen] Readability extracted:", article.title, "—", article.content.length, "chars HTML");

    // Convert Readability's clean HTML to markdown
    const markdown = htmlToMarkdown(article.content);
    if (!markdown.trim()) {
      console.log("[TabZen] Turndown returned empty markdown for:", url);
      return null;
    }
    console.log("[TabZen] Content extracted:", url, "—", markdown.length, "chars markdown");

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
