/**
 * YouTube extraction logic — runs in the background service worker.
 * Uses chrome.scripting.executeScript with world: 'MAIN' to extract
 * data directly from the YouTube page's context (correct origin, cookies).
 *
 * Transcript is fetched by calling YouTube's InnerTube player endpoint
 * as an ANDROID client, which returns caption track URLs that serve
 * actual content (unlike WEB client URLs which return empty bodies).
 */

import { extractVideoId, formatDuration } from "./youtube";

export interface YouTubeExtractResult {
  title: string;
  channel: string;
  duration: number;
  videoId: string;
  transcript: string;
  url: string;
  wordCount: number;
  hasTranscript: boolean;
  suggestedTags: string[];
}

interface PageExtractData {
  title: string;
  channel: string;
  duration: number;
  videoId: string;
  description: string;
  transcriptXml: string | null;
  error?: string;
}

export async function extractYouTubeData(
  tabId: number,
  url: string,
): Promise<YouTubeExtractResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not determine YouTube video ID from the URL.");
  }

  console.log("[memze-yt] Starting extraction for", videoId, "on tab", tabId);

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: extractFromYouTubePage,
      args: [videoId],
    });
  } catch (scriptErr) {
    console.error("[memze-yt] executeScript failed:", scriptErr);
    throw new Error(
      `Script injection failed: ${scriptErr instanceof Error ? scriptErr.message : String(scriptErr)}`,
    );
  }

  const pageData: PageExtractData | undefined = results?.[0]?.result;
  if (!pageData) {
    console.error("[memze-yt] No result from injected script");
    throw new Error(
      "Failed to extract data from YouTube page — script returned no data.",
    );
  }
  if (pageData.error) {
    console.warn("[memze-yt] Page extraction error:", pageData.error);
  }

  const meta = {
    title: pageData.title,
    channel: pageData.channel,
    duration: pageData.duration,
    description: pageData.description,
  };

  // Parse XML in the background (no Trusted Types CSP here)
  const segments = pageData.transcriptXml
    ? parseTranscriptXml(pageData.transcriptXml)
    : [];
  const hasTranscript = segments.length > 0;

  let transcriptText: string;
  if (hasTranscript) {
    transcriptText = formatTranscriptMarkdown(meta, segments);
  } else {
    transcriptText = formatNoTranscriptMarkdown(meta);
  }

  const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

  const suggestedTags: string[] = [];
  const channelTag = meta.channel.toLowerCase().trim().slice(0, 30);
  if (channelTag) suggestedTags.push(channelTag);
  suggestedTags.push("youtube");

  return {
    title: meta.title,
    channel: meta.channel,
    duration: meta.duration,
    videoId: pageData.videoId,
    transcript: transcriptText,
    url,
    wordCount,
    hasTranscript,
    suggestedTags,
  };
}

/**
 * Injected into the YouTube page's MAIN world via chrome.scripting.executeScript.
 * MUST be fully self-contained — no references to outer scope / imports.
 *
 * Strategy: Call InnerTube player endpoint as ANDROID client to get caption
 * track URLs that actually serve content (WEB client URLs return empty bodies).
 * Then fetch the XML transcript and parse it into segments.
 */
async function extractFromYouTubePage(expectedVideoId: string) {
  try {
    // 1. Get API key from ytcfg
    const ytcfg = (window as any).ytcfg;
    let apiKey = ytcfg?.data_?.INNERTUBE_API_KEY || "";
    if (!apiKey) {
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        const match = (s.textContent || "").match(
          /"INNERTUBE_API_KEY":"([^"]+)"/,
        );
        if (match) {
          apiKey = match[1];
          break;
        }
      }
    }

    if (!apiKey) {
      return {
        title: document.title.replace(/ - YouTube$/, ""),
        channel: "Unknown",
        duration: 0,
        videoId: expectedVideoId,
        description: "",
        transcriptXml: null,
        error: "No INNERTUBE_API_KEY found",
      };
    }

    // 2. Call player endpoint as ANDROID client — returns fresh metadata
    //    AND working caption URLs (WEB URLs return empty bodies)
    const playerRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: { clientName: "ANDROID", clientVersion: "20.10.38" },
          },
          videoId: expectedVideoId,
        }),
      },
    );

    if (!playerRes.ok) {
      return {
        title: document.title.replace(/ - YouTube$/, ""),
        channel: "Unknown",
        duration: 0,
        videoId: expectedVideoId,
        description: "",
        transcriptXml: null,
        error: "ANDROID player endpoint returned " + playerRes.status,
      };
    }

    const playerJson = await playerRes.json();

    // 3. Get metadata from the ANDROID player response (always fresh,
    //    unlike ytInitialPlayerResponse which goes stale during SPA navigation)
    const vd = playerJson?.videoDetails;
    const title = vd?.title || document.title.replace(/ - YouTube$/, "");
    const channel = vd?.author || "Unknown";
    const duration = parseInt(vd?.lengthSeconds || "0", 10);
    const videoId = vd?.videoId || expectedVideoId;
    const description = vd?.shortDescription || "";

    const captionTracks =
      playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return {
        title,
        channel,
        duration,
        videoId,
        description,
        transcriptXml: null,
      };
    }

    // 4. Pick the best caption track (prefer English, then first available)
    let track = captionTracks.find(
      (t: any) => t.languageCode === "en" && t.kind !== "asr",
    );
    if (!track) {
      track = captionTracks.find((t: any) => t.languageCode === "en");
    }
    if (!track) {
      track = captionTracks[0];
    }

    // 5. Fetch the raw XML transcript and return it for background parsing
    const baseUrl = track.baseUrl.replace(/&fmt=[^&]+/, "");
    const xmlRes = await fetch(baseUrl);
    const xmlText = await xmlRes.text();

    return {
      title,
      channel,
      duration,
      videoId,
      description,
      transcriptXml: xmlText && xmlText.length > 0 ? xmlText : null,
      error:
        xmlText?.length === 0
          ? "Caption URL returned empty response"
          : undefined,
    };
  } catch (err: any) {
    return {
      title: document.title.replace(/ - YouTube$/, ""),
      channel: "Unknown",
      duration: 0,
      videoId: expectedVideoId,
      description: "",
      transcriptXml: null,
      error: err?.message || "Extraction failed",
    };
  }
}

// ---- Parsing & formatting (runs in background service worker) ----

function parseTranscriptXml(xml: string) {
  const segments: Array<{ text: string; offset: number; duration: number }> =
    [];
  const re =
    /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const start = parseFloat(m[1] || "0");
    const dur = parseFloat(m[2] || "0");
    const raw = m[3] || "";
    const decoded = raw
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_: string, n: string) =>
        String.fromCharCode(parseInt(n, 10)),
      );

    if (decoded.trim()) {
      segments.push({
        text: decoded.trim(),
        offset: start,
        duration: dur,
      });
    }
  }
  return segments;
}

interface VideoMeta {
  title: string;
  channel: string;
  duration: number;
  description: string;
}

function formatTranscriptMarkdown(
  meta: VideoMeta,
  segments: Array<{ text: string; offset: number; duration: number }>,
): string {
  const lines: string[] = [
    `# ${meta.title}`,
    "",
    `**Channel:** ${meta.channel} | **Duration:** ${formatDuration(meta.duration)}`,
    "",
    "---",
    "",
    "## Transcript",
    "",
  ];

  for (const seg of segments) {
    lines.push(`[${formatDuration(Math.round(seg.offset))}] ${seg.text}`);
  }

  return lines.join("\n");
}

function formatNoTranscriptMarkdown(meta: VideoMeta): string {
  const lines: string[] = [
    `# ${meta.title}`,
    "",
    `**Channel:** ${meta.channel} | **Duration:** ${formatDuration(meta.duration)}`,
    "",
    "---",
    "",
    "*No transcript available for this video.*",
  ];

  if (meta.description) {
    lines.push("", "## Description", "", meta.description);
  }

  return lines.join("\n");
}
