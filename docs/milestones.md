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

## Milestone 2: Tab Detail Page ✅

**Goal:** A dedicated detail page for viewing and interacting with a captured tab's content.

- ✅ Detail page as route within single SPA (`/page/:pageId`)
- ✅ Header: title, avatar/thumbnail, description, tags, actions (archive/star/copy/delete)
- ✅ Tabbed sections: Content | AI document tabs (Summary, Key Points, etc.) | Custom
- ✅ Transcript view with timestamped segments
- ✅ Right sidebar with TOC, external links, related pages
- ✅ Card click navigates to detail page
- ✅ External link icon on cards opens source URL (existing behavior preserved)
- ✅ Designed to accommodate future milestone features without refactoring

**Completed:** 2026-04-08 (approx)

**Testable outcome:** Capture a YouTube tab → click card → detail page opens with transcript displayed. Timestamps link to YouTube at that point.

---

## Milestone 3: Web Page Content as Markdown ✅

**Goal:** On-demand article/page extraction for any saved tab, stored in R2.

- ✅ Content extraction service for general web pages (`lib/page-extract.ts`)
- ✅ Extract main content using `@mozilla/readability` (title, author, body)
- ✅ Convert to clean markdown via `TurndownService`, store in R2
- ✅ Display in detail page Content tab with syntax highlighting via Shiki
- ✅ Works for articles, blog posts, documentation
- ✅ Fallback via fetch for tabs no longer open
- ✅ `linkedom` for DOM parsing in service worker context

**Completed:** 2026-04-08 (approx)

**Testable outcome:** Save a blog post tab → open detail page → see clean markdown version.

---

## Milestone 4: AI-Generated Documents & Summaries ✅

**Goal:** AI processes raw content (transcripts, articles) into structured documents using editable prompt templates.

- ✅ Prompt templates stored as markdown files (`apps/extension/prompts/*.md`)
  - ✅ Summary, Key Points, Action Items, Simplified (ELI5), Products & Mentions, Social Posts
  - ✅ Each with specialized view components and skeleton loading states
- ✅ AI service reads prompt files, injects content, calls OpenRouter API
- ✅ AI documents stored in IndexedDB and synced to R2 via existing sync flow
- ✅ VitePress-style detail page with left nav, inline prompt editor, auto-generation
- ✅ Prompt iteration workflow: inline edit → staleness detection via SHA-256 hash → regenerate
- ✅ Sponsor detection within Products & Mentions (identifies Sponsored context, promo codes)
- ✅ Social Posts with platform-specific generation (X, LinkedIn, Instagram, Facebook, Threads), voice/personality, threading
- ✅ Template manager in settings (enable/disable, rename, edit, reset, add custom)

**Completed:** 2026-04-10

---

## Milestone 5: SPA Routing & Navigation ✅

**Goal:** Unified single-page app with proper routing, enabling back/forward navigation, page reloads, and deep linking to specific sections.

**Problems solved:**
- ✅ Detail page opens as a separate window — can't navigate back to list
- ✅ "Back" button calls `window.close()` — no real navigation
- ✅ Can't reload a detail page without losing state (reverts to Content tab)
- ✅ Active document section (Key Points, Summary, etc.) not preserved in URL
- ✅ Settings is a slide-in panel, not a proper route

**Implementation:**
- ✅ `@solidjs/router` with `HashRouter` (required for chrome-extension:// URLs)
- ✅ Merged tabs + detail entrypoints into a single SPA (`entrypoints/index/`)
- ✅ Route structure:
  - `#/` — Page list
  - `#/page/:pageId` — Detail page, defaults to Content section
  - `#/page/:pageId/:section` — Detail page with specific section active
  - `#/settings` — Settings page
  - `*` — Fallback to page list
- ✅ Back button uses `navigate("/")` — real browser back/forward works
- ✅ Active document section syncs bidirectionally with URL
- ✅ Popup and sidepanel remain separate entrypoints (different browser contexts)
- ✅ Deep links: clicking a section in the left nav updates the URL; refreshing restores position
- ✅ `DATA_CHANGED` messaging continues to work across popup/sidepanel/main SPA

**Completed:** 2026-04-09 (approx)

**Testable outcome:** Open a tab detail → click Key Points → reload the page → still on Key Points. Click Back → returns to list view. Browser back/forward buttons work. Copy URL → paste in new tab → opens to same section.

---

## Milestone 6: Subscriptions & RSS Monitoring

**Goal:** Subscribe to YouTube channels (and later other sources) for new content alerts.

- RSS feed polling via Cloudflare Worker on a cron schedule
- Subscribe to YouTube channels from within the extension
- New content detected → notification or badge in extension
- Option to auto-capture new videos from subscribed channels
- Subscription management UI in settings or sidebar

**Testable outcome:** Subscribe to a YouTube channel → new video posted → extension shows notification → one-click capture.

---

## Milestone 7: AI Content Generation (Remaining)

**Goal:** Generate derivative content beyond what was built in M4.

- Article generation from transcript (full long-form article)
- Product ideas extraction
- Image generation via Nano Banana (future)

*Note: Social media posts, sponsor detection, key points, summaries, and other AI document types were completed in M4.*

**Testable outcome:** YouTube tab with transcript → generate full article → view/edit markdown.

---

## Milestone 8: Knowledge Base & Chat 🔧

**Goal:** Conversational interface over all stored content using vector search.

**Chat UI & Component Library:**
- ✅ `@tab-zen/chat` component library (`packages/chat/`) — 30+ SolidJS components
  - ✅ Headless primitives: auto-resize, stick-to-bottom, text streaming, voice recorder
  - ✅ UI primitives: Button, Avatar, Badge, Textarea, Tooltip, Dialog, ScrollArea, etc.
  - ✅ AI components: ChatContainer, Message, PromptInput, ScrollButton, Loader, Markdown, CodeBlock, ResponseStream, ConversationList, ModelSwitcher, VoiceInput, Attachments, Source, FeedbackBar, ChainOfThought, Checkpoint, Context/token usage
- ✅ Storybook with 40+ stories (component + integration-level)
- ✅ Standalone chat dev app (`apps/chat/`) wired to OpenRouter with streaming

**Data Layer:**
- ✅ `ChatDataAdapter` interface in `packages/shared/src/chat-types.ts`
- ✅ `LocalAdapter` implementation — IndexedDB + OpenRouter embeddings
- ✅ IndexedDB chat database (`tab-zen-chat`) with 4 stores: documentContexts, chunks, conversations, conversationGroups
- ✅ Reactive chat store (`createChatStore`) with SolidJS signals
- ✅ Chunking logic for transcripts (sliding time window) and markdown (heading-based) with tests
- ✅ Cosine similarity vector search (`vector-store.ts`)
- ✅ Embeddings via OpenRouter API

**Not yet done:**
- Ingestion pipeline: connecting captured extension content → chunking → embedding → storage
- RAG retrieval wired into chat flow (search before sending messages)
- Source citations in chat responses linking back to tabs/timestamps
- Semantic search across all stored content
- Cross-source answers
- Per-channel/per-source knowledge base scoping
- Integration into extension detail page Chat tab
- Turso adapter (Tier 2) / Managed adapter (Tier 3)

**Testable outcome:** Chat interface → ask a question → get answer with source citations linking back to specific tabs and timestamps.

---

## Milestone 9: Performance & Optimization

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

- Each milestone builds on the previous — content must be fetched (M1/M3) before it can be processed by AI (M4) or embedded (M8)
- The detail page (M2) is the central UI surface that all content milestones build on
- Routing (M5) is foundational for all future navigation improvements
- AI prompts are always stored as editable markdown files, never hardcoded
- R2 for content storage throughout
- Local dev uses Wrangler R2 emulation — same code path as production
- Optimization (M9) is driven by real usage data, not speculation
- Milestones can be further broken into tasks/specs when we start each one
