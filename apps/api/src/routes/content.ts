import { Hono } from "hono";
import type { Bindings } from "../lib/types";
import { requireAuth } from "../middleware/auth";
import { ContentService } from "../services/content-service";

const content = new Hono<{ Bindings: Bindings }>();

content.post("/transcript", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const { pageId, segments } = body;

  if (!pageId || !segments) {
    return c.json({ error: "pageId and segments are required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const contentKey = await service.storeTranscript(token, pageId, segments);
  return c.json({ contentKey });
});

content.get("/transcript/:pageId", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const pageId = c.req.param("pageId");
  if (!pageId) {
    return c.json({ error: "pageId is required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const segments = await service.getTranscript(token, pageId);

  if (!segments) {
    return c.json({ error: "Transcript not found" }, 404);
  }

  return c.json({ segments });
});

export { content };
