import { Hono } from "hono";
import type { Bindings } from "../lib/types";
import { getToken, requireAuth } from "../middleware/auth";
import { SyncService } from "../services/sync-service";
import type { SyncPayload } from "@tab-zen/shared";

export const sync = new Hono<{ Bindings: Bindings }>();

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
  const body = (await c.req.json()) as SyncPayload;
  const service = new SyncService(c.env.DB, c.env.KV);
  await service.push(token, body);
  return c.json({ success: true });
});

sync.post("/pull", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const since = body.since || "1970-01-01T00:00:00Z";
  const service = new SyncService(c.env.DB, c.env.KV);
  const result = await service.pull(token, since);
  return c.json(result);
});
