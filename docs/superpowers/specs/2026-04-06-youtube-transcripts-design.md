# Milestone 1: YouTube Transcript Extraction — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Overview

Add on-demand YouTube transcript extraction to Tab Zen. Transcripts are captured from the browser during tab capture (free, no API calls), stored in R2, and viewable in the extension. A fallback API path handles cases where the tab is no longer open.

This milestone also renames `sync-service` to `api` and restructures it with a clean service layer to support future feature additions.

## Goals

- Capture YouTube transcripts automatically during tab capture (browser-first)
- Store transcripts in R2 (raw JSON + rendered markdown)
- Display transcripts in the extension with timestamped segments
- Fallback to content-youtube API when the tab isn't open
- Rename and restructure sync-service into a well-organized API with service layer separation
- Local dev uses Wrangler R2 emulation (files on disk, inspectable)

## Architecture

### Two Extraction Paths

**Browser path (primary):** During tab capture, the content script already runs on the YouTube page to extract OG metadata. In the same execution, it also extracts the transcript from `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer`. The timedtext XML URL is fetched directly from the browser (same origin, no CORS). Transcript segments are returned alongside the existing metadata response.

**API path (fallback):** When the user clicks "Transcript" on a tab that has no stored transcript (e.g., captured before this feature, or browser extraction failed), the background worker calls the content-youtube API's `/videos/{id}/transcript` endpoint. The result is stored and displayed.

### Storage

- **Local:** Transcript data stored in IndexedDB alongside the tab record (or in a separate object store keyed by tab ID)
- **Remote:** R2 bucket bound to the API worker. Transcripts stored as files under `{syncToken}/transcripts/{tabId}.json` and `{syncToken}/transcripts/{tabId}.md`
- **Cache:** KV with 1-hour TTL for rendered markdown. Key: `content:{syncToken}:{tabId}`
- **Sync:** Transcript data included in the sync push/pull flow. On push, API stores to R2. On pull, transcript references are synced (the content itself is fetched from R2/KV on demand).

## API Restructure (sync-service → api)

### Rename

`apps/sync-service` becomes `apps/api`. Package name, wrangler config, NX project name, and root scripts all updated.

### Service Layer Architecture

```
apps/api/src/
├── index.ts                # Hono app, mounts route modules, CORS
├── middleware/
│   └── auth.ts             # Token extraction and validation against KV
├── routes/
│   ├── sync.ts             # /sync/* routes — thin, delegates to sync-service
│   └── content.ts          # /content/* routes — thin, delegates to content-service
├── services/
│   ├── sync-service.ts     # Push/pull/status/init/verify business logic
│   └── content-service.ts  # R2 storage, KV caching, content retrieval
└── lib/
    └── types.ts            # Bindings interface (DB, KV, R2), route param types
```

**Principle:** Routes are thin glue — parse request, call service, return response. Services own business logic and interact with bindings (D1, KV, R2). No raw D1 queries in route handlers.

### New Bindings

Add to `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "CONTENT"
bucket_name = "tab-zen-content"
```

Wrangler automatically emulates R2 locally. Files stored in `.wrangler/state/r2/` for inspection during development.

### New API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/content/transcript` | POST | Store transcript (raw JSON + markdown) to R2 |
| `/content/transcript/:tabId` | GET | Retrieve transcript from KV cache or R2 |

All content endpoints require the sync token in the Authorization header (same auth as sync endpoints).

## Content Script Changes

The existing `GET_METADATA` message handler in `content.ts` is extended for YouTube pages. After extracting OG metadata, it also:

1. Finds the `ytInitialPlayerResponse` script tag
2. Parses out `captions.playerCaptionsTracklistRenderer.captionTracks`
3. Selects the best caption track (prefer English manual captions, fall back to auto-generated)
4. Fetches the timedtext URL (XML format) directly from the browser
5. Parses XML into segments: `{ text: string, startMs: number, durationMs: number }[]`
6. Returns transcript segments as part of the metadata response

The metadata response type gains a new optional field:

```typescript
transcript?: { text: string; startMs: number; durationMs: number }[] | null;
```

If transcript extraction fails (no captions available, parsing error, etc.), the field is `null` and capture proceeds normally. Transcript failure never blocks tab capture.

## Data Model Changes

### Tab Interface (in @tab-zen/shared)

Add three fields:

```typescript
contentKey: string | null;       // R2 path prefix, e.g. "transcripts/{tabId}"
contentType: string | null;      // "transcript" | "article" | null
contentFetchedAt: string | null; // ISO timestamp
```

These fields are included in the existing sync push/pull payloads. The actual content is stored in R2, not in the sync payload itself.

### IndexedDB

The extension stores transcript data locally in a separate IndexedDB object store (`transcripts`) keyed by tab ID. This avoids bloating the main tabs store with large text content.

```typescript
interface StoredTranscript {
  tabId: string;
  segments: { text: string; startMs: number; durationMs: number }[];
  markdown: string;
  fetchedAt: string;
}
```

### D1 Schema

Add columns to the `tabs` table:

```sql
ALTER TABLE tabs ADD COLUMN content_key TEXT;
ALTER TABLE tabs ADD COLUMN content_type TEXT;
ALTER TABLE tabs ADD COLUMN content_fetched_at TEXT;
```

### R2 Storage Layout

```
{syncToken}/
  transcripts/
    {tabId}.json    # Raw segments array
    {tabId}.md      # Rendered markdown with timestamps
```

## Markdown Rendering

Raw transcript segments are rendered to markdown with timestamps:

```markdown
# Transcript: {video title}

**[0:00]** Welcome to today's video where we're going to talk about...

**[0:15]** The first thing you need to understand is...

**[1:02]** Now let's look at a practical example...
```

Timestamps formatted as `[M:SS]` or `[H:MM:SS]` for videos over an hour. Each timestamp block is a logical paragraph (consecutive segments grouped by natural pauses or sentence boundaries).

## Extension UI

### Transcript Button

A "Transcript" button appears on YouTube tab cards (detected by URL containing `youtube.com/watch`). One button, one behavior:

1. Check if transcript is stored locally (IndexedDB `transcripts` store)
2. **If yes:** display immediately
3. **If no:** show loading state → attempt browser extraction (if tab is open) → fallback to API → store locally and to API for R2 → display

The button text is always "Transcript". No "Get" vs "View" distinction.

### Transcript Viewer

Displays as a collapsible panel below the tab card or as a modal (follow existing UI patterns in the extension). Features:

- Timestamped segments, each clickable to open YouTube at that point
- Search/filter within transcript text
- Copy full transcript to clipboard
- Collapsible/expandable

### Loading & Error States

- **Loading:** spinner on the button while fetching
- **No captions available:** "No transcript available for this video" message
- **API fallback failed:** "Couldn't fetch transcript. Try opening the video first." message

## Capture Flow Changes

### Updated Capture Flow for YouTube Tabs

1. User captures tabs (existing flow)
2. Background worker sends `GET_METADATA` to content script for each tab
3. Content script returns OG metadata + transcript segments (for YouTube tabs)
4. Background worker stores tab to IndexedDB (existing)
5. Background worker stores transcript to IndexedDB `transcripts` store (new)
6. Tab record gets `contentKey`, `contentType: "transcript"`, `contentFetchedAt` (new)
7. On next sync push: tab metadata syncs to D1, transcript content pushed to R2 via `/content/transcript` endpoint

### Sync Push Extension

The sync push flow is extended: after pushing tabs/groups/captures to D1, the API checks for tabs with `contentKey` set. For each, the extension includes transcript data in the push payload (or a separate batch endpoint). The API stores to R2.

To keep the sync payload reasonable, transcripts are synced separately from tab metadata — either as a follow-up request or via a dedicated `/content/sync` batch endpoint.

### Sync Pull Extension

On pull, tab metadata includes `contentKey` and `contentFetchedAt`. The actual transcript content is NOT included in the pull payload (it could be large). Instead, the extension fetches transcripts on demand from `/content/transcript/:tabId` when the user clicks "Transcript".

## Fallback Path Detail

When the user clicks "Transcript" on a tab with no stored transcript:

1. Background worker checks if the tab's URL is currently open in the browser
2. **If open:** sends `GET_TRANSCRIPT` message to the content script on that tab → parses and returns segments
3. **If not open:** extracts the video ID from the stored URL → calls content-youtube API `/videos/{videoId}/transcript` → returns segments
4. Background worker generates markdown from segments
5. Stores both raw JSON and markdown locally (IndexedDB) and remotely (API → R2)
6. Updates tab record with `contentKey`, `contentType`, `contentFetchedAt`
7. Returns transcript to UI for display

## Configuration

No new user-facing configuration. The content-youtube API URL is either:
- The same API URL used for sync (recommended — single backend)
- Or a separate environment variable if the content APIs are deployed independently

For this milestone, the content-youtube service is called directly by the background worker as a fallback. The API (formerly sync-service) handles R2 storage. The background worker knows both URLs.

## Testing

### Unit Tests
- Transcript XML parsing (timedtext format → segments array)
- Markdown rendering from segments
- URL detection (is this a YouTube watch URL?)
- Video ID extraction from various YouTube URL formats
- Content service: R2 store/retrieve logic
- Sync service refactoring: existing sync tests still pass

### Integration Testing (Manual)
- Capture a YouTube tab → verify transcript extracted during capture
- View transcript on a captured YouTube tab
- Close the tab → click "Transcript" on the card → verify API fallback works
- Check `.wrangler/state/r2/` for stored files
- Verify sync push includes transcript data
- Verify sync pull on another browser retrieves transcript on demand

## Out of Scope

- Web page content extraction (Milestone 2)
- AI summaries (Milestone 3)
- TikTok transcript extraction (future — same pattern, different content script)
- Transcript search across all tabs (future — will come with vector embeddings)
- Transcript editing
