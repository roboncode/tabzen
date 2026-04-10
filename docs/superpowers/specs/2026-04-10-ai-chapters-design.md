# AI-Generated Chapters & Capture Settings

## Overview

Generate chapter titles with timestamps for video transcripts using AI, and add settings toggles to control auto-tagging and auto-chapter generation on capture.

## Problems Solved

- Video transcripts render as a flat wall of text with no structure
- The "On this page" sidebar is empty for transcripts (no headings to extract)
- No way to quickly scan or navigate within a long transcript
- Auto-tagging and auto-chapters run unconditionally with no user control

## Data Model

### Page interface (packages/shared/src/types.ts)

New optional field:

```typescript
chapters?: { title: string; startMs: number }[]
```

Lightweight array stored inline on the Page object, same pattern as `transcript` and `tags`. `startMs` marks where each chapter begins in the video. No IDs needed — `startMs` is unique within a transcript.

### Settings interface (apps/extension/lib/types.ts)

Two new boolean fields:

```typescript
autoTagging: boolean      // default: true
autoChapters: boolean     // default: true
```

Both only take effect when `openRouterApiKey` is configured.

## AI Generation

### `generateChapters()` in `lib/ai.ts`

```typescript
async function generateChapters(
  apiKey: string,
  model: string,
  segments: TranscriptSegment[],
): Promise<{ title: string; startMs: number }[]>
```

- Sends transcript text with timestamps to OpenRouter
- Prompt instructs the model to identify 4-10 topic shifts and assign a short chapter title to each
- First chapter always starts at `startMs: 0`
- Returns chapters sorted by `startMs` ascending
- Uses `response_format: { type: "json_object" }` for reliable parsing

### Prompt design

The prompt receives the transcript as timestamped text (e.g., `[0:00] Hello everyone...`) and asks for chapters in JSON format:

```
{"chapters": [{"title": "Introduction", "startMs": 0}, {"title": "Setting Up the Project", "startMs": 185000}, ...]}
```

Rules in the prompt:
- 4-10 chapters depending on transcript length
- Short, descriptive titles (2-5 words)
- First chapter starts at 0
- Chapters mark genuine topic shifts, not arbitrary time splits

## Capture Integration

### Settings gate

Both capture flows check settings before running AI:

```typescript
if (settings.autoTagging && settings.openRouterApiKey) { /* tag */ }
if (settings.autoChapters && settings.openRouterApiKey && hasTranscript) { /* chapters */ }
```

### captureSingleTab

After saving the page and triggering tagging, if the page has a transcript and `autoChapters` is enabled, call `generateChapters()` asynchronously. Store result via `updatePage(id, { chapters })` and call `notifyDataChanged()`.

### QUICK_CAPTURE

Same pattern — during the background enrichment pass (Pass 2), after transcript extraction succeeds for a YouTube page, generate chapters if enabled. Runs in the existing async enrichment loop.

### Existing tagging

Wrap both tagging call sites (`captureSingleTab` and `QUICK_CAPTURE`) with a `settings.autoTagging` check. Currently tagging runs unconditionally when an API key exists.

## Transcript Rendering

### TranscriptView changes

`TranscriptView` receives a new optional prop:

```typescript
chapters?: { title: string; startMs: number }[]
```

When chapters are provided, the component inserts `<h2>` heading elements at the appropriate positions in the transcript. The logic:

1. For each chapter, find the first paragraph whose earliest segment `startMs` is >= the chapter's `startMs`
2. Insert an `<h2 id="chapter-{index}">` element before that paragraph
3. The heading contains the chapter title and a subtle timestamp label

The `id` attribute is critical — it's what the existing TOC extraction picks up. DetailPage's `createEffect` already scans for `h1[id], h2[id], h3[id]` in the scroll container and builds the sidebar TOC from them. No changes needed to DetailPage, DetailSidebar, or the TOC extraction logic.

### Chapter heading style

- `<h2>` level to match article heading hierarchy
- Title in foreground color, medium weight
- Timestamp label in muted color, smaller text, to the right or below
- Clickable timestamp links to the video at that point (same as existing transcript timestamps)

## Settings UI

Two new toggles in the **AI** tab of SettingsPanel:

```
Auto-tagging          [toggle]
Automatically generate tags when pages are captured.

Auto-chapters         [toggle]
Automatically generate chapter headings for video transcripts.
```

Both show beneath the API key and model selector. If no API key is configured, both toggles are disabled with a note.

## What's NOT in scope

- Manual chapter editing or reordering
- Chapter generation for non-transcript content (articles already have headings)
- Chapter thumbnails or preview images
- Regeneration UI (can be added later if needed)

## Testing Checklist

- [ ] Capture a YouTube video with autoChapters enabled → chapters appear in "On this page" sidebar
- [ ] Capture a YouTube video with autoChapters disabled → no chapters generated
- [ ] Capture a non-YouTube page → chapters not attempted (no transcript)
- [ ] Toggle autoTagging off → tags not generated on capture
- [ ] Toggle autoTagging on → tags generated as before
- [ ] Open a transcript with chapters → h2 headings visible in transcript body
- [ ] Click a chapter in "On this page" sidebar → scrolls to that chapter heading
- [ ] Narrow screen → chapters appear in the TOC dropdown
- [ ] Page reload preserves chapters (stored on Page model)
