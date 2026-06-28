import { isYouTubeWatchUrl } from "@/lib/youtube";

export function parseOgFromHtml(html: string): {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  metaDescription: string | null;
} {
  const getMetaContent = (pattern: RegExp): string | null => {
    const match = html.match(pattern);
    return match?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">") || null;
  };

  return {
    ogTitle: getMetaContent(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i),
    ogDescription: getMetaContent(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i),
    ogImage: getMetaContent(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
      || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i),
    metaDescription: getMetaContent(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
  };
}

export function isMetadataIncomplete(page: { url: string; ogTitle: string | null; creator: string | null }): boolean {
  return isYouTubeWatchUrl(page.url) && !page.ogTitle && !page.creator;
}

/**
 * Whether a captured page still needs a metadata backfill — drives the
 * background auto-queue. A YouTube page with incomplete metadata (no ogTitle
 * and no creator) that the queue hasn't already attempted. Once attempted
 * (metadataCheckedAt set), it's no longer queued even if the fetch returned
 * nothing useful.
 */
export function needsMetadataBackfill(page: {
  url: string;
  ogTitle: string | null;
  creator: string | null;
  metadataCheckedAt?: string | null;
}): boolean {
  return isMetadataIncomplete(page) && !page.metadataCheckedAt;
}
