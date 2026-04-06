# Milestone 3: Unified Content View with Web Page Extraction

**Date:** 2026-04-06
**Status:** Approved

## Overview

Replace the tab-based detail page (Transcript / Summary / Content pills) with a unified content view that renders the appropriate content type automatically. Add web page content extraction for non-YouTube pages, stored locally as markdown on the Tab object — mirroring the existing transcript pattern.

## Goals

- Extract web page content (articles, blog posts, docs) as clean markdown during tab capture
- Store markdown locally on the Tab object in IndexedDB (R2 sync deferred)
- Unify the detail page into a single content area that adapts by content type
- Restore the scroll-reveal compact header (thumbnail + title in action bar)

## Data Model

### Tab Interface Changes (`packages/shared/src/types.ts`)

Add typed optional fields and narrow the `contentType` union:

```typescript
export interface Tab {
  // ... existing fields ...
  contentKey: string | null;
  contentType: "transcript" | "markdown" | null;  // narrowed from string | null
  contentFetchedAt: string | null;
  transcript?: TranscriptSegment[];  // formalized (was untyped, accessed via "as any")
  content?: string;                  // NEW: extracted markdown
}
```

**Migration:** No IndexedDB schema migration needed — these are optional fields on an existing object store. Existing tabs without these fields continue to work (undefined values).

### Content Type Semantics

| URL Type | contentType | Stored Field | contentKey Pattern |
|----------|------------|-------------|-------------------|
| YouTube | `"transcript"` | `tab.transcript` | `transcripts/{tabId}` |
| Article/blog/docs | `"markdown"` | `tab.content` | `content/{tabId}` |
| Blocked domain | `null` | — | — |

A tab has at most one content type. YouTube tabs get transcripts; everything else gets markdown.

## Extraction Flow

### Architecture

Use `browser.scripting.executeScript()` to inject extraction logic on-demand — same pattern as YouTube transcript extraction. Two libraries:

- **@mozilla/readability** (~15KB) — runs injected in the page, needs DOM access. Extracts article content from messy HTML.
- **turndown** (~30KB) — runs in the background script. Converts Readability's clean HTML output to markdown.

### Capture Flow (Auto-Extract)

During `buildCapturePreview()`, `captureSingleTab()`, and `handleQuickCapture()`:

1. For each tab, check URL:
   - `isYouTubeWatchUrl(url)` → extract transcript (existing)
   - Not YouTube, not blocked domain → **`extractPageContent(tabId, url)`** (new)
2. `extractPageContent()`:
   - Calls `browser.scripting.executeScript({ target: { tabId }, func: runReadability })`
   - Injected function clones the document, runs `new Readability(clone).parse()`
   - Returns `{ title, byline, content (HTML), textContent, excerpt, siteName }`
3. Background script converts HTML to markdown via Turndown
4. Stores result: `tab.content = markdown`, `tab.contentType = "markdown"`, `tab.contentKey = "content/{tabId}"`, `tab.contentFetchedAt = now`

### On-Demand Flow (`GET_CONTENT` Message)

New message handler mirroring `GET_TRANSCRIPT`:

1. Check if `tab.content` exists in IndexedDB → return it
2. Try to find an open browser tab with matching URL → inject Readability & extract
3. Return null (tab not open, no cached content)

No API fallback — that comes with R2 sync in a future milestone.

### New File: `apps/extension/lib/page-extract.ts`

```typescript
export interface PageExtractResult {
  title: string;
  byline: string | null;
  content: string;       // markdown
  excerpt: string | null;
  siteName: string | null;
}

export async function extractPageContent(
  tabId: number,
  url: string,
): Promise<PageExtractResult | null>
```

Handles the executeScript call, Readability injection, and Turndown conversion.

### URL Filtering

Content extraction skips:
- YouTube URLs (handled by transcript extraction)
- Blocked domains from settings (search engines, login pages, banks, etc.)
- `chrome://`, `chrome-extension://`, `about:` URLs
- URLs that fail extraction (Readability returns null for non-article pages)

## Detail Page UI Changes

### Remove Pill Tabs

**Delete:**
- `ContentTab` type (`"transcript" | "summary" | "content"`)
- `activeTab` signal
- `PillTabs` component
- `PlaceholderTab` component and its import
- `contentTabs` array
- `children` prop slot on DetailHeader (was used for pills)

### Unified ContentView

Replace `TabContent` with a single `ContentView` that switches on content type:

```
if contentType === "transcript" && transcript segments exist
  → <TranscriptView />
else if contentType === "markdown" && content exists
  → <MarkdownView />
else if isYouTube
  → "Fetch Transcript" button
else
  → "Extract Content" button
```

### New Component: `MarkdownView`

`apps/extension/components/detail/MarkdownView.tsx`

Renders markdown content as styled HTML. Handles:
- Headings (h1-h4)
- Paragraphs with drop caps (matching TranscriptView style)
- Code blocks (inline and fenced)
- Lists (ordered and unordered)
- Links
- Images
- Blockquotes

Uses a lightweight markdown-to-HTML renderer (or manual parsing for the subset we need). Styled to match the existing TranscriptView reading experience.

### Reading Progress

Works for both content types:
- Transcript: word count from segments (existing)
- Markdown: word count from content string

### Copy Button

Works for both content types:
- Transcript: copies timestamped text (existing)
- Markdown: copies raw markdown string

### Scroll-Reveal Compact Header

Restore the feature from commit `3a3c88a`:

1. Add `heroScrolledPast` signal to DetailPage
2. Track scroll position of the scrollable container
3. When hero card scrolls out of view:
   - Show mini thumbnail (28x28, rounded) + truncated title in the action bar center
4. When hero card is visible:
   - Action bar center is empty

**DetailHeader changes:**
- Add `compact?: boolean` prop
- When `compact` is true, render thumbnail + title between Back button and actions
- Remove `children` prop (no longer needed for pills)

## Host Permissions

Update `wxt.config.ts`:

```typescript
host_permissions: [
  "*://*.youtube.com/*",
  "<all_urls>",  // needed for executeScript on any page
]
```

Required for `browser.scripting.executeScript()` to work on non-YouTube domains.

## Dependencies

Add to `apps/extension/package.json`:
- `@mozilla/readability` — article extraction from DOM
- `turndown` — HTML to markdown conversion
- `@types/turndown` — TypeScript types

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add `transcript?`, `content?` fields; narrow `contentType` |
| `apps/extension/lib/page-extract.ts` | **New** — extraction logic (Readability + Turndown) |
| `apps/extension/entrypoints/background.ts` | Add extraction calls in capture flows; add `GET_CONTENT` handler |
| `apps/extension/components/detail/DetailPage.tsx` | Remove pills, add ContentView, restore scroll-reveal |
| `apps/extension/components/detail/DetailHeader.tsx` | Add compact mode, remove children prop |
| `apps/extension/components/detail/MarkdownView.tsx` | **New** — markdown rendering component |
| `apps/extension/components/detail/PlaceholderTab.tsx` | **Delete** |
| `apps/extension/wxt.config.ts` | Add `<all_urls>` host permission |
| `apps/extension/package.json` | Add readability + turndown deps |

## Out of Scope

- R2 sync for markdown content (future milestone)
- AI summaries (Milestone 4)
- API fallback for closed-tab extraction
- Markdown editing
