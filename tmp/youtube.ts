/** YouTube URL detection and helpers. */

const YT_WATCH_RE = /^https?:\/\/(?:www\.)?youtube\.com\/watch/;
const YT_SHORTS_RE = /^https?:\/\/(?:www\.)?youtube\.com\/shorts\//;

/** Returns true if the URL is a YouTube video or Shorts page. */
export function isYouTubeVideoUrl(url: string): boolean {
  return YT_WATCH_RE.test(url) || YT_SHORTS_RE.test(url);
}

/** Extracts the video ID from a YouTube URL, or null if not found. */
export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // /watch?v=VIDEO_ID
    const v = u.searchParams.get("v");
    if (v) return v;
    // /shorts/VIDEO_ID
    const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) return shortsMatch[1];
    return null;
  } catch {
    return null;
  }
}

/** Formats seconds into M:SS or H:MM:SS. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  }
  return `${m}:${ss}`;
}
