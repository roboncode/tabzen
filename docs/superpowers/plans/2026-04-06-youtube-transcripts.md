# YouTube Transcript Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture YouTube transcripts during tab capture (browser-first), store raw segments in R2, and display timestamped transcripts in the extension. Includes renaming sync-service to api with clean service layer.

**Architecture:** Content script extracts transcript from YouTube page during capture alongside OG metadata. Transcript segments stored locally on the tab record and pushed to R2 via the API. Fallback path calls content-youtube API for tabs no longer open. API restructured with routes/services separation.

**Tech Stack:** WXT, SolidJS, Hono, Cloudflare Workers, R2, D1, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-06-youtube-transcripts-design.md`

---

### Task 1: Add Content Fields to Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add content fields to Tab interface**

In `packages/shared/src/types.ts`, add three fields to the `Tab` interface after the `groupId` field:

```typescript
  groupId: string;
  contentKey: string | null;
  contentType: string | null;
  contentFetchedAt: string | null;
```

- [ ] **Step 2: Add TranscriptSegment interface**

Add below the `SyncPayload` interface in the same file:

```typescript
export interface TranscriptSegment {
  text: string;
  startMs: number;
  durationMs: number;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/extension && pnpm exec tsc --noEmit`
Run: `cd apps/sync-service && pnpm exec tsc --noEmit`

Both should pass. The new fields are nullable so existing code that creates Tab objects will fail — we fix that in the next steps.

- [ ] **Step 4: Fix Tab creation in background.ts**

In `apps/extension/entrypoints/background.ts`, find the `captureSingleTab` function (around line 1036). Add the new fields to the Tab object literal:

```typescript
    const tab: Tab = {
      id: uuidv4(),
      url,
      title,
      favicon,
      ...meta,
      tags: [],
      notes: null,
      viewCount: 0,
      lastViewedAt: null,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      deviceId: settings.deviceId,
      archived: false,
      starred: false,
      deletedAt: null,
      groupId,
      contentKey: null,
      contentType: null,
      contentFetchedAt: null,
    };
```

Do the same in `buildCapturePreview` (around line 853) — find every place a `Tab` object is constructed and add the three fields. Search for `groupId,` followed by `};` to find all Tab object literals.

- [ ] **Step 5: Fix Tab creation in test files**

Search `apps/extension/tests/` for Tab object literals and add the three new fields (all `null`).

Run: `cd apps/extension && pnpm run test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts apps/extension/
git commit -m "feat: add content fields to Tab type and TranscriptSegment interface"
```

---

### Task 2: Rename sync-service to api

**Files:**
- Rename: `apps/sync-service/` → `apps/api/`
- Modify: `apps/api/package.json`
- Modify: `apps/api/wrangler.toml`
- Modify: `package.json` (root)

- [ ] **Step 1: Rename the directory**

```bash
git mv apps/sync-service apps/api
```

- [ ] **Step 2: Update apps/api/package.json**

Change the name field:

```json
{
  "name": "api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@tab-zen/shared": "workspace:*",
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250327.0",
    "typescript": "^5.9.3",
    "wrangler": "^4.10.0"
  }
}
```

- [ ] **Step 3: Update root package.json scripts**

Replace all `sync-service` references with `api`:

```json
{
  "scripts": {
    "dev": "nx run extension:dev",
    "dev:api": "nx run api:dev",
    "dev:youtube": "nx run content-youtube:dev",
    "dev:tiktok": "nx run content-tiktok:dev",
    "build": "nx run-many --target=build",
    "test": "nx run-many --target=test",
    "deploy:api": "nx run api:deploy",
    "deploy:youtube": "nx run content-youtube:workers:deploy",
    "deploy:tiktok": "nx run content-tiktok:workers:deploy"
  }
}
```

- [ ] **Step 4: Reinstall to update workspace links**

```bash
pnpm install
```

- [ ] **Step 5: Verify NX sees the renamed project**

```bash
pnpm exec nx show projects
```

Expected: should list `api` instead of `sync-service`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename sync-service to api"
```

---

### Task 3: Restructure API with Service Layer

**Files:**
- Create: `apps/api/src/lib/types.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/services/sync-service.ts`
- Create: `apps/api/src/routes/sync.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create the Bindings type**

Create `apps/api/src/lib/types.ts`:

```typescript
export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  CONTENT: R2Bucket;
};
```

- [ ] **Step 2: Create auth middleware**

Create `apps/api/src/middleware/auth.ts`:

```typescript
import type { Context, Next } from "hono";
import type { Bindings } from "../lib/types";

export function getToken(c: Context<{ Bindings: Bindings }>): string | null {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function validateToken(kv: KVNamespace, token: string): Promise<boolean> {
  const value = await kv.get(`token:${token}`);
  return value !== null;
}

export async function requireAuth(c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> {
  const token = getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("token" as never, token);
  await next();
}
```

- [ ] **Step 3: Create sync service**

Create `apps/api/src/services/sync-service.ts`:

```typescript
import type { Tab, Group, Capture, SyncPayload } from "@tab-zen/shared";
import type { Bindings } from "../lib/types";

export class SyncService {
  constructor(private db: D1Database, private kv: KVNamespace) {}

  async init(): Promise<string> {
    const token = crypto.randomUUID();
    await this.kv.put(
      `token:${token}`,
      JSON.stringify({ createdAt: new Date().toISOString() }),
    );
    return token;
  }

  async verify(token: string): Promise<boolean> {
    const value = await this.kv.get(`token:${token}`);
    return value !== null;
  }

  async getStatus(token: string): Promise<{ lastUpdatedAt: string | null }> {
    const tab = await this.db.prepare(
      "SELECT MAX(updated_at) as last_updated FROM tabs WHERE sync_token = ?",
    ).bind(token).first();

    const group = await this.db.prepare(
      "SELECT MAX(updated_at) as last_updated FROM groups WHERE sync_token = ?",
    ).bind(token).first();

    const capture = await this.db.prepare(
      "SELECT MAX(updated_at) as last_updated FROM captures WHERE sync_token = ?",
    ).bind(token).first();

    const dates = [
      tab?.last_updated as string | null,
      group?.last_updated as string | null,
      capture?.last_updated as string | null,
    ].filter(Boolean).sort();

    return { lastUpdatedAt: dates.length ? dates[dates.length - 1]! : null };
  }

  async push(token: string, body: SyncPayload): Promise<void> {
    const now = new Date().toISOString();

    if (body.tabs?.length) {
      for (const tab of body.tabs) {
        await this.db.prepare(
          `INSERT OR REPLACE INTO tabs (id, url, title, favicon, og_title, og_description, og_image, meta_description, notes, view_count, last_viewed_at, captured_at, source_label, device_id, archived, starred, group_id, content_key, content_type, content_fetched_at, updated_at, sync_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            tab.id, tab.url, tab.title, tab.favicon || "",
            tab.ogTitle, tab.ogDescription, tab.ogImage, tab.metaDescription,
            tab.notes, tab.viewCount || 0, tab.lastViewedAt, tab.capturedAt,
            tab.sourceLabel || "", tab.deviceId || "",
            tab.archived ? 1 : 0, tab.starred ? 1 : 0,
            tab.groupId,
            tab.contentKey, tab.contentType, tab.contentFetchedAt,
            now, token,
          )
          .run();
      }
    }

    if (body.groups?.length) {
      for (const group of body.groups) {
        await this.db.prepare(
          `INSERT OR REPLACE INTO groups (id, name, capture_id, position, archived, updated_at, sync_token)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(group.id, group.name, group.captureId, group.position, group.archived ? 1 : 0, now, token)
          .run();
      }
    }

    if (body.captures?.length) {
      for (const capture of body.captures) {
        await this.db.prepare(
          `INSERT OR REPLACE INTO captures (id, captured_at, source_label, tab_count, updated_at, sync_token)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(capture.id, capture.capturedAt, capture.sourceLabel || "", capture.tabCount || 0, now, token)
          .run();
      }
    }

    if (body.settings) {
      await this.db.prepare(
        "INSERT OR REPLACE INTO settings (sync_token, ai_model, encrypted_api_key, updated_at) VALUES (?, ?, ?, ?)",
      )
        .bind(token, body.settings.aiModel || null, body.settings.encryptedApiKey || null, now)
        .run();
    }
  }

  async pull(token: string, since: string): Promise<SyncPayload> {
    const tabs = await this.db.prepare(
      "SELECT * FROM tabs WHERE sync_token = ? AND updated_at > ?",
    ).bind(token, since).all();

    const groups = await this.db.prepare(
      "SELECT * FROM groups WHERE sync_token = ? AND updated_at > ?",
    ).bind(token, since).all();

    const captures = await this.db.prepare(
      "SELECT * FROM captures WHERE sync_token = ? AND updated_at > ?",
    ).bind(token, since).all();

    const settingsRow = await this.db.prepare(
      "SELECT * FROM settings WHERE sync_token = ?",
    ).bind(token).first();

    return {
      tabs: tabs.results.map(this.mapTab),
      groups: groups.results.map(this.mapGroup),
      captures: captures.results.map(this.mapCapture),
      settings: settingsRow ? {
        aiModel: settingsRow.ai_model as string,
        encryptedApiKey: settingsRow.encrypted_api_key as string | null,
      } : undefined,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  private mapTab(row: Record<string, unknown>): Tab {
    return {
      id: row.id as string,
      url: row.url as string,
      title: row.title as string,
      favicon: row.favicon as string,
      ogTitle: row.og_title as string | null,
      ogDescription: row.og_description as string | null,
      ogImage: row.og_image as string | null,
      metaDescription: row.meta_description as string | null,
      creator: row.creator as string | null,
      creatorAvatar: row.creator_avatar as string | null,
      creatorUrl: row.creator_url as string | null,
      publishedAt: row.published_at as string | null,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      notes: row.notes as string | null,
      viewCount: row.view_count as number,
      lastViewedAt: row.last_viewed_at as string | null,
      capturedAt: row.captured_at as string,
      sourceLabel: row.source_label as string,
      deviceId: (row.device_id as string) || "",
      archived: !!row.archived,
      starred: !!row.starred,
      deletedAt: row.deleted_at as string | null,
      groupId: row.group_id as string,
      contentKey: row.content_key as string | null,
      contentType: row.content_type as string | null,
      contentFetchedAt: row.content_fetched_at as string | null,
    };
  }

  private mapGroup(row: Record<string, unknown>): Group {
    return {
      id: row.id as string,
      name: row.name as string,
      captureId: row.capture_id as string,
      position: row.position as number,
      archived: !!row.archived,
    };
  }

  private mapCapture(row: Record<string, unknown>): Capture {
    return {
      id: row.id as string,
      capturedAt: row.captured_at as string,
      sourceLabel: row.source_label as string,
      tabCount: row.tab_count as number,
    };
  }
}
```

- [ ] **Step 4: Create sync routes**

Create `apps/api/src/routes/sync.ts`:

```typescript
import { Hono } from "hono";
import type { Bindings } from "../lib/types";
import { getToken, requireAuth } from "../middleware/auth";
import { SyncService } from "../services/sync-service";

const sync = new Hono<{ Bindings: Bindings }>();

sync.post("/init", async (c) => {
  const service = new SyncService(c.env.DB, c.env.KV);
  const token = await service.init();
  return c.json({ token });
});

sync.post("/verify", async (c) => {
  const token = getToken(c);
  if (!token) return c.json({ valid: false }, 401);
  const service = new SyncService(c.env.DB, c.env.KV);
  const valid = await service.verify(token);
  return c.json({ valid });
});

sync.post("/status", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const service = new SyncService(c.env.DB, c.env.KV);
  const status = await service.getStatus(token);
  return c.json(status);
});

sync.post("/push", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const service = new SyncService(c.env.DB, c.env.KV);
  await service.push(token, body);
  return c.json({ success: true });
});

sync.post("/pull", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const service = new SyncService(c.env.DB, c.env.KV);
  const result = await service.pull(token, body.since || "1970-01-01T00:00:00Z");
  return c.json(result);
});

export { sync };
```

- [ ] **Step 5: Rewrite index.ts to mount routes**

Replace `apps/api/src/index.ts` entirely:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./lib/types";
import { sync } from "./routes/sync";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.route("/sync", sync);

export default app;
```

- [ ] **Step 6: Verify API compiles and existing behavior preserved**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: restructure API with service layer (routes/services/middleware)"
```

---

### Task 4: Add R2 Binding and Content Service

**Files:**
- Modify: `apps/api/wrangler.toml`
- Create: `apps/api/src/services/content-service.ts`
- Create: `apps/api/src/routes/content.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add R2 binding to wrangler.toml**

Append to `apps/api/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "CONTENT"
bucket_name = "tab-zen-content"
```

- [ ] **Step 2: Create content service**

Create `apps/api/src/services/content-service.ts`:

```typescript
import type { TranscriptSegment } from "@tab-zen/shared";

export class ContentService {
  constructor(private r2: R2Bucket) {}

  async storeTranscript(syncToken: string, tabId: string, segments: TranscriptSegment[]): Promise<string> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    await this.r2.put(key, JSON.stringify(segments), {
      httpMetadata: { contentType: "application/json" },
    });
    return `transcripts/${tabId}`;
  }

  async getTranscript(syncToken: string, tabId: string): Promise<TranscriptSegment[] | null> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    const object = await this.r2.get(key);
    if (!object) return null;
    return object.json();
  }

  async deleteTranscript(syncToken: string, tabId: string): Promise<void> {
    const key = `${syncToken}/transcripts/${tabId}.json`;
    await this.r2.delete(key);
  }
}
```

- [ ] **Step 3: Create content routes**

Create `apps/api/src/routes/content.ts`:

```typescript
import { Hono } from "hono";
import type { Bindings } from "../lib/types";
import { requireAuth } from "../middleware/auth";
import { ContentService } from "../services/content-service";

const content = new Hono<{ Bindings: Bindings }>();

content.post("/transcript", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const { tabId, segments } = body;

  if (!tabId || !segments) {
    return c.json({ error: "tabId and segments are required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const contentKey = await service.storeTranscript(token, tabId, segments);
  return c.json({ contentKey });
});

content.get("/transcript/:tabId", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const tabId = c.req.param("tabId");

  const service = new ContentService(c.env.CONTENT);
  const segments = await service.getTranscript(token, tabId);

  if (!segments) {
    return c.json({ error: "Transcript not found" }, 404);
  }

  return c.json({ segments });
});

export { content };
```

- [ ] **Step 4: Mount content routes in index.ts**

Update `apps/api/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./lib/types";
import { sync } from "./routes/sync";
import { content } from "./routes/content";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

app.route("/sync", sync);
app.route("/content", content);

export default app;
```

- [ ] **Step 5: Verify API compiles**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add R2 binding and content service for transcript storage"
```

---

### Task 5: Add D1 Migration for Content Fields

**Files:**
- Create: `apps/api/migrations/0002_content_fields.sql`

- [ ] **Step 1: Create the migration file**

Create `apps/api/migrations/0002_content_fields.sql`:

```sql
ALTER TABLE tabs ADD COLUMN content_key TEXT;
ALTER TABLE tabs ADD COLUMN content_type TEXT;
ALTER TABLE tabs ADD COLUMN content_fetched_at TEXT;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd apps/api && pnpm exec wrangler d1 migrations apply tab-zen-sync --local
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/
git commit -m "feat: add D1 migration for content fields on tabs"
```

---

### Task 6: YouTube Transcript Extraction in Content Script

**Files:**
- Create: `apps/extension/lib/youtube.ts`
- Modify: `apps/extension/entrypoints/content.ts`
- Create: `apps/extension/tests/youtube.test.ts`

- [ ] **Step 1: Write tests for YouTube URL utilities**

Create `apps/extension/tests/youtube.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isYouTubeWatchUrl, extractVideoId } from "@/lib/youtube";

describe("isYouTubeWatchUrl", () => {
  it("detects standard watch URLs", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeWatchUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("detects short URLs", () => {
    expect(isYouTubeWatchUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    expect(isYouTubeWatchUrl("https://www.google.com")).toBe(false);
    expect(isYouTubeWatchUrl("https://www.youtube.com/channel/UC123")).toBe(false);
    expect(isYouTubeWatchUrl("https://www.youtube.com/")).toBe(false);
  });
});

describe("extractVideoId", () => {
  it("extracts from standard watch URLs", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from short URLs", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractVideoId("https://www.google.com")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/extension && pnpm run test
```

Expected: FAIL — `@/lib/youtube` module not found.

- [ ] **Step 3: Create YouTube utilities**

Create `apps/extension/lib/youtube.ts`:

```typescript
export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com") return u.pathname === "/watch" && u.searchParams.has("v");
    if (host === "youtu.be") return u.pathname.length > 1;
    return false;
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host === "youtube.com") return u.searchParams.get("v");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    return null;
  } catch {
    return null;
  }
}

export function parseTimedTextXml(xml: string): { text: string; startMs: number; durationMs: number }[] {
  const segments: { text: string; startMs: number; durationMs: number }[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const startMs = Math.round(parseFloat(match[1]) * 1000);
    const durationMs = Math.round(parseFloat(match[2]) * 1000);
    const text = decodeXmlEntities(match[3].trim());
    if (text) {
      segments.push({ text, startMs, durationMs });
    }
  }

  return segments;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, " ")
    .trim();
}
```

- [ ] **Step 4: Add timedtext XML parsing tests**

Append to `apps/extension/tests/youtube.test.ts`:

```typescript
import { parseTimedTextXml } from "@/lib/youtube";

describe("parseTimedTextXml", () => {
  it("parses timedtext XML into segments", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0.0" dur="2.5">Hello world</text>
  <text start="2.5" dur="3.0">This is a test</text>
</transcript>`;
    const segments = parseTimedTextXml(xml);
    expect(segments).toEqual([
      { text: "Hello world", startMs: 0, durationMs: 2500 },
      { text: "This is a test", startMs: 2500, durationMs: 3000 },
    ]);
  });

  it("decodes XML entities", () => {
    const xml = `<transcript><text start="0" dur="1">It&apos;s &amp; it&lt;works&gt;</text></transcript>`;
    const segments = parseTimedTextXml(xml);
    expect(segments[0].text).toBe("It's & it<works>");
  });

  it("returns empty array for empty input", () => {
    expect(parseTimedTextXml("")).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/extension && pnpm run test
```

Expected: all tests pass.

- [ ] **Step 6: Extend content script for transcript extraction**

In `apps/extension/entrypoints/content.ts`, add a new `GET_TRANSCRIPT` message handler after the existing `GET_METADATA` handler (before the `return true;`):

```typescript
      if (message.type === "GET_TRANSCRIPT") {
        const hostname = window.location.hostname.replace("www.", "");
        if (hostname !== "youtube.com") {
          sendResponse({ type: "TRANSCRIPT", transcript: null });
          return;
        }

        try {
          // Find ytInitialPlayerResponse
          let playerResponse: any = null;
          const scripts = document.querySelectorAll("script");
          for (const script of scripts) {
            const text = script.textContent || "";
            const match = text.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (match) {
              playerResponse = JSON.parse(match[1]);
              break;
            }
          }

          if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            sendResponse({ type: "TRANSCRIPT", transcript: null });
            return;
          }

          const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

          // Prefer manual English captions, fall back to auto-generated, then any track
          const englishManual = tracks.find((t: any) => t.languageCode === "en" && t.kind !== "asr");
          const englishAuto = tracks.find((t: any) => t.languageCode === "en" && t.kind === "asr");
          const anyTrack = tracks[0];
          const track = englishManual || englishAuto || anyTrack;

          if (!track?.baseUrl) {
            sendResponse({ type: "TRANSCRIPT", transcript: null });
            return;
          }

          // Fetch the timedtext XML (same origin, no CORS issue)
          const response = await fetch(track.baseUrl);
          const xml = await response.text();

          // Parse the XML into segments
          const segments: { text: string; startMs: number; durationMs: number }[] = [];
          const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
          let m;
          while ((m = regex.exec(xml)) !== null) {
            const startMs = Math.round(parseFloat(m[1]) * 1000);
            const durationMs = Math.round(parseFloat(m[2]) * 1000);
            const text = m[3].trim()
              .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
              .replace(/\n/g, " ").trim();
            if (text) segments.push({ text, startMs, durationMs });
          }

          sendResponse({ type: "TRANSCRIPT", transcript: segments });
        } catch (e) {
          console.error("[TabZen] Transcript extraction failed:", e);
          sendResponse({ type: "TRANSCRIPT", transcript: null });
        }
      }
```

Also extend the `GET_METADATA` handler on YouTube pages to attempt transcript extraction in the same pass. After the existing YouTube-specific blocks (around line 88 after the `publishedAt` extraction), add:

```typescript
        // --- YouTube transcript extraction during capture ---
        let transcript: { text: string; startMs: number; durationMs: number }[] | null = null;
        if (hostname === "youtube.com" && window.location.pathname === "/watch") {
          try {
            let playerResponse: any = null;
            const allScripts = document.querySelectorAll("script");
            for (const script of allScripts) {
              const text = script.textContent || "";
              const match = text.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
              if (match) {
                playerResponse = JSON.parse(match[1]);
                break;
              }
            }

            if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
              const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
              const englishManual = tracks.find((t: any) => t.languageCode === "en" && t.kind !== "asr");
              const englishAuto = tracks.find((t: any) => t.languageCode === "en" && t.kind === "asr");
              const track = englishManual || englishAuto || tracks[0];

              if (track?.baseUrl) {
                const resp = await fetch(track.baseUrl);
                const xml = await resp.text();
                const segs: { text: string; startMs: number; durationMs: number }[] = [];
                const re = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
                let m;
                while ((m = re.exec(xml)) !== null) {
                  const startMs = Math.round(parseFloat(m[1]) * 1000);
                  const durationMs = Math.round(parseFloat(m[2]) * 1000);
                  const t = m[3].trim()
                    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
                    .replace(/\n/g, " ").trim();
                  if (t) segs.push({ text: t, startMs, durationMs });
                }
                transcript = segs.length > 0 ? segs : null;
              }
            }
          } catch (e) {
            console.error("[TabZen] Transcript extraction during capture failed:", e);
          }
        }
```

And include `transcript` in the `sendResponse` call at the end of the `GET_METADATA` handler:

```typescript
        sendResponse({
          type: "METADATA",
          ogTitle,
          ogDescription,
          ogImage,
          metaDescription,
          creator,
          creatorAvatar,
          creatorUrl,
          publishedAt,
          transcript,
        });
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add YouTube transcript extraction to content script"
```

---

### Task 7: Wire Transcript Into Capture Flow

**Files:**
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/lib/messages.ts`

- [ ] **Step 1: Update message types**

In `apps/extension/lib/messages.ts`, add `GET_TRANSCRIPT` to `MessageRequest`:

```typescript
  | { type: "GET_TRANSCRIPT"; tabId: number }
```

Add to `MessageResponse`:

```typescript
  | { type: "TRANSCRIPT"; transcript: { text: string; startMs: number; durationMs: number }[] | null }
```

- [ ] **Step 2: Update fetchMetadata return type and handling**

In `apps/extension/entrypoints/background.ts`, update the `fetchMetadata` function signature (around line 829) to include transcript in the return type:

```typescript
  async function fetchMetadata(browserTabId: number, url: string): Promise<{
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
    creator: string | null;
    creatorAvatar: string | null;
    creatorUrl: string | null;
    publishedAt: string | null;
    transcript?: { text: string; startMs: number; durationMs: number }[] | null;
  }> {
```

The content script now returns `transcript` in the `GET_METADATA` response, so no changes needed to how `fetchMetadata` calls the content script — the transcript field comes back automatically.

- [ ] **Step 3: Update captureSingleTab to store transcript**

In `captureSingleTab` (around line 1022), after `const meta = await fetchMetadata(browserTabId, url);`, update the tab creation to include transcript data:

```typescript
    const hasTranscript = meta.transcript && meta.transcript.length > 0;

    const tab: Tab = {
      id: uuidv4(),
      url,
      title,
      favicon,
      ...meta,
      tags: [],
      notes: null,
      viewCount: 0,
      lastViewedAt: null,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      deviceId: settings.deviceId,
      archived: false,
      starred: false,
      deletedAt: null,
      groupId,
      contentKey: hasTranscript ? `transcripts/${uuidv4()}` : null,
      contentType: hasTranscript ? "transcript" : null,
      contentFetchedAt: hasTranscript ? new Date().toISOString() : null,
    };
```

Note: The `...meta` spread includes the `transcript` field. We store the transcript data on the tab record directly in IndexedDB. The `contentKey` is set so we know this tab has content. The actual tab ID in the contentKey should use `tab.id` instead — fix:

```typescript
      contentKey: hasTranscript ? `transcripts/${tab.id}` : null,
```

Wait — `tab.id` is defined above as `uuidv4()`. Use a variable:

```typescript
    const tabId = uuidv4();
    const hasTranscript = meta.transcript && meta.transcript.length > 0;

    const tab: Tab = {
      id: tabId,
      // ... rest of fields
      contentKey: hasTranscript ? `transcripts/${tabId}` : null,
      contentType: hasTranscript ? "transcript" : null,
      contentFetchedAt: hasTranscript ? new Date().toISOString() : null,
    };
```

- [ ] **Step 4: Do the same for buildCapturePreview**

Find `buildCapturePreview` (around line 853). The bulk capture flow creates tabs in a loop. Apply the same pattern — check if `meta.transcript` exists and set the content fields accordingly. The `transcript` data from `meta` is spread onto the tab record via `...meta`.

- [ ] **Step 5: Add transcript to sync push**

The sync push already sends all tab data. Since transcript is stored directly on the tab record in IndexedDB, it gets synced automatically. However, the sync push should also push the transcript content to R2 separately. 

In the `syncPush` function (around line 55), after the existing push, add a content push for tabs with transcripts:

```typescript
  async function syncPush(): Promise<void> {
    try {
      if (!(await isSyncActive())) return;

      const data = await getAllData();
      await pushSync({
        tabs: data.tabs,
        groups: data.groups,
        captures: data.captures,
        lastSyncedAt: new Date().toISOString(),
      });

      // Push transcript content to R2 for tabs that have transcripts
      const settings = await getSettings();
      const baseUrl = settings.syncEnv === "local" ? settings.syncLocalUrl : settings.syncUrl;
      const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

      for (const tab of data.tabs) {
        if (tab.contentKey && tab.contentType === "transcript" && (tab as any).transcript) {
          try {
            await fetch(`${baseUrl}/content/transcript`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                tabId: tab.id,
                segments: (tab as any).transcript,
              }),
            });
          } catch (e) {
            console.warn("[TabZen] Failed to push transcript to R2:", e);
          }
        }
      }

      lastSyncedAt = new Date().toISOString();
      // ... rest of existing code
```

Note: The `(tab as any).transcript` cast is needed because `transcript` isn't on the shared `Tab` type — it's extension-local data stored on the IndexedDB record. This is intentional: the transcript content doesn't travel in the sync payload, it goes to R2 separately.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire transcript extraction into capture and sync flows"
```

---

### Task 8: Transcript Fallback via Content-YouTube API

**Files:**
- Create: `apps/extension/lib/content-api.ts`

- [ ] **Step 1: Create content API client**

Create `apps/extension/lib/content-api.ts`:

```typescript
import type { TranscriptSegment } from "@tab-zen/shared";
import { getSettings } from "./settings";
import { extractVideoId } from "./youtube";

/**
 * Fetch transcript from the content-youtube API.
 * Used as fallback when the tab is not open in the browser.
 */
export async function fetchTranscriptFromApi(url: string): Promise<TranscriptSegment[] | null> {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  const settings = await getSettings();

  // Try the content-youtube API
  // In production this would be a configured URL; for now use localhost
  const contentApiUrl = settings.syncEnv === "local"
    ? "http://localhost:5150"
    : "https://scraper-youtube.jombee.workers.dev";

  try {
    const response = await fetch(`${contentApiUrl}/videos/${videoId}/transcript`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json();

    // content-youtube returns segments as { text, start, duration }
    // Map to our format { text, startMs, durationMs }
    if (Array.isArray(data)) {
      return data.map((seg: any) => ({
        text: seg.text,
        startMs: Math.round((seg.start || seg.offset || 0) * 1000),
        durationMs: Math.round((seg.duration || 0) * 1000),
      }));
    }

    return null;
  } catch (e) {
    console.error("[TabZen] Content API transcript fetch failed:", e);
    return null;
  }
}

/**
 * Store transcript to the API's R2 storage.
 */
export async function storeTranscriptToApi(tabId: string, segments: TranscriptSegment[]): Promise<string | null> {
  const settings = await getSettings();
  const baseUrl = settings.syncEnv === "local" ? settings.syncLocalUrl : settings.syncUrl;
  const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}/content/transcript`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ tabId, segments }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.contentKey || null;
  } catch (e) {
    console.error("[TabZen] Failed to store transcript to API:", e);
    return null;
  }
}

/**
 * Retrieve transcript from the API's R2 storage.
 */
export async function getTranscriptFromApi(tabId: string): Promise<TranscriptSegment[] | null> {
  const settings = await getSettings();
  const baseUrl = settings.syncEnv === "local" ? settings.syncLocalUrl : settings.syncUrl;
  const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}/content/transcript/${tabId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.segments || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add GET_TRANSCRIPT handler to background worker**

In `apps/extension/entrypoints/background.ts`, add a handler in the message listener for `GET_TRANSCRIPT`:

```typescript
    if (request.type === "GET_TRANSCRIPT") {
      const tab = await getTab(request.tabId);
      if (!tab) return { type: "ERROR", message: "Tab not found" };

      // 1. Check if transcript is already stored locally
      if ((tab as any).transcript) {
        return { type: "TRANSCRIPT", transcript: (tab as any).transcript };
      }

      // 2. Try extracting from open browser tab
      const openTabs = await browser.tabs.query({ url: tab.url });
      if (openTabs.length > 0 && openTabs[0].id) {
        try {
          const response = await browser.tabs.sendMessage(openTabs[0].id, { type: "GET_TRANSCRIPT" });
          if (response?.transcript) {
            // Store locally
            await updateTab(tab.id, {
              contentKey: `transcripts/${tab.id}`,
              contentType: "transcript",
              contentFetchedAt: new Date().toISOString(),
            } as Partial<Tab>);
            // Store transcript on the record (extension-local)
            const dbTab = await getTab(tab.id);
            if (dbTab) {
              (dbTab as any).transcript = response.transcript;
              await import("@/lib/db").then(db => db.addTab ? db.addTab(dbTab) : null);
            }
            // Push to R2
            const { storeTranscriptToApi } = await import("@/lib/content-api");
            await storeTranscriptToApi(tab.id, response.transcript);

            notifyDataChanged();
            return { type: "TRANSCRIPT", transcript: response.transcript };
          }
        } catch {}
      }

      // 3. Fallback: content-youtube API
      const { fetchTranscriptFromApi, storeTranscriptToApi } = await import("@/lib/content-api");
      const segments = await fetchTranscriptFromApi(tab.url);
      if (segments) {
        await updateTab(tab.id, {
          contentKey: `transcripts/${tab.id}`,
          contentType: "transcript",
          contentFetchedAt: new Date().toISOString(),
        } as Partial<Tab>);
        const dbTab = await getTab(tab.id);
        if (dbTab) {
          (dbTab as any).transcript = segments;
          await import("@/lib/db").then(db => db.addTab ? db.addTab(dbTab) : null);
        }
        await storeTranscriptToApi(tab.id, segments);
        notifyDataChanged();
        return { type: "TRANSCRIPT", transcript: segments };
      }

      return { type: "TRANSCRIPT", transcript: null };
    }
```

Note: The `request.tabId` here is the Tab Zen tab ID (string), not the browser tab ID. Update the `GET_TRANSCRIPT` message type to use string:

In `messages.ts`, change:
```typescript
  | { type: "GET_TRANSCRIPT"; tabId: string }
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add transcript fallback via content-youtube API and R2 storage"
```

---

### Task 9: Transcript UI — Button and Display

**Files:**
- Create: `apps/extension/components/TranscriptViewer.tsx`
- Modify: `apps/extension/components/TabCard.tsx`

- [ ] **Step 1: Create TranscriptViewer component**

Create `apps/extension/components/TranscriptViewer.tsx`:

```typescript
import { createSignal, For, Show } from "solid-js";
import { FileText, Copy, Check, X } from "lucide-solid";
import type { TranscriptSegment } from "@tab-zen/shared";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  onClose: () => void;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTimestampUrl(videoUrl: string, ms: number): string {
  const seconds = Math.floor(ms / 1000);
  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}

export default function TranscriptViewer(props: TranscriptViewerProps) {
  const [copied, setCopied] = createSignal(false);

  const copyTranscript = () => {
    const text = props.segments
      .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="bg-slate-800/50 rounded-lg border border-slate-700/50 mt-2">
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span class="text-xs font-medium text-slate-400">
          Transcript ({props.segments.length} segments)
        </span>
        <div class="flex items-center gap-1">
          <button
            onClick={copyTranscript}
            class="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy transcript"
          >
            <Show when={copied()} fallback={<Copy size={14} />}>
              <Check size={14} class="text-green-400" />
            </Show>
          </button>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div class="max-h-64 overflow-y-auto p-3 space-y-1 text-sm">
        <For each={props.segments}>
          {(segment) => (
            <div class="flex gap-2 hover:bg-slate-700/30 rounded px-1 py-0.5 -mx-1">
              <a
                href={getTimestampUrl(props.videoUrl, segment.startMs)}
                target="_blank"
                class="text-sky-400 hover:text-sky-300 font-mono text-xs shrink-0 pt-0.5"
              >
                {formatTimestamp(segment.startMs)}
              </a>
              <span class="text-slate-300">{segment.text}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Transcript button to TabCard**

In `apps/extension/components/TabCard.tsx`, add the transcript functionality. This requires:

1. Import the new component and youtube utility:
```typescript
import { isYouTubeWatchUrl } from "@/lib/youtube";
import TranscriptViewer from "./TranscriptViewer";
```

2. Add `onTranscript` to `TabCardProps`:
```typescript
  onTranscript?: (tab: Tab) => void;
```

3. Add state and a "Transcript" button in the card actions area for YouTube tabs. The button triggers `props.onTranscript?.(props.tab)` and the parent component manages fetching and displaying.

The exact placement depends on the existing TabCard layout — add it alongside the existing action buttons (star, archive, delete, etc.).

- [ ] **Step 3: Wire transcript in TabCollection**

In `apps/extension/components/TabCollection.tsx`, add state for the transcript viewer:

```typescript
const [transcriptTab, setTranscriptTab] = createSignal<string | null>(null);
const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[] | null>(null);
const [transcriptLoading, setTranscriptLoading] = createSignal<string | null>(null);
```

Add a handler:

```typescript
async function handleTranscript(tab: Tab) {
  if (transcriptTab() === tab.id) {
    setTranscriptTab(null);
    setTranscriptSegments(null);
    return;
  }

  setTranscriptLoading(tab.id);
  try {
    const response = await sendMessage({ type: "GET_TRANSCRIPT", tabId: tab.id });
    if (response.type === "TRANSCRIPT" && response.transcript) {
      setTranscriptTab(tab.id);
      setTranscriptSegments(response.transcript);
    }
  } catch (e) {
    console.error("Failed to get transcript:", e);
  } finally {
    setTranscriptLoading(null);
  }
}
```

Pass `onTranscript={handleTranscript}` to `TabCard` components, and render `TranscriptViewer` below the card when `transcriptTab() === tab.id`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add transcript button and viewer UI to tab cards"
```

---

### Task 10: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd apps/extension && pnpm run test
```

Expected: all tests pass.

- [ ] **Step 2: TypeScript check all apps**

```bash
cd apps/extension && pnpm exec tsc --noEmit
cd apps/api && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Build extension**

```bash
cd apps/extension && pnpm run build
```

- [ ] **Step 4: Start API locally**

```bash
pnpm dev:api
```

Verify R2 emulation starts (look for `.wrangler/state/` directory creation).

- [ ] **Step 5: Test manually**

1. Load extension in Chrome
2. Open a YouTube video
3. Capture the tab
4. Open side panel — find the captured tab
5. Click "Transcript" button
6. Verify timestamped transcript appears
7. Click a timestamp — verify it opens YouTube at that point
8. Check `.wrangler/state/r2/` for stored transcript file

- [ ] **Step 6: Test fallback path**

1. Close the YouTube tab
2. Click "Transcript" on the card (for a tab captured before transcript support, or clear the local transcript)
3. Verify it fetches via the API fallback
4. Verify transcript displays

- [ ] **Step 7: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve issues from end-to-end transcript testing"
```
