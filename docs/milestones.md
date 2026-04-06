# Tab Zen — Product Milestones

Iterative roadmap. Each milestone produces a testable, shippable increment.

---

## Milestone 1: YouTube Transcript Extraction

**Goal:** On-demand transcript fetching for YouTube tabs, stored in R2, viewable in the extension.

- Add R2 binding to sync-service (or a new content-service worker)
- Wire content-youtube API into the monorepo as a callable service
- Extension UI: "Get Transcript" button on YouTube tab cards
- Fetch transcript via content-youtube, store raw JSON (segments with timestamps) to R2
- Store rendered markdown version to R2 alongside raw
- Add `contentKey` field to Tab model linking to R2 path
- Display transcript in extension (collapsible panel or modal)
- Transcript text becomes searchable within the extension
- Caching layer: Cache API or KV with TTL for repeated fetches
- Local dev: Wrangler R2 emulation (files on disk, inspectable)

**Testable outcome:** Capture a YouTube tab → click "Get Transcript" → see timestamped transcript in extension. Browse `.wrangler/state/r2/` to inspect stored files.

---

## Milestone 2: Web Page Content as Markdown

**Goal:** On-demand article/page extraction for any saved tab, stored as markdown in R2.

- New content extraction service (or extend existing) for general web pages
- Extract main content using readability-style parsing (title, author, body)
- Convert to clean markdown
- Same R2 storage pattern as transcripts (raw HTML + rendered markdown)
- Extension UI: "Get Content" button on non-video tab cards
- Display markdown in extension with reader-style formatting
- Content becomes searchable within the extension

**Testable outcome:** Save a blog post tab → click "Get Content" → see clean markdown version in extension.

---

## Milestone 3: AI Summaries

**Goal:** Generate summaries from stored content (transcripts and markdown), with prompts stored as editable markdown files.

- Create prompt templates as markdown files in a dedicated package/directory
  - Summary prompt (configurable length: brief, standard, detailed)
  - Key points extraction prompt
  - Sponsor detection prompt (for YouTube)
- AI service that reads prompt files, injects content, calls model
- Extension UI: "Summarize" button (available after content is fetched)
- Store summary alongside content in R2
- Display summary on tab card (collapsible or as a tab detail view)
- Prompt iteration workflow: edit markdown file → test → refine

**Testable outcome:** Tab with fetched content → click "Summarize" → see AI-generated summary. Edit prompt file → re-summarize → see improved output.

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
- Future: image generation via Nano Banana (placeholder for now)

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

## Notes

- Each milestone builds on the previous — content must be fetched (M1/M2) before it can be summarized (M3) or embedded (M6)
- AI prompts are always stored as editable markdown files, never hardcoded
- R2 for content storage throughout, with caching layer
- Local dev uses Wrangler R2 emulation — same code path as production
- Milestones can be further broken into tasks/specs when we start each one
