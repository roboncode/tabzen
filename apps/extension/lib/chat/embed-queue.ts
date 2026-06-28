import { v4 as uuidv4 } from "uuid";
import type { Page, Chunk } from "@tab-zen/shared";
import { getAllPages, updatePage } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { mapWithConcurrency } from "@/lib/capture-utils";
import { createLocalChatAdapter } from "./local-chat-adapter";
import {
  chunkTranscript,
  chunkMarkdown,
  generateDocumentContext,
  type RawChunk,
} from "./rag/chunking";

// How many pages to embed at once. Mirrors the transcript queue's throttle —
// embeddings are network calls, so we keep the fan-out modest.
const EMBED_CONCURRENCY = 3;

/**
 * Stable, synchronous string hash (djb2) over a page's embeddable content.
 * The content type is folded in so a transcript and a markdown page with the
 * exact same text still hash differently (they chunk differently). Returned as
 * an unsigned base-36 string. Used to detect when content has changed since the
 * last embed so the queue can re-embed only what's stale.
 */
export function contentHashForPage(page: Page): string {
  let contentType: "transcript" | "markdown";
  let source: string;
  if (page.transcript?.length) {
    contentType = "transcript";
    source = page.transcript.map((s) => s.text).join(" ");
  } else {
    contentType = "markdown";
    source = page.content ?? "";
  }
  return djb2(`${contentType}:${source}`);
}

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + charCode, kept in 32-bit range via | 0
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Pages with extractable content for the knowledge base: a transcript or
 * markdown content, and not soft-deleted.
 */
export function embeddablePages(pages: Page[]): Page[] {
  return pages.filter((p) => !p.deletedAt && (p.transcript?.length || p.content));
}

/**
 * Embeddable pages still waiting on the embed queue: never embedded, or whose
 * content hash no longer matches the hash recorded at embed time (stale).
 */
export function pendingEmbedPages(pages: Page[]): Page[] {
  return embeddablePages(pages).filter(
    (p) => !p.embeddedAt || p.embedHash !== contentHashForPage(p),
  );
}

/** Count of pages the embed queue would process — drives the "Index (N)" UI. */
export function countPendingEmbeds(pages: Page[]): number {
  return pendingEmbedPages(pages).length;
}

// Guards the auto embed queue so only one drain runs at a time. Module-level
// (mirrors transcriptQueueRunning) so triggers from startup / interval / capture
// can't overlap.
let embedQueueRunning = false;

/**
 * Auto embed queue: chunks + embeds every pending page's content into the local
 * knowledge base, a few at a time. Re-queries each round so pages whose content
 * lands mid-run get picked up; stops when none remain. Skipped entirely when no
 * OpenRouter key is configured (the KB needs it). Guarded by embedQueueRunning
 * so only one drain runs at a time.
 */
export async function processEmbedQueue(): Promise<{
  embedded: number;
  failed: number;
  total: number;
}> {
  if (embedQueueRunning) return { embedded: 0, failed: 0, total: 0 };
  embedQueueRunning = true;
  let embedded = 0;
  let failed = 0;
  let total = 0;
  try {
    const settings = await getSettings();
    if (!settings.openRouterApiKey) {
      // No key → ingestion is skipped; the KB is surfaced as unavailable
      // elsewhere rather than spamming errors here.
      return { embedded, failed, total };
    }

    const adapter = await createLocalChatAdapter();
    // Tracks pages attempted in this drain so a page that errors isn't retried
    // within the same loop (it stays un-embedded and is retried on a later drain).
    const attempted = new Set<string>();

    for (;;) {
      const targets = pendingEmbedPages(await getAllPages()).filter(
        (p) => !attempted.has(p.id),
      );
      if (targets.length === 0) break;
      total += targets.length;
      console.log(`[TabZen] Embed queue: draining ${targets.length} pending page(s)`);

      await mapWithConcurrency(targets, EMBED_CONCURRENCY, async (page) => {
        attempted.add(page.id);
        try {
          let rawChunks: RawChunk[];
          let contentType: "transcript" | "markdown";
          let fullContent: string;
          if (page.transcript?.length) {
            rawChunks = chunkTranscript(page.transcript);
            contentType = "transcript";
            fullContent = page.transcript.map((s) => s.text).join(" ");
          } else {
            rawChunks = chunkMarkdown(page.content!);
            contentType = "markdown";
            fullContent = page.content!;
          }

          const ctx = generateDocumentContext({
            documentId: page.id,
            title: page.ogTitle || page.title,
            url: page.url,
            author: page.creator || undefined,
            capturedAt: page.capturedAt,
            contentType,
            fullContent,
          });

          const chunks: Chunk[] = [];
          for (const rc of rawChunks) {
            const embedding = await adapter.generateEmbedding(rc.text);
            chunks.push({
              chunkId: uuidv4(),
              documentId: page.id,
              text: rc.text,
              embedding,
              position: rc.position,
              metadata: rc.metadata,
            });
          }

          await adapter.storeDocumentContext(ctx);
          await adapter.storeChunks(page.id, chunks);
          await updatePage(page.id, {
            embeddedAt: new Date().toISOString(),
            embedHash: contentHashForPage(page),
          });
          // Broadcast progress so any open UI (pending count, KB state) refreshes.
          browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
          embedded++;
        } catch (e) {
          // Leave embeddedAt unset so the page retries on a later drain; the
          // `attempted` set prevents reprocessing within this same drain.
          console.warn("[TabZen] Embed failed for", page.url, e);
          failed++;
        }
      });
    }
  } finally {
    embedQueueRunning = false;
  }
  if (total > 0) {
    console.log(`[TabZen] Embed queue done: ${embedded} embedded, ${failed} failed (of ${total})`);
  }
  return { embedded, failed, total };
}
