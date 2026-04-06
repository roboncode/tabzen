// Re-export shared types so existing imports continue to work
export type { Tab, Group, Capture, SyncPayload } from "@tab-zen/shared";

export interface Settings {
  deviceId: string;
  sourceLabel: string;
  openRouterApiKey: string;
  aiModel: string;
  syncEnabled: boolean;
  syncToken: string | null;
  syncLocalToken: string | null;
  syncUrl: string;
  syncLocalUrl: string;
  syncEnv: "local" | "remote";
  blockedDomains: string[];
  openMode: "new-tab" | "current-tab";
  syncError: string | null;
  viewMode: "cards" | "rows";
  activeFilter: "all" | "starred" | "notes" | "byDate" | "archived" | "duplicates" | "trash";
}

export const DEFAULT_SETTINGS: Settings = {
  deviceId: "",
  sourceLabel: "Chrome - Default",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  syncEnabled: false,
  syncToken: null,
  syncLocalToken: null,
  syncUrl: "",
  syncLocalUrl: "http://localhost:8787",
  syncEnv: "local",
  openMode: "new-tab",
  syncError: null,
  blockedDomains: [
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "baidu.com",
    "yandex.com",
    "search.brave.com",
    "newtab",
    "extensions",
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    "accounts.google.com",
    "login.microsoftonline.com",
    "auth0.com",
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "paypal.com",
    "localhost",
    "127.0.0.1",
    "chromewebstore.google.com",
  ],
  viewMode: "cards",
  activeFilter: "all",
};

export interface AIGroupSuggestion {
  groupName: string;
  tabIds: string[];
}

export interface CapturePreviewData {
  captureId: string;
  groups: AIGroupSuggestion[];
  tabs: Tab[];
}
