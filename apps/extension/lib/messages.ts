import type { CapturePreviewData, Page } from "./types";
import type { UncapturedTab } from "./tab-status";

export type MessageRequest =
  | { type: "CAPTURE_ALL_TABS" }
  | { type: "CAPTURE_PAGE"; tabId: number }
  | { type: "CONFIRM_CAPTURE"; captureData: CapturePreviewData }
  | { type: "GET_UNCAPTURED_COUNT" }
  | { type: "SEARCH_PAGES"; query: string }
  | { type: "AI_SEARCH"; query: string }
  | { type: "OPEN_PAGE"; pageId: string }
  | { type: "GET_METADATA"; url: string }
  | { type: "GET_TRANSCRIPT"; pageId: string }
  | { type: "GET_CONTENT"; pageId: string }
  | { type: "RE_EXTRACT_CONTENT"; pageId: string }
  | { type: "RE_EXTRACT_METADATA"; pageId: string }
  | { type: "BACKFILL_TRANSCRIPTS" }
  | { type: "COUNT_MISSING_TRANSCRIPTS" }
  | { type: "INDEX_COLLECTION" }
  | { type: "COUNT_PENDING_EMBEDS" }
  | { type: "SYNC_NOW" }
  | { type: "QUICK_CAPTURE" }
  | { type: "CAPTURE_URL"; url: string }
  | { type: "IS_URL_SAVED"; url: string }
  | { type: "LOOKUP_PRODUCT"; name: string }
  | { type: "LOOKUP_WIKI_IMAGE"; title: string }
  | { type: "GET_CAPTURED_TABS_COUNT" }
  | { type: "CLOSE_CAPTURED_TABS" }
  | { type: "GET_DUPLICATE_TABS_COUNT" }
  | { type: "CLOSE_DUPLICATE_TABS" }
  | { type: "GET_UNCAPTURED_TABS" }
  | { type: "FOCUS_TAB"; tabId: number };

export type MessageResponse =
  | { type: "CAPTURE_PREVIEW"; data: CapturePreviewData }
  | { type: "UNCAPTURED_COUNT"; count: number }
  | { type: "SEARCH_RESULTS"; pages: Page[] }
  | { type: "PAGE_OPENED"; page: Page }
  | { type: "METADATA"; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; metaDescription: string | null }
  | { type: "TRANSCRIPT"; transcript: { text: string; startMs: number; durationMs: number }[] | null }
  | { type: "CONTENT"; content: string | null }
  | { type: "BACKFILL_DONE"; fetched: number; failed: number; total: number }
  | { type: "MISSING_TRANSCRIPTS_COUNT"; count: number }
  | { type: "INDEX_DONE"; embedded: number; failed: number; total: number }
  | { type: "PENDING_EMBEDS_COUNT"; count: number }
  | { type: "ERROR"; message: string }
  | { type: "SUCCESS" }
  | { type: "METADATA_REFRESHED"; page: Page }
  | { type: "SYNC_COMPLETE"; pushed: number; pulled: number }
  | { type: "QUICK_CAPTURE_DONE"; saved: number; skipped: number }
  | { type: "URL_SAVED"; saved: boolean; pageId?: string }
  | { type: "PRODUCT_LOOKUP"; url: string | null; image: string | null; description: string | null }
  | { type: "WIKI_IMAGE"; url: string | null }
  | { type: "CAPTURED_TABS_COUNT"; count: number }
  | { type: "CLOSE_CAPTURED_TABS_DONE"; closed: number }
  | { type: "DUPLICATE_TABS_COUNT"; count: number }
  | { type: "CLOSE_DUPLICATE_TABS_DONE"; closed: number }
  | { type: "UNCAPTURED_TABS"; tabs: UncapturedTab[] };

export function sendMessage(message: MessageRequest): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message);
}
