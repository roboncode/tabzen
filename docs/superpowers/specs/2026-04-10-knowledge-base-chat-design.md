# Milestone 8: Knowledge Base & Chat — Design Spec

## Overview

A conversational interface for interacting with saved content. Users can chat with a single document (transcript, article) or query across their entire collection using vector search. Built as a standalone SolidJS package with a development app, designed to be integrated into the Tab Zen extension and reusable in other contexts.

## Goals

- Chat with individual documents using full content as context
- Chat across a collection of documents using embedding-based retrieval
- Persist and organize conversations into user-created groups
- Provide source citations linking answers back to specific content
- Build as a reusable, framework-appropriate (SolidJS) component library
- Support a three-tier data architecture (local, Turso BYOD, managed Postgres)
- Mirror prompt-kit's visual design language

## Non-Goals (for this milestone)

- Light mode theming (dark mode first, light mode follow-up)
- Turso or Postgres adapter implementations (local IndexedDB only)
- Migrating existing sync from D1/R2 to the tier system
- AI-to-UI cards (follow-up discussion after foundation)
- FileUpload, Image, JSXPreview, Tool, SystemMessage, Steps, ThinkingBar components (follow-up phase)

---

## Architecture

### Package Structure

```
packages/chat/                     # Pure UI components (SolidJS)
├── src/
│   ├── primitives/                # Layer 1 — Headless behaviors
│   │   ├── use-text-stream.ts     # Streaming text with typewriter/fade modes
│   │   ├── use-stick-to-bottom.ts # Auto-scroll management
│   │   ├── use-auto-resize.ts     # Textarea auto-sizing
│   │   └── use-voice-recorder.ts  # MediaRecorder abstraction
│   ├── ui/                        # Layer 2 — Styled base components (Kobalte + Tailwind)
│   │   ├── button.tsx
│   │   ├── avatar.tsx
│   │   ├── tooltip.tsx
│   │   ├── hover-card.tsx
│   │   ├── collapsible.tsx
│   │   ├── scroll-area.tsx
│   │   ├── dropdown.tsx
│   │   ├── textarea.tsx
│   │   ├── badge.tsx
│   │   ├── separator.tsx
│   │   └── dialog.tsx
│   ├── components/                # Layer 3 — AI/feature components
│   │   ├── chat-container.tsx
│   │   ├── message.tsx
│   │   ├── prompt-input.tsx
│   │   ├── response-stream.tsx
│   │   ├── markdown.tsx
│   │   ├── code-block.tsx
│   │   ├── loader.tsx
│   │   ├── feedback-bar.tsx
│   │   ├── chain-of-thought.tsx
│   │   ├── source.tsx
│   │   ├── prompt-suggestion.tsx
│   │   ├── scroll-button.tsx
│   │   ├── checkpoint.tsx
│   │   ├── context.tsx
│   │   ├── voice-input.tsx
│   │   ├── conversation-list.tsx
│   │   ├── conversation-item.tsx
│   │   ├── model-switcher.tsx
│   │   └── chat-scope-picker.tsx
│   ├── types.ts                   # Public type exports
│   └── index.ts                   # Public API
├── package.json
└── tsconfig.json

apps/chat/                          # Standalone dev app
├── src/
│   ├── App.tsx                     # Root layout (sidebar + chat)
│   ├── services/
│   │   ├── embedding.ts            # OpenRouter embedding calls
│   │   ├── chat.ts                 # OpenRouter chat + streaming
│   │   ├── chunking.ts             # Content → chunks + DocumentContext
│   │   ├── vector-store.ts         # IndexedDB vector storage + cosine similarity
│   │   └── voice.ts                # GROQ Whisper transcription
│   ├── adapters/
│   │   └── local-adapter.ts        # LocalAdapter implementing ChatDataAdapter
│   ├── stores/
│   │   └── chat-store.ts           # SolidJS store for conversation state
│   └── index.tsx                   # Vite entry
├── index.html
├── package.json
└── vite.config.ts
```

### Three-Layer Component Architecture

```
Layer 1: Headless primitives (behavior only, no styles)
         ├── Kobalte (Tooltip, HoverCard, Collapsible, Dialog, Select, etc.)
         └── Custom primitives (useTextStream, useStickToBottom, useAutoResize, useVoiceRecorder)

Layer 2: Styled UI primitives (Kobalte + Tailwind skin)
         └── Button, Avatar, Badge, ScrollArea, Textarea, etc.
         └── Equivalent to "Shadcn for SolidJS" — skinned Kobalte components

Layer 3: AI/Feature components (composed from Layer 2)
         └── Message, ChatContainer, ResponseStream, ChainOfThought, etc.
```

- Layer 2 components skin Kobalte headless primitives with Tailwind classes mirroring prompt-kit's design
- Layer 3 components compose Layer 2 components into chat-specific features
- Kobalte supports tree shaking via per-component entry points (`@kobalte/core/button`), 1-5 KB gzipped each
- If someone wants to restyle the chat, they swap Layer 2; Layers 1 and 3 remain unchanged

### Key Boundaries

- `packages/chat` has zero dependencies on IndexedDB, OpenRouter, GROQ, or any service
- It accepts data via props and emits events via callbacks
- `apps/chat` does all wiring — connects UI to real services
- The adapter interface (`ChatDataAdapter`) lives in `packages/shared`

---

## Data Model

All types live in `packages/shared` for cross-package consumption.

### Adapter Interface

```typescript
interface ChatDataAdapter {
  storeDocumentContext(context: DocumentContext): Promise<void>
  storeChunks(documentId: string, chunks: Chunk[]): Promise<void>
  searchSimilar(embedding: number[], topK: number, filters?: SearchFilters): Promise<ChunkResult[]>
  getDocumentContext(documentId: string): Promise<DocumentContext>
  saveConversation(conversation: Conversation): Promise<void>
  getConversation(conversationId: string): Promise<Conversation>
  listConversations(): Promise<ConversationSummary[]>
  deleteConversation(conversationId: string): Promise<void>
  generateEmbedding(text: string): Promise<number[]>
}
```

Implementations per tier:
- `LocalAdapter` — IndexedDB + OpenRouter embeddings (M8)
- `TursoAdapter` — Turso HTTP client (future)
- `ManagedAdapter` — API calls to managed backend (future)

### Document Context

One per source document. Contains metadata and framing content shared across all chunks.

```typescript
interface DocumentContext {
  documentId: string
  title: string
  url: string
  author?: string               // channel name, blog author, etc.
  capturedAt: string
  contentType: 'transcript' | 'markdown'
  framingContent: string        // opening context, first N sentences
  metadata?: Record<string, string>
}
```

### Chunks

Individual segments linked to their DocumentContext. Each chunk carries its own embedding and position metadata.

```typescript
interface Chunk {
  chunkId: string
  documentId: string            // FK to DocumentContext
  text: string
  embedding: number[]
  position: number              // chunk index (1 of N)
  metadata: ChunkMetadata
}

interface ChunkMetadata {
  timestampStart?: string       // for transcripts: "12:30"
  timestampEnd?: string         // "15:45"
  sectionHeading?: string       // for articles
  speaker?: string              // if identifiable
}
```

**Retrieval join:** When a chunk is retrieved via vector search, its DocumentContext is automatically joined and sent to the LLM. The chunk provides the specific answer material; the DocumentContext provides who said it, where, when, and broader framing. This avoids duplicating context information inside every chunk while ensuring the LLM always has the full picture.

### Conversations

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  modelId?: string              // which model generated this response
  createdAt: string
}

interface Citation {
  documentId: string
  chunkId: string
  title: string                 // from DocumentContext
  snippet: string               // relevant chunk excerpt
  url: string
  timestamp?: string            // for transcript sources
}

interface Conversation {
  id: string
  title: string                 // auto-generated or user-edited
  groupId?: string              // user-created group
  scope: ConversationScope
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

interface ConversationGroup {
  id: string
  name: string
  sortOrder: number
  createdAt: string
}

interface ConversationScope {
  type: 'document' | 'collection'
  documentId?: string           // for document-scoped chats
  filters?: SearchFilters       // for collection-scoped chats
}

interface SearchFilters {
  tags?: string[]
  authors?: string[]
  contentType?: 'transcript' | 'markdown'
  dateRange?: { from: string; to: string }
}

interface ChunkResult {
  chunk: Chunk
  context: DocumentContext        // auto-joined
  score: number                   // cosine similarity score
}

interface ConversationSummary {
  id: string
  title: string
  groupId?: string
  scope: ConversationScope
  messageCount: number
  lastMessageAt: string
  updatedAt: string
}
```

**Conversation titles:** Auto-generated from the first user message (truncated to ~50 chars). Users can rename manually. No LLM call for title generation in M8 — keep it simple.

- `document` scope: conversation grounded in a single source document. In Tab Zen that maps to a page; in another app it could be a PDF, note, etc.
- `collection` scope: conversation across the full corpus or a filtered subset
- The chat package never knows what a "page" is — it only knows documents and collections
- Conversations can be organized into user-created groups
- `modelId` on messages tracks which model generated each response

---

## Chat Flows

### Document-Scoped Chat

No embeddings, no chunking. Full content passed as context.

```
User asks question
  → App gets full content for that document
  → Sends to OpenRouter:
      system prompt + full document content + conversation history + user question
  → Streams response back to UI
```

### Collection-Scoped Chat (Knowledge Base)

Embedding-based retrieval across all stored content.

```
User asks question
  → Generate embedding for the question (OpenRouter, text-embedding-3-small)
  → Query vector store: cosine similarity search in IndexedDB
  → Retrieve top-K chunks + their DocumentContexts (joined)
  → Send to OpenRouter:
      system prompt + retrieved contexts + conversation history + user question
  → Stream response with inline citations referencing specific chunks
```

### Chunking Pipeline

Runs when content is first indexed for the knowledge base.

```
New content captured (transcript or markdown)
  → Chunking service splits into segments:
      - Transcripts: chunk by timestamp windows (~2-3 min segments)
      - Markdown: chunk by headings/sections, fallback to paragraph groups
  → Generate DocumentContext from tab metadata (title, URL, author, date, framing)
  → Embed each chunk via OpenRouter (text-embedding-3-small)
  → Store DocumentContext + chunks via ChatDataAdapter
```

### Streaming

- Chat responses stream token-by-token from OpenRouter
- `useTextStream` primitive handles typewriter and fade modes
- `ResponseStream` component renders markdown progressively as tokens arrive
- Citations parsed from model response using structured format defined in the system prompt

### Voice Input

Wispr Flow-style experience — speak and clean text appears in the input.

```
User holds/clicks mic button (push-to-talk or toggle)
  → MediaRecorder captures audio (WebM/Opus)
  → Audio blob sent to GROQ Whisper API
  → Transcribed text inserted directly into PromptInput
  → Optional: light LLM pass to clean filler words and add punctuation
  → Normal chat flow from there
```

- Requires GROQ API key in settings (optional)
- If no GROQ key configured, mic button is hidden
- No intermediate preview — text goes straight into the input

---

## Component Catalog

### Layer 1: Headless Primitives

| Primitive | Purpose |
|-----------|---------|
| `useTextStream` | Streaming text display with typewriter/fade modes. Returns `displayedText`, `isComplete`, `segments[]`, and controls (`reset`, `pause`, `resume`) |
| `useStickToBottom` | Auto-scroll management for chat containers. Detects user scroll-up, re-engages on new message |
| `useAutoResize` | Textarea auto-sizing based on content |
| `useVoiceRecorder` | MediaRecorder abstraction. Returns `isRecording`, `start`, `stop`, `audioBlob` |

### Layer 2: Styled UI Primitives

Built on Kobalte headless components, skinned with Tailwind to match prompt-kit's design.

| Component | Kobalte Base | Notes |
|-----------|-------------|-------|
| Button | — | Variants: default, ghost, outline. Sizes: sm, md, lg. cva for variant management |
| Avatar | — | Image + fallback initials |
| Tooltip | `@kobalte/core/tooltip` | Styled tooltip |
| HoverCard | `@kobalte/core/hover-card` | For Source and Context components |
| Collapsible | `@kobalte/core/collapsible` | For ChainOfThought, conversation groups |
| ScrollArea | `@kobalte/core/scroll-area` | Styled scrollbar |
| Dropdown | `@kobalte/core/dropdown-menu` | For ModelSwitcher, ChatScopePicker |
| Textarea | — | Auto-resizing via `useAutoResize` |
| Badge | — | Count and status variants |
| Separator | — | Styled divider |
| Dialog | `@kobalte/core/dialog` | Confirmations |
| cn() utility | — | `clsx` + `tailwind-merge` for class merging |

### Layer 3: AI/Feature Components

**Ported from prompt-kit (styling reference):**

| Component | prompt-kit LOC | Description |
|-----------|---------------|-------------|
| ChatContainer | 67 | Scroll container with stick-to-bottom. Compound: Root, Content, ScrollAnchor |
| Message | 120 | Compound: Message, MessageAvatar, MessageContent, MessageActions, MessageAction |
| PromptInput | 233 | Context-based input with auto-sizing textarea. Compound: Root, Textarea, Actions, Action |
| ResponseStream | 394 | Streaming text display. Typewriter + fade modes. Uses `useTextStream` |
| Markdown | 110 | Markdown renderer with remark plugins (breaks, GFM). Uses `solid-markdown` or equivalent |
| CodeBlock | 94 | Syntax-highlighted code with Shiki. Compound: CodeBlock, CodeBlockCode, CodeBlockHeader |
| Loader | 499 | 4 variants for M8: `bars`, `text-shimmer`, `loading-dots`, `pulse-dot`. All accept `variant`, `size` (sm/md/lg), `text` |
| FeedbackBar | 64 | Thumbs up/down + close. Props: `onHelpful()`, `onNotHelpful()`, `onClose()` |
| ChainOfThought | 148 | Expandable reasoning tree. Compound: ChainOfThought, Step, Trigger, Item, Content |
| Source | 129 | Citation hover card. Compound: Source, SourceTrigger (label, favicon), SourceContent (title, description, snippet) |
| PromptSuggestion | 117 | Suggested follow-up chips with optional text highlight |
| ScrollButton | 42 | Fixed scroll-to-bottom button, visible when scrolled up |

**Ported from AI Elements:**

| Component | AI Elements LOC | Description |
|-----------|----------------|-------------|
| Checkpoint | 72 | Restore point marker in conversation. Compound: Checkpoint, CheckpointIcon, CheckpointTrigger |
| Context | 410 | Token usage display. Hover card with donut chart, token breakdown (input/output/reasoning/cache), cost estimation. Compound: Context, ContextTrigger, ContextContent, ContextContentHeader, ContextContentBody, ContextContentFooter, ContextInputUsage, ContextOutputUsage, ContextReasoningUsage, ContextCacheUsage |

**New components (not in either library):**

| Component | Description |
|-----------|-------------|
| VoiceInput | Mic button with push-to-talk/toggle. Uses `useVoiceRecorder`. Emits audio blob for transcription. Hidden when voice not configured |
| ConversationList | Sidebar with grouped conversations. Collapsible groups, count badges, search, drag-to-reorder between groups |
| ConversationItem | Single conversation entry. Title, preview text, timestamp. Active state highlighting |
| ModelSwitcher | Inline model picker dropdown. Only renders if `models.length > 1`. Shows current model, allows switching mid-conversation |
| ChatScopePicker | Filter dropdown for collection chats. Filter by tags, authors, content type, date range |

---

## Chat UI Layout

### Global Chat (Collection) — `#/chat` Route

```
┌─ Sidebar (collapsible) ──────┬─ Main Chat Area ─────────────────────────┐
│                               │                                          │
│  [☰] Chats            [+]    │  Header: Title · Group · Scope picker     │
│  [Search chats...]            │                                          │
│                               │  ┌─ Messages (max-width centered) ─────┐ │
│  ▾ Research            (4)    │  │                                      │ │
│    ● Serverless databases     │  │  [User message bubble]               │ │
│      Edge computing           │  │                                      │ │
│      Auth comparison          │  │  [AI] Response with citations [1][2] │ │
│      Vector search            │  │       ┌─────────────────────┐       │ │
│                               │  │       │ [1] Source title     │       │ │
│  ▾ Learning            (2)    │  │       │ [2] Source title     │       │ │
│    SolidJS reactivity         │  │       └─────────────────────┘       │ │
│    WebSocket patterns         │  │                                      │ │
│                               │  └──────────────────────────────────────┘ │
│  ▾ Ungrouped           (3)    │                                          │
│    Quick CSS question         │  ┌─ Input ─────────────────────────────┐ │
│    Pricing page ideas         │  │ Ask about your saved content... 🎤 ↑ │ │
│    Deployment strategies      │  └─────────────────────────────────────┘ │
│                               │  [Suggestion chip] [Suggestion chip]     │
└───────────────────────────────┴──────────────────────────────────────────┘
```

- Sidebar collapses to a narrow icon strip (hamburger + new chat)
- Conversations organized into user-created collapsible groups
- "Ungrouped" catch-all for unorganized chats
- Count badges per group
- Active conversation highlighted
- Messages centered with max-width for readability
- Citations inline as numbered chips, source cards below response
- Prompt suggestions below input
- Voice input button (mic icon, hidden if no GROQ key)
- Model switcher in header (only if multiple models configured)
- Context/token display accessible from header

### Document Chat — Detail Page Section

```
┌─ Detail Page ─────────────────────────────────────────┐
│  [← Back]  Page Title                                 │
│                                                       │
│  [Content] [Transcript] [Summary] [...] [Chat]        │
│                                                       │
│  ┌─ Chat Panel ─────────────────────────────────────┐ │
│  │                                                   │ │
│  │  [User message]                                   │ │
│  │                                                   │ │
│  │  [AI] Response (no citations needed —             │ │
│  │       single document context)                    │ │
│  │                                                   │ │
│  │  ┌─ Input ──────────────────────────────────┐     │ │
│  │  │ Ask about this content...           🎤 ↑ │     │ │
│  │  └──────────────────────────────────────────┘     │ │
│  │  [Suggestion] [Suggestion]                        │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

- Simpler than global chat: no sidebar, no scope picker
- Full document content passed as context (no embeddings)
- Conversation persisted per document
- Same chat components, just in a simpler layout

---

## Configuration

### Chat Package Config (props-based)

```typescript
interface ChatConfig {
  // Models
  models: ModelOption[]               // available models
  defaultModelId: string              // pre-selected model
  showModelSwitcher?: boolean         // auto-determined: true if models.length > 1

  // Voice
  voiceEnabled: boolean               // show/hide mic button
  onVoiceRecord?: (audio: Blob) => Promise<string>  // returns transcribed text

  // Callbacks
  onSendMessage: (message: string, modelId: string) => void
  onStreamResponse: () => AsyncIterable<string>
  onFeedback?: (messageId: string, helpful: boolean) => void
  onCheckpointRestore?: (messageId: string) => void

  // Context display
  contextInfo?: ContextInfo           // token usage, cost — shows Context component if provided

  // Theming
  theme?: 'dark' | 'light'
}

interface ModelOption {
  id: string
  name: string
  provider?: string
}

interface ContextInfo {
  usedTokens: number
  maxTokens: number
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheTokens?: number
  estimatedCost?: number
}
```

The chat package never knows about OpenRouter, GROQ, IndexedDB, or any external service. The consuming app maps its own settings and services to this interface.

### Extension Settings Additions

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Chat model | OpenRouter model selector | Main app model | Separate model for chat responses |
| Embedding model | OpenRouter model selector | `text-embedding-3-small` | Used for knowledge base chunking |
| GROQ API key | String (optional) | Empty | Unlocks voice input when provided |

---

## AI Backend

### Chat LLM

- OpenRouter, same integration as existing AI document generation
- Separate model selection for chat (defaults to main app model)
- Configurable per-conversation via inline ModelSwitcher
- Streaming via OpenRouter's streaming API

### Embeddings

- OpenRouter with `text-embedding-3-small` (default, configurable)
- Generated once per document when content is chunked
- Stored in IndexedDB alongside chunk data
- Used for cosine similarity search in collection-scoped chats
- Not needed for document-scoped chats (full content as context)

### Voice Transcription

- GROQ Whisper API (direct integration, not through OpenRouter)
- Requires separate GROQ API key in settings
- Optional — voice features hidden when not configured
- Wispr Flow-style UX: speak → clean text appears in input
- Optional light LLM pass to clean up filler words and punctuation

---

## Data Tier Strategy

See `docs/data-tier-strategy.md` for the full three-tier architecture. Summary:

| Tier | Storage | Vectors | Sync | Cost |
|------|---------|---------|------|------|
| Free (M8) | IndexedDB | Local cosine similarity | None | $0 to us, user pays OpenRouter |
| BYOD (future) | Turso | Turso native vectors | Turso replicas | $0 to us, user pays Turso |
| Subscribe (future) | Postgres (Neon) | pgvector | Managed | Subscription revenue |

M8 builds only the Free tier with the `LocalAdapter`. The adapter interface is designed so Turso and Managed adapters can be added without changing the chat UI or data model.

---

## Design References

Two reference repos are cloned locally at `reference/` (gitignored):

- **prompt-kit** (`reference/prompt-kit`) — Primary styling reference. SolidJS components mirror prompt-kit's Tailwind styling and component API patterns. Apache 2.0 license.
- **AI Elements** (`reference/ai-elements`) — Reference for Checkpoint and Context components. Apache 2.0 license.

### Styling Approach

- Mirror prompt-kit's visual design language (Tailwind classes, spacing, colors)
- Dark mode first
- `class-variance-authority` for component variants (framework-agnostic)
- `clsx` + `tailwind-merge` via `cn()` utility
- Kobalte for headless accessibility primitives (tree-shakeable per-component imports)
- Lucide Solid for icons (already in the project)

---

## Follow-Up Phase

After the M8 foundation is stable, a follow-up discussion will cover:

- Additional components from prompt-kit and AI Elements (FileUpload, Image, JSXPreview, Tool, SystemMessage, Steps, ThinkingBar)
- AI-to-UI (A2UI) cards
- Light mode theme
- Turso adapter implementation
- Managed Postgres adapter and subscription billing
