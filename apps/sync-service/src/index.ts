import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Tab, Group, Capture, SyncPayload } from "@tab-zen/shared";

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

async function getToken(c: any): Promise<string | null> {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function validateToken(
  kv: KVNamespace,
  token: string,
): Promise<boolean> {
  const value = await kv.get(`token:${token}`);
  return value !== null;
}

app.post("/sync/init", async (c) => {
  const token = crypto.randomUUID();
  await c.env.KV.put(
    `token:${token}`,
    JSON.stringify({ createdAt: new Date().toISOString() }),
  );
  return c.json({ token });
});

app.post("/sync/verify", async (c) => {
  const token = await getToken(c);
  if (!token) return c.json({ valid: false }, 401);
  const valid = await validateToken(c.env.KV, token);
  return c.json({ valid });
});

app.post("/sync/status", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tab = await c.env.DB.prepare(
    "SELECT MAX(updated_at) as last_updated FROM tabs WHERE sync_token = ?",
  ).bind(token).first();

  const group = await c.env.DB.prepare(
    "SELECT MAX(updated_at) as last_updated FROM groups WHERE sync_token = ?",
  ).bind(token).first();

  const capture = await c.env.DB.prepare(
    "SELECT MAX(updated_at) as last_updated FROM captures WHERE sync_token = ?",
  ).bind(token).first();

  const dates = [
    tab?.last_updated as string | null,
    group?.last_updated as string | null,
    capture?.last_updated as string | null,
  ].filter(Boolean).sort();

  return c.json({
    lastUpdatedAt: dates.length ? dates[dates.length - 1] : null,
  });
});

app.post("/sync/push", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json() as SyncPayload;
  const now = new Date().toISOString();

  if (body.tabs?.length) {
    for (const tab of body.tabs) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO tabs (id, url, title, favicon, og_title, og_description, og_image, meta_description, notes, view_count, last_viewed_at, captured_at, source_label, device_id, archived, starred, group_id, content_key, content_type, content_fetched_at, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          tab.id,
          tab.url,
          tab.title,
          tab.favicon || "",
          tab.ogTitle,
          tab.ogDescription,
          tab.ogImage,
          tab.metaDescription,
          tab.notes,
          tab.viewCount || 0,
          tab.lastViewedAt,
          tab.capturedAt,
          tab.sourceLabel || "",
          tab.deviceId || "",
          tab.archived ? 1 : 0,
          tab.starred ? 1 : 0,
          tab.groupId,
          tab.contentKey,
          tab.contentType,
          tab.contentFetchedAt,
          now,
          token,
        )
        .run();
    }
  }

  if (body.groups?.length) {
    for (const group of body.groups) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO groups (id, name, capture_id, position, archived, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          group.id,
          group.name,
          group.captureId,
          group.position,
          group.archived ? 1 : 0,
          now,
          token,
        )
        .run();
    }
  }

  if (body.captures?.length) {
    for (const capture of body.captures) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO captures (id, captured_at, source_label, tab_count, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          capture.id,
          capture.capturedAt,
          capture.sourceLabel || "",
          capture.tabCount || 0,
          now,
          token,
        )
        .run();
    }
  }

  // Upsert settings
  if (body.settings) {
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO settings (sync_token, ai_model, encrypted_api_key, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(token, body.settings.aiModel || null, body.settings.encryptedApiKey || null, now)
      .run();
  }

  return c.json({ success: true });
});

app.post("/sync/pull", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const since = body.since || "1970-01-01T00:00:00Z";

  const tabs = await c.env.DB.prepare(
    "SELECT * FROM tabs WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  const groups = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  const captures = await c.env.DB.prepare(
    "SELECT * FROM captures WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  const mapTab = (row: Record<string, unknown>): Tab => ({
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
  });

  const mapGroup = (row: Record<string, unknown>): Group => ({
    id: row.id as string,
    name: row.name as string,
    captureId: row.capture_id as string,
    position: row.position as number,
    archived: !!row.archived,
  });

  const mapCapture = (row: Record<string, unknown>): Capture => ({
    id: row.id as string,
    capturedAt: row.captured_at as string,
    sourceLabel: row.source_label as string,
    tabCount: row.tab_count as number,
  });

  // Pull settings
  const settingsRow = await c.env.DB.prepare(
    "SELECT * FROM settings WHERE sync_token = ?",
  ).bind(token).first();

  const result: SyncPayload = {
    tabs: tabs.results.map(mapTab),
    groups: groups.results.map(mapGroup),
    captures: captures.results.map(mapCapture),
    settings: settingsRow ? {
      aiModel: settingsRow.ai_model as string,
      encryptedApiKey: settingsRow.encrypted_api_key as string | null,
    } : undefined,
    lastSyncedAt: new Date().toISOString(),
  };

  return c.json(result);
});

export default app;
