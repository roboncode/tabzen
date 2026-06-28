import { Hono } from "hono";
import type { Bindings } from "../lib/types";
import { requireAuth } from "../middleware/auth";

export const ai = new Hono<{ Bindings: Bindings }>();

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";

interface ChatRequestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Embeddings via the OpenAI API (server-side key). Body: { input: string }.
 * Returns { embedding: number[] } for the single input.
 */
ai.post("/embeddings", requireAuth, async (c) => {
  const body = await c.req.json<{ input?: string }>();
  if (!body.input || typeof body.input !== "string") {
    return c.json({ error: "Missing 'input' string" }, 400);
  }

  let openaiError: string | null = null;

  // Preferred: OpenAI text-embedding-3-small.
  if (c.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: body.input }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return c.json({ embedding: data.data[0].embedding, provider: "openai" });
    }
    openaiError = `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`;
  }

  // Fallback: OpenRouter (works when the OpenAI key is out of quota/billing).
  if (c.env.OPENROUTER_API_KEY) {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENROUTER_EMBEDDING_MODEL, input: body.input }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data: { embedding: number[] }[] };
      return c.json({ embedding: data.data[0].embedding, provider: "openrouter" });
    }
    return c.json(
      {
        error: "Both embedding providers failed",
        openai: openaiError,
        openrouter: `OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`,
      },
      502,
    );
  }

  return c.json({ error: "No embedding provider available", openai: openaiError }, 500);
});

/**
 * Chat completion via OpenRouter (server-side key), streamed straight through
 * as SSE. Body: { messages: ChatRequestMessage[]; model?: string }. The client
 * parses the same `data: {...}` SSE it would get from OpenRouter directly.
 */
ai.post("/chat", requireAuth, async (c) => {
  if (!c.env.OPENROUTER_API_KEY) {
    return c.json({ error: "OPENROUTER_API_KEY not configured" }, 500);
  }
  const body = await c.req.json<{ messages?: ChatRequestMessage[]; model?: string }>();
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "Missing 'messages'" }, 400);
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://tab-zen.app",
      "X-Title": "Tab Zen",
    },
    body: JSON.stringify({
      model: body.model || DEFAULT_CHAT_MODEL,
      messages: body.messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return c.json({ error: `Chat upstream ${upstream.status}`, details: await upstream.text() }, 502);
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
