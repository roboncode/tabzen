import { Hono } from "hono";
import { cors } from "hono/cors";

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

  await c.env.DB.exec(`CREATE TABLE IF NOT EXISTS tabs (
    id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL,
    favicon TEXT NOT NULL DEFAULT '', og_title TEXT, og_description TEXT,
    og_image TEXT, meta_description TEXT, notes TEXT,
    view_count INTEGER NOT NULL DEFAULT 0, last_viewed_at TEXT,
    captured_at TEXT NOT NULL, source_label TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0, starred INTEGER NOT NULL DEFAULT 0,
    group_id TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_token TEXT NOT NULL)`);

  await c.env.DB.exec(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, capture_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_token TEXT NOT NULL)`);

  await c.env.DB.exec(`CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY, captured_at TEXT NOT NULL,
    source_label TEXT NOT NULL DEFAULT '', tab_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_token TEXT NOT NULL)`);

  return c.json({ token });
});

app.post("/sync/verify", async (c) => {
  const token = await getToken(c);
  if (!token) return c.json({ valid: false }, 401);
  const valid = await validateToken(c.env.KV, token);
  return c.json({ valid });
});

app.post("/sync/push", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  if (body.tabs?.length) {
    for (const tab of body.tabs) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO tabs (id, url, title, favicon, og_title, og_description, og_image, meta_description, notes, view_count, last_viewed_at, captured_at, source_label, archived, starred, group_id, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          tab.archived ? 1 : 0,
          tab.starred ? 1 : 0,
          tab.groupId,
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

  const mapTab = (row: any) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    favicon: row.favicon,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImage: row.og_image,
    metaDescription: row.meta_description,
    notes: row.notes,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    capturedAt: row.captured_at,
    sourceLabel: row.source_label,
    archived: !!row.archived,
    starred: !!row.starred,
    groupId: row.group_id,
  });

  const mapGroup = (row: any) => ({
    id: row.id,
    name: row.name,
    captureId: row.capture_id,
    position: row.position,
    archived: !!row.archived,
  });

  const mapCapture = (row: any) => ({
    id: row.id,
    capturedAt: row.captured_at,
    sourceLabel: row.source_label,
    tabCount: row.tab_count,
  });

  return c.json({
    tabs: tabs.results.map(mapTab),
    groups: groups.results.map(mapGroup),
    captures: captures.results.map(mapCapture),
    lastSyncedAt: new Date().toISOString(),
  });
});

export default app;
