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
  blockedDomains: [],
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
