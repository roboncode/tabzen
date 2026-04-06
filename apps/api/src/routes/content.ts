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
  if (!tabId) {
    return c.json({ error: "tabId is required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const segments = await service.getTranscript(token, tabId);

  if (!segments) {
    return c.json({ error: "Transcript not found" }, 404);
  }

  return c.json({ segments });
});

export { content };
