# M8 Finish: RAG Knowledge-Base Chat — Design Spec

**Date:** 2026-06-25
**Status:** Approved (Approach A)
**Builds on:** `docs/superpowers/specs/2026-04-10-knowledge-base-chat-design.md` (original M8 design)

## Context

M8's *document-scoped* chat (chat about one page, full content as context) is built and working in the extension. The *collection/knowledge-base* half — ingestion, vector retrieval, citations, and a cross-content chat surface — was designed and partially built in the throwaway `apps/chat` dev app but **never wired into the extension**. The extension's chat DB has no `chunks`/`documentContexts` stores, and no code chunks/embeds captured content or retrieves it before a chat call.

This spec finishes the knowledge-base half **locally** (Free tier), behind the existing `ChatDataAdapter` seam so Turso/managed tiers can be added later without touching ingestion, retrieval, or UI.

## Decisions (from brainstorming)

- **Scope model:** flexible toggle — chat across **all** content, **per-creator/author**, or **per-collection/tag** (reuses the built `ChatScopePicker`).
- **Ingestion:** **auto background embed-queue** (mirrors the transcript queue; resumes on service-worker startup) + a manual **"Index existing collection"** action for the backlog.
- **Surface:** a **new global `#/chat` route**. The existing per-page chat panel stays as-is (document-scoped, no retrieval).
- **Architecture:** Approach A — bring the RAG layer into the extension, store locally in IndexedDB, keep the `ChatDataAdapter` interface as the upgrade seam.

## Non-goals (this iteration)

- Turso / managed-Postgres adapters (interface preserved; not implemented).
- Light mode, AI-to-UI cards (deferred per original spec).
- TikTok-specific ingestion beyond whatever content already lands on a page.
- Cross-device sync of embeddings (local only).

---

## Architecture (Approach A)

**Pure RAG utilities** (no IndexedDB, framework-agnostic) live in `apps/extension/lib/chat/rag/`, ported from `apps/chat`:
- `chunking.ts` — `chunkTranscript(segments, {windowSeconds})`, `chunkMarkdown(md)`, `generateDocumentContext(page)`.
- `vector-store.ts` — `cosineSimilarity(a,b)`, `findTopK(queryEmbedding, entries, k)`.
- `embeddings.ts` — `generateEmbedding(text)` via OpenRouter (`text-embedding-3-small`, configurable).

**Storage:** extend `apps/extension/lib/chat/chat-db.ts` (v3 → **v4**), adding two object stores:
- `documentContexts` — key `documentId` (== page `id`); index `by-author`.
- `chunks` — key `chunkId`; index `by-documentId`.
Upgrade is additive; existing `conversations`/`conversationGroups`/`compressedContent`/`skills` stores are untouched.

**Adapter seam:** `LocalChatAdapter` (extension) implements the existing `ChatDataAdapter` (`packages/shared/src/chat-types.ts`): `storeDocumentContext`, `storeChunks`, `searchSimilar`, `getDocumentContext`, `generateEmbedding`, plus the conversation methods. **This is the upgrade hook** — a `TursoAdapter`/`ManagedAdapter` can replace it without changing ingestion, retrieval, or UI.

**Page → document mapping:** a captured page's `id` is the `documentId` (1:1). `DocumentContext` is derived from page metadata: `title`, `url`, `author` ← creator, `capturedAt`, `contentType`, `framingContent` = first ~500 chars of content.

---

## Ingestion — the embed queue

A background queue mirroring the transcript queue (`background.ts`):

- **Pending set:** pages that have extractable content (a `transcript` or markdown `content`) AND are not yet embedded / are stale.
- **Per page:** select content → chunk (transcript by ~120s windows with `timestampStart/End`; markdown by H1–H3 headings, fallback to paragraph groups with `sectionHeading`) → build `DocumentContext` → embed each chunk via OpenRouter → `storeDocumentContext` + `storeChunks`.
- **Triggers:** after capture (once content exists), on service-worker startup (resume), 5-min interval safety net, and a manual **"Index existing collection (N)"** button. Guarded by a module-level `embedQueueRunning` flag (same pattern as `transcriptQueueRunning`).
- **Staleness/dedup:** record `embeddedAt` + a content hash (or reuse `contentVersion`) per page; embed once, re-embed only when content changes. Skip already-embedded pages on startup.
- **Dependencies & cost:** a page is only embeddable once it has content, so ingestion rides behind the transcript/content queues. Embeddings are cheap (text-embedding-3-small ≈ hundredths of a cent per video). No OpenRouter key → ingestion is skipped and the KB is surfaced as unavailable (graceful, not error spam).

---

## Retrieval & citations

**Collection chat flow:**
1. Embed the user question (OpenRouter).
2. `searchSimilar(embedding, topK≈8, filters)` — cosine over `chunks`, filtered by scope.
3. Join each chunk's `DocumentContext` → `ChunkResult[]`.
4. Build a numbered **Sources** block (1..K: title · author · snippet), trimmed to a token budget via `chat-context-manager`.
5. Send `system prompt + Sources + conversation history + question` → stream the response.

**Scope filtering** (`ConversationScope.filters`): `all` → no filter; `creator` → filter by `author`; `collection` → by group; `tag` → by tag. Filter applied in `searchSimilar` before/with scoring.

**Citations:** the system prompt instructs the model to cite using bracketed indices `[1][2]` that map to the numbered Sources. After streaming, parse `[n]` references → construct `Citation{documentId, chunkId, title, snippet, url, timestamp}` from the retrieved set → attach to the assistant `ChatMessage` → render inline numbered chips + the existing `Source` cards below the answer. Clicking a citation deep-links to the page detail (`#/page/:id`), and for transcript sources appends the timestamp.

**Document-scoped chat** is unchanged (full content, no retrieval, no citations).

---

## `#/chat` UI

- **Route:** new `#/chat` in the SPA router (`entrypoints/index/`). Layout: collapsible `ConversationList` sidebar (grouped, count badges) + main `ChatContainer`/`Message`/`PromptInput`/`ScrollButton`; header with `ChatScopePicker` + `ModelSwitcher` (only if >1 model). All reuse `packages/chat` components — no new component-library work.
- **Entry point:** a "Chat"/"Ask" item in the main nav (`AppSidebar`/header).
- **Conversations** persist via the adapter (`conversations`/`conversationGroups` already exist). Titles auto-generated from the first user message (no LLM call), renamable.
- **Empty states:** nothing embedded → "Index your collection ({N})" prompt; retrieval empty → "no matching sources" note.

---

## Error handling & edge cases

- No OpenRouter key → ingestion skipped; `#/chat` shows a "configure your API key" state; per-page chat unaffected (it already requires the key).
- Embedding failure on a chunk → skip that chunk, mark page checked so the queue doesn't spin; log, no crash.
- Empty KB → prompt to index; never send an empty Sources block as if authoritative.
- Large collections → topK + token-budget cap; queue throttled (concurrency ≈ 3).
- Deleted pages → exclude from retrieval; prune their chunks/context on hard delete.
- Embedding dimension mismatch (model change) → store the model id with chunks; ignore/ re-embed mismatched vectors.

---

## Testing / verification (IVP)

- **Unit (vitest, no network):** chunking (transcript windows, markdown headings), `cosineSimilarity`/`findTopK`, scope-filter predicate, citation parsing (`[n]` → `Citation`). Use deterministic mock embeddings.
- **Integration:** ingest a sample page → `searchSimilar` returns it → citation maps back to the right chunk/timestamp.
- **Runtime:** build, load unpacked, run "Index existing collection", ask a question in `#/chat`, confirm a **cited** answer whose source links open the right page/timestamp. Evidence captured at each step before claiming done.

---

## Build order (phased, each verifiable)

1. **Storage + adapter** — chat-db v4 stores, `LocalChatAdapter`, ported pure utilities (+ unit tests).
2. **Ingestion** — embed queue + triggers + "Index existing" action (verify chunks/contexts land for the corpus).
3. **Retrieval + citations** — collection chat flow, scope filters, citation parse/render (+ tests).
4. **`#/chat` UI** — route, sidebar, scope picker, nav entry (reusing `packages/chat`).
5. **End-to-end runtime verification** + polish.

## Future upgrade path

`ChatDataAdapter` is unchanged, so the local store can be swapped for Turso (BYOD) or a managed Postgres/pgvector tier later with no changes to ingestion, retrieval, or the chat UI.
