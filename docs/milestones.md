# Tab Zen — Product Milestones

Iterative roadmap. Each milestone produces a testable, shippable increment.

---

## Milestone 1: YouTube Transcript Extraction ✅

**Goal:** Capture YouTube transcripts during tab capture (browser-first), store raw segments in R2.

- Renamed sync-service to api with clean service layer (routes/services/middleware)
- Added R2 binding and content service for transcript storage
- D1 migration for content fields on tabs
- YouTube transcript extraction via `chrome.scripting.executeScript` + InnerTube ANDROID client
- Transcript auto-extracted during tab capture for YouTube pages
- Fallback via content-youtube API for tabs no longer open
- YouTube Shorts URL support
- `contentKey`, `contentType`, `contentFetchedAt` on Tab model
- `GET_TRANSCRIPT` message handler with 3-step fallback (local → open tab → API)

**Completed:** 2026-04-06

---

## Milestone 2: Tab Detail Page

**Goal:** A dedicated detail page for viewing and interacting with a captured tab's content.

- New entrypoint: `entrypoints/detail/` — opens as a chrome-extension tab
- URL pattern: `detail.html?tabId={id}`
- Header: title, thumbnail, channel/source, metadata
- Tabbed sections shell: Transcript (now) | Summary | Content | Chat (future)
- Transcript tab: timestamped segments, clickable timestamps, copy to clipboard
- Expand icon on tab cards (hover) → opens detail page for that tab
- Card click still opens the source URL (existing behavior preserved)
- Designed to accommodate future milestone features without refactoring

**Testable outcome:** Capture a YouTube tab → hover card → click expand icon → detail page opens with transcript displayed. Timestamps link to YouTube at that point.

---

## Milestone 3: Web Page Content as Markdown

**Goal:** On-demand article/page extraction for any saved tab, stored in R2.

- Content extraction service for general web pages
- Extract main content using readability-style parsing (title, author, body)
- Convert to clean markdown, store in R2
- Display in detail page Content tab
- Works for articles, blog posts, documentation

**Testable outcome:** Save a blog post tab → open detail page → see clean markdown version.

---

## Milestone 4: AI-Generated Documents & Summaries ✅

**Goal:** AI processes raw content (transcripts, articles) into structured documents using editable prompt templates.

- Prompt templates stored as markdown files (`apps/extension/prompts/*.md`)
  - Summary, Key Points, Action Items, Simplified, Products & Mentions, Sponsors, Social Posts
  - Each with specialized view components and skeleton loading states
- AI service reads prompt files, injects content, calls OpenRouter API
- AI documents stored in IndexedDB and synced to R2 via existing sync flow
- VitePress-style detail page with left nav, inline prompt editor, auto-generation
- Prompt iteration workflow: inline edit → staleness detection via SHA-256 hash → regenerate
- Sponsor detection identifies paid sponsorships, promo codes, and timeframes
- Social Posts section (pulled forward from M6) with platform-specific generation

**Completed:** 2026-04-10

---

## Milestone 5: Subscriptions & RSS Monitoring

**Goal:** Subscribe to YouTube channels (and later other sources) for new content alerts.

- RSS feed polling via Cloudflare Worker on a cron schedule
- Subscribe to YouTube channels from within the extension
- New content detected → notification or badge in extension
- Option to auto-capture new videos from subscribed channels
- Subscription management UI in settings or sidebar

**Testable outcome:** Subscribe to a YouTube channel → new video posted → extension shows notification → one-click capture.

---

## Milestone 6: AI Content Generation

**Goal:** Generate derivative content from stored transcripts and articles.

- Prompt templates (as markdown files) for each output type:
  - Article from transcript
  - Social media posts (LinkedIn, Twitter/X, Instagram, Facebook)
  - Product ideas extraction
- Generation UI in detail page
- Store generated content in R2, linked to source tab
- Future: image generation via Nano Banana

**Testable outcome:** YouTube tab with transcript → generate LinkedIn post → copy to clipboard. Generate article from transcript → view/edit markdown.

---

## Milestone 7: Knowledge Base & Chat

**Goal:** Conversational interface over all stored content using vector search.

- Migrate storage to Postgres + pgvector (or Cloudflare Vectorize)
- Chunk stored content (transcripts, markdown, summaries) into embeddings
- Store embeddings with references back to source content in R2
- Chat UI in detail page Chat tab (and possibly standalone)
- Semantic search: "what did [channel] say about [topic]?"
- Cross-source answers: combine information from multiple tabs/transcripts
- Per-channel or per-source knowledge base scoping

**Testable outcome:** Chat interface → ask a question → get answer with source citations linking back to specific tabs and timestamps.

---

## Milestone 8: Performance & Optimization

**Goal:** Optimize storage, caching, and retrieval based on real usage patterns.

- KV caching layer for frequently accessed content (TTL-based)
- Separate IndexedDB store for transcripts if tab records grow too large
- Batch sync for content (if individual pushes become a bottleneck)
- Content deduplication (same video captured from multiple browsers)
- Lazy loading for large transcript displays
- Measure and optimize API response times

**Testable outcome:** Defined after observing real bottlenecks from Milestones 1-7.

---

## Notes

- Each milestone builds on the previous — content must be fetched (M1/M3) before it can be processed by AI (M4) or embedded (M7)
- The detail page (M2) is the central UI surface that all content milestones build on
- AI prompts are always stored as editable markdown files, never hardcoded
- R2 for content storage throughout
- Local dev uses Wrangler R2 emulation — same code path as production
- Optimization (M8) is driven by real usage data, not speculation
- Milestones can be further broken into tasks/specs when we start each one
