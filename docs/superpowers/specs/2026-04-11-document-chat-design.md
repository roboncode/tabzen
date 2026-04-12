# Document-Scoped Chat — Design Spec

## Overview

Add a conversational chat panel to the detail page that lets users chat with a single document's content. No embeddings, no RAG — the full document (transcript or extracted markdown) is passed as LLM context. Voice input via Groq Whisper, gated behind an optional API key in settings.

## Goals

- Chat with the content of any captured page (YouTube transcript or web article)
- Persist and browse conversations per document
- Voice-to-text input via Groq Whisper
- Zed/VS Code-style UX: FAB opens resizable side panel, fresh conversation by default, history accessible
- Separate chat model setting from AI document generation model

## Non-Goals

- Collection-scoped chat (knowledge base / RAG) — future phase
- Embeddings, chunking, or vector search — not needed for single-document chat
- Embedding model settings — deferred to RAG phase
- Using AI-generated content (summaries, key points, etc.) as context — only raw document content

---

## UI

### FAB (Floating Action Button)

- 56px (`w-14 h-14`) purple accent button with `MessageCircle` icon
- Positioned `bottom-6 right-6`, fixed to viewport
- Toggles chat panel open/closed
- When panel is open, FAB shows `X` icon and uses active state color
- Replaces the current `ChatFab.tsx` placeholder (which is `w-11 h-11` at `bottom-4 right-4`)

### Chat Panel

**Wide screens (push + resizable):**
- Opens on the right, default width ~380px
- Pushes content area — main content compresses to make room
- Drag handle on left edge for resizing (using the `Resizable` component from `@tab-zen/chat`)
- Panel width persisted per session (localStorage or settings)

**Narrow screens (overlay):**
- Panel overlays the full content area
- No resize handle — takes full width of content area

**Breakpoint:** Use the same responsive breakpoint the detail page already uses for its layout shifts.

### Panel Structure

**Header:**
- Left: conversation title (or "New Thread" for new conversations)
- Right: `+` (new conversation), history button (clock/list icon), `✕` close

**Default view (new conversation):**
- Empty message area with prompt suggestions (e.g., "What is this about?", "Summarize the key points", "What are the main arguments?")
- Recent conversations listed above the input area — title + relative timestamp (like Zed's "Recent" section). Click to load.
- Input at bottom with mic button (if Groq key configured)

**Conversation view:**
- Messages rendered with `Message`, `MessageContent` from `@tab-zen/chat`
- Streaming responses via `ResponseStream` or inline streaming
- `ScrollButton` for scroll-to-bottom
- Input area: `PromptInput` with `VoiceInput` (conditional on Groq key)
- `ModelSwitcher` in header (shows current model, allows switching per-conversation)

**History view (full panel takeover):**
- Triggered by history button in header
- `← History` back arrow returns to conversation
- Search field at top (filters conversations by title)
- Full list: conversation title + relative timestamp
- Delete per-item (swipe on mobile, hover reveal on desktop — or context menu)
- "Delete All History" button at bottom (with confirmation dialog)
- Only shows conversations for the current document

---

## Conversations

### Data Model

Uses the existing types from `packages/shared/src/chat-types.ts`:

```typescript
interface Conversation {
  id: string;
  title: string;
  groupId?: string;
  scope: ConversationScope;   // { type: 'document', documentId: pageId }
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
```

### Storage

IndexedDB using the existing `tab-zen-chat` database schema (already has `conversations`, `conversationGroups`, `documentContexts`, `chunks` stores). For this phase, only the `conversations` store is used.

The chat database (`tab-zen-chat`) is separate from the main extension database (`tab-zen`). Conversation CRUD goes through the `ChatDataAdapter` interface via `LocalAdapter`.

### Scoping

All conversations created from the detail page use `scope: { type: 'document', documentId: pageId }`. The history view queries conversations filtered by the current page's ID.

### Auto-Title Generation

- After the first meaningful exchange (user message + assistant response), an LLM call generates a title (~50 chars max)
- If the first message is too vague to produce a useful title (e.g., "hi", "hey"), the system waits for the next exchange before generating
- Title is generated **once** per conversation — never re-titled automatically
- Uses the chat model for the title generation call (cheap, fast — just a short prompt)
- Prompt: "Generate a short title (under 50 characters) for this conversation based on the messages so far. Return only the title, no quotes or punctuation."

### Rename

Users can rename a conversation from the history view (inline edit or context menu). The renamed title replaces the auto-generated one.

---

## Chat Flow

### Document-Scoped Chat (no embeddings)

```
User sends message
  → App fetches full content for the current page:
      - YouTube pages: transcript text (joined segments)
      - Web pages: extracted markdown
  → Sends to OpenRouter:
      system prompt + full document content + conversation history + user message
  → Streams response back token-by-token
  → Conversation auto-saved after each exchange
  → If first exchange and title is "New Thread": trigger auto-title generation
```

### System Prompt

```
You are a helpful assistant. The user is viewing a specific document and asking questions about it.

## Document
Title: {page.title}
Source: {page.url}
Author: {page.author || 'Unknown'}
Type: {transcript | article}

## Content
{full document content}

Answer questions based on the document content above. If the user asks something not covered in the document, say so. Be concise and reference specific parts of the content when relevant.
```

### Content Retrieval

The document content is already available in the extension — it's stored in R2 and fetched for display in the Content tab. The chat panel retrieves it the same way the Content tab does:
- Check if content is already loaded in the detail page state
- If not, fetch from R2 via the existing content service

---

## Voice Input

- Mic button in input area, part of `PromptInputActions`
- Hidden when no Groq API key is configured in settings
- Uses `VoiceInput` component from `@tab-zen/chat` (already built)
- Push-to-talk: click to start recording, click again to stop
- Audio sent to Groq Whisper API via `transcribeAudio` service (already built in `apps/chat`)
- Transcribed text inserted into the input field
- User can edit before sending
- Voice transcription model is fixed (`whisper-large-v3`), not configurable

---

## Settings

### New Fields

Add to the `Settings` interface in `apps/extension/lib/types.ts`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chatModel` | `string` | `anthropic/claude-sonnet-4` | OpenRouter model for chat conversations |
| `groqApiKey` | `string` | `""` | Groq API key for voice transcription |

### Settings UI

Add a new section to the settings page (or extend the existing AI section):

**Chat section:**
- Chat Model — dropdown or text input with common model suggestions (same pattern as existing `aiModel` field)
- Groq API Key — password-style text input, shows "Voice input enabled" badge when configured

The existing `openRouterApiKey` is shared between document generation and chat — both use the same OpenRouter account. Only the model differs.

---

## Components

### Reuse from `@tab-zen/chat`

These components are already built and exported:

- `ChatContainer`, `ChatContainerContent`, `ChatContainerScrollAnchor` — scroll container
- `Message`, `MessageAvatar`, `MessageContent`, `MessageActions` — message rendering
- `PromptInput`, `PromptInputTextarea`, `PromptInputActions` — input area
- `ScrollButton` — scroll-to-bottom
- `Loader` — loading states
- `VoiceInput` — mic button + recording
- `ModelSwitcher` — inline model picker
- `Markdown` — markdown rendering in responses
- `CodeBlock` — syntax-highlighted code blocks
- `PromptSuggestion` — suggestion chips
- `Resizable` — resizable panels with drag handle
- `ConversationList`, `ConversationItem` — conversation browser (may need adaptation)

### Reuse from `apps/chat` (move to shared or replicate in extension)

- `streamChatCompletion` from `apps/chat/src/services/openrouter.ts` — OpenRouter streaming. The extension already has a similar pattern in `apps/extension/lib/ai.ts` but it's not streaming. We need the streaming version for chat. Replicate in `apps/extension/lib/chat/` since it's a small function.
- `transcribeAudio` from `apps/chat/src/services/voice.ts` — Groq Whisper call. Small function, replicate in extension.
- `createChatStore` pattern from `apps/chat/src/stores/chat-store.ts` — reactive conversation state. Replicate and adapt for extension context.
- `getChatDB` from `apps/chat/src/db.ts` — IndexedDB schema for chat. Replicate in extension. Same database name (`tab-zen-chat`) and schema so data is shared if both are running, but each app has its own `getChatDB` instance.
- `LocalAdapter` from `apps/chat/src/adapters/local-adapter.ts` — for this phase, we only need conversation CRUD (save, get, list, delete). Create a simplified adapter in the extension that skips embedding/vector methods (not needed for document-scoped chat).

### Build New (in `apps/extension`)

- `ChatPanel.tsx` — resizable panel wrapper for the detail page, manages open/close state, panel width, responsive behavior
- `ChatPanelContent.tsx` — the actual chat UI inside the panel (messages, input, conversation management)
- `ChatHistory.tsx` — full-panel history view with search, delete, delete-all
- `ChatFab.tsx` — updated FAB (replace existing placeholder)
- `chat-service.ts` — wiring layer that connects the chat UI to the extension's page data, settings, and OpenRouter streaming
- `title-generator.ts` — auto-title generation logic
- Settings UI additions for chat model and Groq API key

### New Components for `@tab-zen/chat` (if needed)

Review during implementation whether `ConversationList` needs a "recent conversations" variant (compact, inline above input) vs the full sidebar version already built. If so, add a `RecentConversations` component to the library.

---

## Data Flow

```
Extension Settings (chatModel, groqApiKey, openRouterApiKey)
        │
        ▼
DetailPage.tsx
  ├── page data (title, url, content)
  ├── ChatFab (toggle)
  └── ChatPanel
        ├── ChatPanelContent
        │     ├── reads page content (transcript/markdown)
        │     ├── manages conversation state (createChatStore)
        │     ├── streams responses (streamChatCompletion)
        │     ├── auto-generates titles (title-generator)
        │     └── VoiceInput → transcribeAudio (if groqApiKey)
        └── ChatHistory
              ├── queries conversations by documentId
              ├── search, delete, delete-all
              └── navigate back to conversation view
```

---

## What This Does NOT Cover

- Collection-scoped chat (querying across multiple documents)
- Embeddings or vector search
- Embedding model settings
- Turso or managed adapters
- Chat as a standalone route (`#/chat`)
- Ingestion pipeline (chunking + embedding captured content)

These are all future phases that build on this foundation.
