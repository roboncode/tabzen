# Milestone 1: YouTube Transcript Extraction — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Overview

Add YouTube transcript extraction to Tab Zen. Transcripts are captured from the browser during tab capture (free, no API calls), stored as raw segment JSON in R2, and viewable in the extension as a timestamped transcript. A fallback API path handles cases where the tab is no longer open.

This milestone also renames `sync-service` to `api` and restructures it with a clean service layer.

## Goals

- Capture YouTube transcripts automatically during tab capture (browser-first)
- Store raw transcript segments JSON in R2
- Display timestamped transcript in the extension
- Fallback to content-youtube API when the tab isn't open
- Rename and restructure sync-service into a well-organized API
- Local dev uses Wrangler R2 emulation (files on disk, inspectable)

## Non-Goals (Future Milestones)

- AI-generated markdown documents from transcripts (Milestone 3)
- KV caching layer (Milestone 7)
- Separate IndexedDB store for transcripts (Milestone 7)
- Web page content extraction (Milestone 2)
- Transcript search across all tabs (Milestone 6)

## Architecture

### Two Extraction Paths

**Browser path (primary):** During tab capture, the content script already runs on the YouTube page to extract OG metadata. In the same execution, it also extracts the transcript from `ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer`. The timedtext XML URL is fetched directly from the browser (same origin, no CORS). Transcript segments are returned alongside the existing metadata response.

**API path (fallback):** When the user clicks "Transcript" on a tab that has no stored transcript (captured before this feature existed, browser extraction failed, or tab is closed), the background worker calls the content-youtube API's `/videos/{id}/transcript` endpoint. The result is stored and displayed.

### Storage

- **Local:** Transcript segments stored as a JSON field on the tab record in IndexedDB (simple, no separate store)
- **Remote:** R2 bucket bound to the API worker. Raw segments stored as `{syncToken}/transcripts/{tabId}.json`
- **Sync push:** After pushing tab metadata to D1, transcript content is pushed to R2 via `/content/transcript` endpoint
- **Sync pull:** Tab metadata (including `contentKey`) syncs via D1. Actual transcript content fetched from R2 on demand when user clicks "Transcript"

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
│   ├── sync.ts             # /sync/* routes — thin, delegates to service
│   └── content.ts          # /content/* routes — thin, delegates to service
├── services/
│   ├── sync-service.ts     # Push/pull/status/init/verify business logic
│   └── content-service.ts  # R2 read/write for content
└── lib/
    └── types.ts            # Bindings interface (DB, KV, R2), route param types
```

Routes are thin glue — parse request, call service, return response. Services own business logic and interact with bindings (D1, KV, R2). No raw D1 queries in route handlers.

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
| `/content/transcript` | POST | Store transcript segments JSON to R2 |
| `/content/transcript/:tabId` | GET | Retrieve transcript segments from R2 |

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

If transcript extraction fails (no captions available, parsing error), the field is `null`. Transcript failure never blocks tab capture.

## Data Model Changes

### Tab Interface (in @tab-zen/shared)

Add three fields:

```typescript
contentKey: string | null;       // R2 path, e.g. "transcripts/{tabId}"
contentType: string | null;      // "transcript" | "article" | null
contentFetchedAt: string | null; // ISO timestamp
```

### Local Storage

Transcript segments stored directly on the tab record in IndexedDB as a `transcript` field. Simple, no separate store.

### D1 Schema

New migration:

```sql
ALTER TABLE tabs ADD COLUMN content_key TEXT;
ALTER TABLE tabs ADD COLUMN content_type TEXT;
ALTER TABLE tabs ADD COLUMN content_fetched_at TEXT;
```

### R2 Storage Layout

```
{syncToken}/
  transcripts/
    {tabId}.json    # Raw segments array [{text, startMs, durationMs}, ...]
```

## Extension UI

### Transcript Button

A "Transcript" button appears on YouTube tab cards (detected by URL containing `youtube.com/watch`).

Behavior:
1. Check if transcript exists locally on the tab record
2. **If yes:** display immediately
3. **If no:** show loading state → check if tab is open in browser → if yes, content script extracts → if no, API fallback → store → display

### Transcript Display

Timestamped segments displayed in a collapsible panel or modal (follow existing UI patterns). Features:

- Timestamped segments, each clickable to open YouTube at that point
- Copy full transcript to clipboard

### Error States

- **Loading:** spinner while fetching
- **No captions:** "No transcript available for this video"
- **Fallback failed:** "Couldn't fetch transcript. Try opening the video first."

## Capture Flow Changes

1. User captures tabs (existing flow)
2. Content script returns OG metadata + transcript segments (for YouTube tabs)
3. Background worker stores tab to IndexedDB with transcript data on the record
4. Tab record gets `contentKey`, `contentType: "transcript"`, `contentFetchedAt`
5. On sync push: tab metadata syncs to D1, transcript content pushed to R2 via `/content/transcript`

## Fallback Path

When user clicks "Transcript" on a tab with no stored transcript:

1. Check if tab's URL is currently open in the browser
2. **If open:** content script extracts transcript from the page
3. **If not open:** extract video ID from stored URL → call content-youtube API `/videos/{videoId}/transcript`
4. Store segments locally on tab record and push to R2 via API
5. Update tab with `contentKey`, `contentType`, `contentFetchedAt`
6. Display transcript

## Testing

### Unit Tests
- Transcript XML parsing (timedtext format → segments array)
- URL detection (is this a YouTube watch URL?)
- Video ID extraction from various YouTube URL formats
- Content service: R2 store/retrieve logic
- API restructure: existing sync behavior preserved

### Manual Testing
- Capture a YouTube tab → verify transcript extracted during capture
- View transcript on a captured YouTube tab
- Close tab → click "Transcript" → verify API fallback works
- Check `.wrangler/state/r2/` for stored files
- Verify sync push stores transcript to R2
