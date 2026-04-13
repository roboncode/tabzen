// Re-export shared types so existing imports continue to work
import type { Page, Group, Capture, SyncPayload, AITemplate, AIDocument } from "@tab-zen/shared";
export type { Page, Group, Capture, SyncPayload, AITemplate, AIDocument };

export interface Settings {
  deviceId: string;
  sourceLabel: string;
  openRouterApiKey: string;
  aiModel: string;
  chatModel: string;
  chatCompression: boolean;
  groqApiKey: string;
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
  socialVoice: string;
  socialDefaultLength: "brief" | "standard" | "detailed" | "thread";
  socialHashtags: boolean;
  socialEngagementQuestion: boolean;
  socialHook: boolean;
  autoTagging: boolean;
  autoChapters: boolean;
  notchEnabled: boolean;
  notchSide: "left" | "right";
  dataSource: "local" | "service" | "auto";
}

export const DEFAULT_SETTINGS: Settings = {
  deviceId: "",
  sourceLabel: "Chrome - Default",
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || "",
  aiModel: "openai/gpt-4o-mini",
  chatModel: "openai/gpt-4o-mini",
  chatCompression: true,
  groqApiKey: import.meta.env.VITE_GROQ_API_KEY || "",
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
  socialVoice: "",
  socialDefaultLength: "standard",
  socialHashtags: true,
  socialEngagementQuestion: false,
  socialHook: true,
  autoTagging: true,
  autoChapters: true,
  notchEnabled: true,
  notchSide: "right",
  dataSource: "local" as const,
};

export interface AIGroupSuggestion {
  groupName: string;
  pageIds: string[];
}

export interface CapturePreviewData {
  captureId: string;
  groups: AIGroupSuggestion[];
  pages: Page[];
}

