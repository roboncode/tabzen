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
  tags: string[];
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
  contentKey: string | null;
  contentType: "transcript" | "markdown" | null;
  contentFetchedAt: string | null;
  contentVersion?: number;
  transcript?: TranscriptSegment[];
  content?: string;
}

export interface MigrationAction {
  type: "re-extract-content" | "regenerate-tags" | "regenerate-summary";
  behavior: "silent" | "prompted" | "destructive";
  reason: string;
}

export interface Migration {
  version: number;
  actions: MigrationAction[];
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

export interface SyncPayload {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  aiTemplates?: AITemplate[];
  aiDocuments?: AIDocument[];
  settings?: {
    aiModel: string;
    encryptedApiKey: string | null;
  };
  lastSyncedAt: string;
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  durationMs: number;
}

export interface AITemplate {
  id: string;
  name: string;
  prompt: string;
  isBuiltin: boolean;
  defaultPrompt: string | null;
  isEnabled: boolean;
  sortOrder: number;
  model: string | null;
}

export interface AIDocument {
  id: string;
  tabId: string;
  templateId: string;
  content: string;
  generatedAt: string;
  promptUsed: string;
  /** Hash of prompt + source content — used to detect staleness */
  sourceHash?: string;
}
