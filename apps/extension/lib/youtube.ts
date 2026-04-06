export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com") {
      return (u.pathname === "/watch" && u.searchParams.has("v")) ||
             u.pathname.startsWith("/shorts/");
    }
    if (host === "youtu.be") return u.pathname.length > 1;
    return false;
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v;
      const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return shortsMatch[1];
      return null;
    }
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    return null;
  } catch {
    return null;
  }
}

export function parseTimedTextXml(xml: string): { text: string; startMs: number; durationMs: number }[] {
  const segments: { text: string; startMs: number; durationMs: number }[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const startMs = Math.round(parseFloat(match[1]) * 1000);
    const durationMs = Math.round(parseFloat(match[2]) * 1000);
    const text = decodeXmlEntities(match[3].trim());
    if (text) {
      segments.push({ text, startMs, durationMs });
    }
  }

  return segments;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, " ")
    .trim();
}
