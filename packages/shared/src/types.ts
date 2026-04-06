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
  transcript?: TranscriptSegment[];
  content?: string;
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
