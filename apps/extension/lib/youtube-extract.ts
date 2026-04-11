import { extractVideoId } from "./youtube";
import { parseTimedTextXml } from "./youtube";
import type { TranscriptSegment } from "@tab-zen/shared";

export interface YouTubeExtractResult {
  title: string;
  channel: string;
  duration: number;
  videoId: string;
  description: string;
  segments: TranscriptSegment[];
  hasTranscript: boolean;
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

/**
 * Extract YouTube transcript directly via InnerTube API — no tab needed.
 * Works from the background script or any context without a browser tab.
 */
export async function extractYouTubeTranscriptDirect(
  url: string,
): Promise<YouTubeExtractResult | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  try {
    // Use InnerTube API without an API key — works from service worker context
    const playerRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20250101.00.00",
              hl: "en",
            },
          },
          videoId,
        }),
      },
    );

    console.log("[TabZen] YT Direct: player response status:", playerRes.status);
    if (!playerRes.ok) return null;

    const playerJson = await playerRes.json();
    console.log("[TabZen] YT Direct: has videoDetails:", !!playerJson?.videoDetails, "has captions:", !!playerJson?.captions);
    const vd = playerJson?.videoDetails;
    const title = vd?.title || "";
    const channel = vd?.author || "Unknown";
    const duration = parseInt(vd?.lengthSeconds || "0", 10);
    const description = vd?.shortDescription || "";

    const captionTracks =
      playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return { title, channel, duration, videoId, description, segments: [], hasTranscript: false };
    }

    // Pick best caption track (prefer manual English, then auto English, then first)
    let track = captionTracks.find((t: any) => t.languageCode === "en" && t.kind !== "asr");
    if (!track) track = captionTracks.find((t: any) => t.languageCode === "en");
    if (!track) track = captionTracks[0];

    const baseUrl = track.baseUrl.replace(/&fmt=[^&]+/, "");
    const xmlRes = await fetch(baseUrl);
    const xmlText = await xmlRes.text();

    if (!xmlText || xmlText.length === 0) {
      return { title, channel, duration, videoId, description, segments: [], hasTranscript: false };
    }

    const segments = parseTimedTextXml(xmlText);
    return { title, channel, duration, videoId, description, segments, hasTranscript: segments.length > 0 };
  } catch {
    return null;
  }
}

/**
 * Extract YouTube video data including transcript from the background worker.
 * Uses chrome.scripting.executeScript with world: 'MAIN' to access YouTube's
 * page context and InnerTube API.
 */
export async function extractYouTubeTranscript(
  browserTabId: number,
  url: string,
): Promise<YouTubeExtractResult | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  let results;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      world: "MAIN",
      func: extractFromYouTubePage,
      args: [videoId],
    });
  } catch (e) {
    console.error("[TabZen] executeScript failed:", e);
    return null;
  }

  const pageData: PageExtractData | undefined = results?.[0]?.result;
  if (!pageData) return null;

  if (pageData.error) {
    console.warn("[TabZen] YouTube extraction warning:", pageData.error);
  }

  // Parse XML transcript in the background worker (no CSP issues here)
  const segments: TranscriptSegment[] = pageData.transcriptXml
    ? parseTimedTextXml(pageData.transcriptXml)
    : [];

  return {
    title: pageData.title,
    channel: pageData.channel,
    duration: pageData.duration,
    videoId: pageData.videoId,
    description: pageData.description,
    segments,
    hasTranscript: segments.length > 0,
  };
}

/**
 * Injected into the YouTube page's MAIN world via chrome.scripting.executeScript.
 * MUST be fully self-contained — no references to outer scope or imports.
 *
 * Strategy: Call InnerTube player endpoint as ANDROID client to get caption
 * track URLs that actually serve content (WEB client URLs return empty bodies).
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

    // 3. Get metadata from the ANDROID player response
    const vd = playerJson?.videoDetails;
    const title = vd?.title || document.title.replace(/ - YouTube$/, "");
    const channel = vd?.author || "Unknown";
    const duration = parseInt(vd?.lengthSeconds || "0", 10);
    const videoId = vd?.videoId || expectedVideoId;
    const description = vd?.shortDescription || "";

    const captionTracks =
      playerJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return { title, channel, duration, videoId, description, transcriptXml: null };
    }

    // 4. Pick the best caption track (prefer manual English, then auto English, then first)
    let track = captionTracks.find(
      (t: any) => t.languageCode === "en" && t.kind !== "asr",
    );
    if (!track) {
      track = captionTracks.find((t: any) => t.languageCode === "en");
    }
    if (!track) {
      track = captionTracks[0];
    }

    // 5. Fetch the raw XML transcript
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
      error: xmlText?.length === 0 ? "Caption URL returned empty response" : undefined,
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
