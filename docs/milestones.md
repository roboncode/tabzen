# Tab Zen — Product Milestones

Iterative roadmap. Each milestone produces a testable, shippable increment.

---

## Milestone 1: YouTube Transcript Extraction

**Goal:** Capture YouTube transcripts during tab capture (browser-first), store raw segments in R2, display timestamped transcript in the extension.

- Extend content script to extract transcript from YouTube page during capture
- Store raw transcript segments JSON to R2
- Add `contentKey`, `contentType`, `contentFetchedAt` to Tab model
- Rename sync-service to api, restructure with clean service layer (routes/services)
- Add R2 binding to API worker
- API endpoints for storing and retrieving transcript content
- Extension UI: "Transcript" button on YouTube tab cards (displays stored transcript, fetches via API fallback if needed)
- Fallback: content-youtube API for tabs no longer open
- Local dev: Wrangler R2 emulation (files on disk, inspectable)

**Testable outcome:** Capture a YouTube tab → transcript extracted automatically → click "Transcript" → see timestamped segments. Close tab, click "Transcript" on another → API fallback fetches it.

---

## Milestone 2: Web Page Content as Markdown

**Goal:** On-demand article/page extraction for any saved tab, stored in R2.

- Content extraction service for general web pages
- Extract main content using readability-style parsing (title, author, body)
- Convert to clean markdown, store in R2
- Extension UI: "Content" button on non-video tab cards
- Display markdown in extension with reader-style formatting

**Testable outcome:** Save a blog post tab → click "Content" → see clean markdown version in extension.

---

## Milestone 3: AI-Generated Documents & Summaries

**Goal:** AI processes raw content (transcripts, articles) into structured documents using editable prompt templates.

- Prompt templates stored as markdown files in a dedicated package/directory
  - Structured document from transcript (highlights, key points, organized content)
  - Summary prompt (configurable length)
  - Sponsor detection prompt (for YouTube)
- AI service reads prompt files, injects content, calls model
- Store AI-generated markdown to R2 alongside raw content
- Extension UI: view AI-generated document for any tab with raw content
- Prompt iteration workflow: edit markdown file → re-process → see improved output

**Testable outcome:** Tab with raw transcript → AI generates structured document → stored as markdown in R2 → view in extension. Edit prompt file → re-process → compare output.

---

## Milestone 4: Subscriptions & RSS Monitoring

**Goal:** Subscribe to YouTube channels (and later other sources) for new content alerts.

- RSS feed polling via Cloudflare Worker on a cron schedule
- Subscribe to YouTube channels from within the extension
- New content detected → notification or badge in extension
- Option to auto-capture new videos from subscribed channels
- Subscription management UI in settings or sidebar

**Testable outcome:** Subscribe to a YouTube channel → new video posted → extension shows notification → one-click capture.

---

## Milestone 5: AI Content Generation

**Goal:** Generate derivative content from stored transcripts and articles.

- Prompt templates (as markdown files) for each output type:
  - Article from transcript
  - Social media posts (LinkedIn, Twitter/X, Instagram, Facebook)
  - Product ideas extraction
- Generation UI: select tab → choose output type → generate → copy/export
- Store generated content in R2, linked to source tab
- Future: image generation via Nano Banana

**Testable outcome:** YouTube tab with transcript → generate LinkedIn post → copy to clipboard. Generate article from transcript → view/edit markdown.

---

## Milestone 6: Knowledge Base & Chat

**Goal:** Conversational interface over all stored content using vector search.

- Migrate storage to Postgres + pgvector (or Cloudflare Vectorize)
- Chunk stored content (transcripts, markdown, summaries) into embeddings
- Store embeddings with references back to source content in R2
- Chat UI in extension (side panel or full page)
- Semantic search: "what did [channel] say about [topic]?"
- Cross-source answers: combine information from multiple tabs/transcripts
- Per-channel or per-source knowledge base scoping

**Testable outcome:** Chat interface → ask a question → get answer with source citations linking back to specific tabs and timestamps.

---

## Milestone 7: Performance & Optimization

**Goal:** Optimize storage, caching, and retrieval based on real usage patterns.

- KV caching layer for frequently accessed content (TTL-based)
- Separate IndexedDB store for transcripts if tab records grow too large
- Batch sync for content (if individual pushes become a bottleneck)
- Content deduplication (same video captured from multiple browsers)
- Lazy loading for large transcript displays
- Measure and optimize API response times

**Testable outcome:** Defined after observing real bottlenecks from Milestones 1-6.

---

## Notes

- Each milestone builds on the previous — content must be fetched (M1/M2) before it can be processed by AI (M3) or embedded (M6)
- AI prompts are always stored as editable markdown files, never hardcoded
- R2 for content storage throughout
- Local dev uses Wrangler R2 emulation — same code path as production
- Optimization (M7) is driven by real usage data, not speculation
- Milestones can be further broken into tasks/specs when we start each one
