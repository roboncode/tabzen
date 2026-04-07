import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { Window } from "happy-dom";

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
 * Extract content from a browser tab using Readability + Turndown.
 *
 * Injects a trivial function to grab the page HTML (no CSP issues),
 * then runs Readability + Turndown in the background service worker
 * using happy-dom as the DOM parser (DOMParser is not available in
 * MV3 service workers).
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

    // Parse HTML in the service worker using happy-dom + Readability
    const window = new Window({ url });
    window.document.documentElement.innerHTML = rawHtml;

    const article = new Readability(window.document as any).parse();
    window.close();

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
