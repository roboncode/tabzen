import { extractVideoId, isYouTubeWatchUrl } from "./youtube";

/**
 * Minimal shape of a browser tab needed to decide whether it's safe to
 * inject into. Structurally compatible with the webextension Tab type.
 */
export interface InjectableTabInfo {
  id?: number;
  discarded?: boolean;
  status?: string;
}

/**
 * Whether it's safe to run executeScript / sendMessage against this tab.
 *
 * The critical guard: a *discarded* tab has been unloaded by Chrome to save
 * memory. Touching it (executeScript/sendMessage) forces a full reload, and a
 * fresh page load autoplays media (e.g. YouTube). Doing that across dozens of
 * background tabs is what locks up the browser. We only inject into tabs that
 * are already awake and finished loading — the active tab always qualifies.
 */
export function isInjectableTab<T extends InjectableTabInfo>(
  tab: T,
): tab is T & { id: number } {
  return typeof tab.id === "number" && tab.discarded !== true && tab.status !== "loading";
}

/**
 * Async map with a hard concurrency limit. Results preserve input order.
 * Replaces `Promise.all(items.map(...))` so we never fan out heavy per-tab
 * work (script injection, network) across every tab at once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * YouTube thumbnail URL derived purely from the video id — no tab interaction.
 * Lets discarded YouTube tabs get a preview image without waking them.
 */
export function youtubeThumbnailUrl(url: string): string | null {
  const videoId = extractVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

/**
 * Whether a captured page is still waiting on its transcript — drives the
 * "pending" (grayscale + queue badge) treatment in the UI. Mirrors the
 * background queue's selection: a YouTube page with no transcript that the
 * queue hasn't attempted yet. Once attempted (transcriptCheckedAt set), it's
 * no longer pending even if the video had no captions.
 */
export function isTranscriptPending(page: {
  url: string;
  transcript?: unknown;
  transcriptCheckedAt?: string | null;
  deletedAt?: string | null;
}): boolean {
  return (
    isYouTubeWatchUrl(page.url) &&
    !page.transcript &&
    !page.transcriptCheckedAt &&
    !page.deletedAt
  );
}
