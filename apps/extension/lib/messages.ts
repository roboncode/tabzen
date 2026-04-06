import type { CapturePreviewData, Tab } from "./types";

export type MessageRequest =
  | { type: "CAPTURE_ALL_TABS" }
  | { type: "CAPTURE_SINGLE_TAB"; tabId: number }
  | { type: "CONFIRM_CAPTURE"; captureData: CapturePreviewData }
  | { type: "GET_UNCAPTURED_COUNT" }
  | { type: "SEARCH_TABS"; query: string }
  | { type: "AI_SEARCH"; query: string }
  | { type: "OPEN_TAB"; tabId: string }
  | { type: "GET_METADATA"; url: string }
  | { type: "SYNC_NOW" }
  | { type: "QUICK_CAPTURE" };

export type MessageResponse =
  | { type: "CAPTURE_PREVIEW"; data: CapturePreviewData }
  | { type: "UNCAPTURED_COUNT"; count: number }
  | { type: "SEARCH_RESULTS"; tabs: Tab[] }
  | { type: "TAB_OPENED"; tab: Tab }
  | { type: "METADATA"; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; metaDescription: string | null }
  | { type: "ERROR"; message: string }
  | { type: "SUCCESS" }
  | { type: "SYNC_COMPLETE"; pushed: number; pulled: number }
  | { type: "QUICK_CAPTURE_DONE"; saved: number; skipped: number };

export function sendMessage(message: MessageRequest): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message);
}
