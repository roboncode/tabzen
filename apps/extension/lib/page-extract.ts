import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";

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

/** Convert HTML string to markdown using Turndown. Runs in background script. */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return td.turndown(html);
}

/**
 * Parse raw HTML string into a Document using DOMParser.
 * Available in Chrome extension service workers.
 */
function parseHtml(html: string, url: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  // Set the documentURI for Readability's base URL resolution
  Object.defineProperty(doc, "documentURI", { value: url });
  return doc;
}

/**
 * Extract content from a browser tab using Readability + Turndown.
 *
 * Injects a trivial function to grab the page HTML (no CSP issues),
 * then runs Readability + Turndown in the background service worker
 * using DOMParser (available in service workers).
 */
export async function extractPageContent(
  browserTabId: number,
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    // Inject a trivial function that returns the page HTML
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: () => document.documentElement.innerHTML,
    });

    const rawHtml = results?.[0]?.result;
    if (!rawHtml || typeof rawHtml !== "string") return null;

    // Parse HTML and extract article in the service worker
    const doc = parseHtml(rawHtml, url);
    const article = new Readability(doc).parse();

    if (!article || !article.content) return null;

    // Convert Readability's clean HTML to markdown
    const markdown = htmlToMarkdown(article.content);
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
