export interface Page {
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
  chapters?: { title: string; startMs: number }[];
  /**
   * When the auto transcript queue last *attempted* a fetch for this page
   * (local-only; not synced). Lets the UI distinguish "transcript pending"
   * from "checked, no captions available" so caption-less videos don't show
   * the pending indicator forever. Absent = never attempted.
   */
  transcriptCheckedAt?: string | null;
  /**
   * When the auto embed queue last successfully chunked + embedded this page's
   * content into the knowledge base (local-only; not synced). Absent = never
   * embedded. Paired with `embedHash` to detect staleness and skip re-embedding
   * unchanged content on startup.
   */
  embeddedAt?: string | null;
  /**
   * Stable content hash captured at the time of embedding (local-only; not
   * synced). When the page's embeddable content changes, this no longer matches
   * the freshly computed hash and the page is re-queued for embedding.
   */
  embedHash?: string | null;
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
  pages: Page[];
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
  pageId: string;
  templateId: string;
  content: string;
  generatedAt: string;
  promptUsed: string;
  /** Hash of prompt + source content — used to detect staleness */
  sourceHash?: string;
}
