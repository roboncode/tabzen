import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";

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
 * Injected function — runs inside the target page via executeScript.
 * MUST be fully self-contained (no imports, no outer-scope references).
 */
function runReadabilityOnPage(): {
  title: string;
  byline: string | null;
  content: string;
  excerpt: string | null;
  siteName: string | null;
} | null {
  try {
    // @ts-expect-error — Readability is injected via separate executeScript call
    const { Readability } = globalThis.__readability__;
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article || !article.content) return null;
    return {
      title: article.title,
      byline: article.byline,
      content: article.content,
      excerpt: article.excerpt,
      siteName: article.siteName,
    };
  } catch {
    return null;
  }
}

/**
 * Extract content from a browser tab using Readability + Turndown.
 * Injects Readability into the page, gets clean HTML, converts to markdown.
 */
export async function extractPageContent(
  browserTabId: number,
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    // First, inject Readability library into the page
    await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: (readabilityCode: string) => {
        const module = { exports: {} as any };
        const fn = new Function("module", "exports", readabilityCode);
        fn(module, module.exports);
        (globalThis as any).__readability__ = { Readability: module.exports.Readability || module.exports };
      },
      args: [await getReadabilitySource()],
    });

    // Then run the extraction
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: runReadabilityOnPage,
    });

    const articleData = results?.[0]?.result;
    if (!articleData || !articleData.content) return null;

    // Convert HTML to markdown in the background script
    const markdown = htmlToMarkdown(articleData.content);
    if (!markdown.trim()) return null;

    return {
      title: articleData.title,
      byline: articleData.byline,
      content: markdown,
      excerpt: articleData.excerpt,
      siteName: articleData.siteName,
    };
  } catch (e) {
    console.warn("[TabZen] Page content extraction failed:", e);
    return null;
  }
}

/** Cache the Readability source code so we don't re-read it on every extraction */
let readabilitySourceCache: string | null = null;

async function getReadabilitySource(): Promise<string> {
  if (readabilitySourceCache) return readabilitySourceCache;
  // Cast needed because WXT's PublicPath type is generated from the manifest
  // and doesn't include readability.js yet — it will exist at runtime
  const url = browser.runtime.getURL("readability.js" as any);
  const response = await fetch(url);
  readabilitySourceCache = await response.text();
  return readabilitySourceCache;
}
