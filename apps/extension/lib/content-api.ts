import type { TranscriptSegment } from "@tab-zen/shared";
import { getSettings } from "./settings";
import { extractVideoId } from "./youtube";

/**
 * Fetch transcript from the content-youtube API.
 * Used as fallback when the tab is not open in the browser.
 */
export async function fetchTranscriptFromApi(url: string): Promise<TranscriptSegment[] | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  const settings = await getSettings();

  // Content-youtube API URL
  const contentApiUrl = settings.syncEnv === "local"
    ? "http://localhost:5150"
    : "https://scraper-youtube.jombee.workers.dev";

  try {
    const response = await fetch(`${contentApiUrl}/videos/${videoId}/transcript`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json();

    // content-youtube returns segments as { text, start, duration } (seconds)
    // Map to our format { text, startMs, durationMs } (milliseconds)
    if (Array.isArray(data)) {
      return data.map((seg: any) => ({
        text: seg.text,
        startMs: Math.round((seg.start || seg.offset || 0) * 1000),
        durationMs: Math.round((seg.duration || 0) * 1000),
      }));
    }

    return null;
  } catch (e) {
    console.error("[TabZen] Content API transcript fetch failed:", e);
    return null;
  }
}

/**
 * Store transcript to the API's R2 storage.
 */
export async function storeTranscriptToApi(tabId: string, segments: TranscriptSegment[]): Promise<string | null> {
  const settings = await getSettings();
  const baseUrl = settings.syncEnv === "local" ? settings.syncLocalUrl : settings.syncUrl;
  const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}/content/transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ tabId, segments }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.contentKey || null;
  } catch (e) {
    console.error("[TabZen] Failed to store transcript to API:", e);
    return null;
  }
}

/**
 * Retrieve transcript from the API's R2 storage.
 */
export async function getTranscriptFromApi(tabId: string): Promise<TranscriptSegment[] | null> {
  const settings = await getSettings();
  const baseUrl = settings.syncEnv === "local" ? settings.syncLocalUrl : settings.syncUrl;
  const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}/content/transcript/${tabId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.segments || null;
  } catch {
    return null;
  }
}
