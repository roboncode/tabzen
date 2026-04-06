export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  metaDescription: string | null;
  creator: string | null;
  creatorAvatar: string | null;
  creatorUrl: string | null;
  publishedAt: string | null;
  notes: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  capturedAt: string;
  sourceLabel: string;
  deviceId: string;
  archived: boolean;
  starred: boolean;
  deletedAt: string | null;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  captureId: string;
  position: number;
  archived: boolean;
}

export interface Capture {
  id: string;
  capturedAt: string;
  sourceLabel: string;
  tabCount: number;
}

export interface Settings {
  settingsVersion: number;
  deviceId: string;
  sourceLabel: string;
  openRouterApiKey: string;
  aiModel: string;
  aiGrouping: boolean;
  syncEnabled: boolean;
  syncToken: string | null;
  syncLocalToken: string | null;
  syncUrl: string;
  syncLocalUrl: string;
  syncEnv: "local" | "remote";
  blockedDomains: string[];
  openMode: "new-tab" | "current-tab";
  viewMode: "cards" | "rows";
  activeFilter: "all" | "starred" | "notes" | "byDate" | "archived" | "duplicates" | "trash";
}

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  settingsVersion: SETTINGS_VERSION,
  deviceId: "",
  sourceLabel: "Chrome - Default",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  aiGrouping: false,
  syncEnabled: false,
  syncToken: null,
  syncLocalToken: null,
  syncUrl: "",
  syncLocalUrl: "http://localhost:8787",
  syncEnv: "local",
  openMode: "new-tab",
  blockedDomains: [
    // Search engines
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "baidu.com",
    "yandex.com",
    "search.brave.com",
    // Browser pages
    "newtab",
    "extensions",
    // Email
    "mail.google.com",
    "outlook.live.com",
    "outlook.office.com",
    // Auth / accounts
    "accounts.google.com",
    "login.microsoftonline.com",
    "auth0.com",
    // Banking (generic patterns)
    "chase.com",
    "bankofamerica.com",
    "wellsfargo.com",
    "paypal.com",
    // Dev tools (usually temporary)
    "localhost",
    "127.0.0.1",
    // Extension / browser internal
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

export interface SyncPayload {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  settings?: {
    aiModel: string;
    encryptedApiKey: string | null;
  };
  lastSyncedAt: string;
}
