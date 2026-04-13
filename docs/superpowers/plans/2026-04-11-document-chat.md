# Document-Scoped Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conversational chat panel to the detail page that lets users chat with a single document's content, with voice input and conversation persistence.

**Architecture:** A resizable chat panel opens via FAB on the detail page. Full document content (transcript or markdown) is sent as context to OpenRouter with streaming responses. Conversations are stored in a separate IndexedDB database (`tab-zen-chat`). Voice transcription via Groq Whisper is gated behind an optional API key. Components from `@tab-zen/chat` are reused for the chat UI.

**Tech Stack:** SolidJS 1.9.x, `@tab-zen/chat` component library, OpenRouter streaming API (fetch + ReadableStream), Groq Whisper API, IndexedDB (idb), `@tab-zen/shared` types

**Design Spec:** `docs/superpowers/specs/2026-04-11-document-chat-design.md`

---

## File Structure

### apps/extension/lib/chat/ (new directory)

```
apps/extension/lib/chat/
├── chat-db.ts              # IndexedDB schema for chat (replicates apps/chat/src/db.ts)
├── chat-adapter.ts         # Simplified LocalAdapter for conversation CRUD only
├── chat-store.ts           # SolidJS reactive store for conversation state
├── chat-streaming.ts       # OpenRouter streaming chat completion
├── chat-voice.ts           # Groq Whisper transcription
└── chat-title.ts           # Auto-title generation via LLM
```

### apps/extension/components/detail/ (modifications + new files)

```
apps/extension/components/detail/
├── ChatFab.tsx             # MODIFY — larger FAB, better positioning
├── ChatPanel.tsx           # NEW — resizable panel wrapper
├── ChatPanelContent.tsx    # NEW — messages, input, conversation management
└── ChatHistory.tsx         # NEW — full-panel history view
```

### apps/extension/lib/types.ts (modify)

Add `chatModel` and `groqApiKey` to Settings interface and defaults.

### apps/extension/components/SettingsPanel.tsx (modify)

Add chat model and Groq API key fields to the AI settings tab.

### apps/extension/components/detail/DetailPage.tsx (modify)

Integrate ChatPanel into the layout alongside main content.

---

## Phase 1: Settings & Services

### Task 1: Add Chat Settings Fields

**Files:**
- Modify: `apps/extension/lib/types.ts`

- [ ] **Step 1: Add chatModel and groqApiKey to Settings interface**

In `apps/extension/lib/types.ts`, add two fields to the `Settings` interface after the `aiModel` field (line 9):

```typescript
  chatModel: string;
  groqApiKey: string;
```

- [ ] **Step 2: Add defaults to DEFAULT_SETTINGS**

In the same file, add to `DEFAULT_SETTINGS` after the `aiModel` default (line 36):

```typescript
  chatModel: "anthropic/claude-sonnet-4",
  groqApiKey: "",
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors (existing code doesn't reference these new fields yet)

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "feat(settings): add chatModel and groqApiKey settings fields"
```

---

### Task 2: Add Chat Settings UI

**Files:**
- Modify: `apps/extension/components/SettingsPanel.tsx`

- [ ] **Step 1: Add Chat Model select and Groq API Key input to AI tab**

In `apps/extension/components/SettingsPanel.tsx`, find the AI tab section. After the existing model `<select>` block (around line 259), add:

```tsx
            {/* Chat Model */}
            <div>
              <label class="block text-sm font-medium text-foreground mb-1.5">Chat Model</label>
              <p class="text-sm text-muted-foreground mb-2">Model used for document chat conversations</p>
              <select
                class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none"
                value={s().chatModel}
                onChange={(e) => save({ chatModel: e.currentTarget.value })}
              >
                <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                <option value="anthropic/claude-haiku-4">Claude Haiku 4</option>
                <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </div>

            {/* Groq API Key (Voice) */}
            <div>
              <label class="block text-sm font-medium text-foreground mb-1.5">
                Groq API Key
                {s().groqApiKey && (
                  <span class="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                    Voice enabled
                  </span>
                )}
              </label>
              <p class="text-sm text-muted-foreground mb-2">Optional — enables voice input in chat (Whisper transcription)</p>
              <input
                type="password"
                class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                value={s().groqApiKey}
                placeholder="gsk_..."
                onInput={(e) => save({ groqApiKey: e.currentTarget.value.trim() })}
              />
            </div>
```

- [ ] **Step 2: Verify the settings page renders**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension dev`
Open the extension, go to Settings → AI tab. Verify the Chat Model select and Groq API Key field appear.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/SettingsPanel.tsx
git commit -m "feat(settings): add chat model and Groq API key settings UI"
```

---

### Task 3: Chat Database and Adapter

**Files:**
- Create: `apps/extension/lib/chat/chat-db.ts`
- Create: `apps/extension/lib/chat/chat-adapter.ts`

- [ ] **Step 1: Create chat-db.ts**

```typescript
// apps/extension/lib/chat/chat-db.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Conversation, ConversationGroup } from '@tab-zen/shared';

interface ChatDB {
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by-groupId': string;
      'by-updatedAt': string;
    };
  };
  conversationGroups: {
    key: string;
    value: ConversationGroup;
    indexes: { 'by-sortOrder': number };
  };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;

export async function getChatDB(): Promise<IDBPDatabase<ChatDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatDB>('tab-zen-chat', 1, {
    upgrade(db) {
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by-groupId', 'groupId');
      convStore.createIndex('by-updatedAt', 'updatedAt');

      const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
      groupStore.createIndex('by-sortOrder', 'sortOrder');
    },
  });
  return dbInstance;
}
```

- [ ] **Step 2: Create chat-adapter.ts**

```typescript
// apps/extension/lib/chat/chat-adapter.ts
import type { Conversation, ConversationSummary } from '@tab-zen/shared';
import { getChatDB } from './chat-db';

export class ChatAdapter {
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getChatDB();
    await db.put('conversations', conversation);
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const db = await getChatDB();
    return db.get('conversations', conversationId);
  }

  async listConversations(documentId?: string): Promise<ConversationSummary[]> {
    const db = await getChatDB();
    const conversations = await db.getAll('conversations');
    const filtered = documentId
      ? conversations.filter((c) => c.scope.type === 'document' && c.scope.documentId === documentId)
      : conversations;

    return filtered
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        groupId: conv.groupId,
        scope: conv.scope,
        messageCount: conv.messages.length,
        lastMessageAt:
          conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1].createdAt
            : conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const db = await getChatDB();
    await db.delete('conversations', conversationId);
  }

  async deleteAllConversations(documentId: string): Promise<void> {
    const db = await getChatDB();
    const all = await db.getAll('conversations');
    const tx = db.transaction('conversations', 'readwrite');
    for (const conv of all) {
      if (conv.scope.type === 'document' && conv.scope.documentId === documentId) {
        await tx.store.delete(conv.id);
      }
    }
    await tx.done;
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      conv.title = title;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/chat/chat-db.ts apps/extension/lib/chat/chat-adapter.ts
git commit -m "feat(chat): add IndexedDB schema and adapter for conversation CRUD"
```

---

### Task 4: Chat Store

**Files:**
- Create: `apps/extension/lib/chat/chat-store.ts`

- [ ] **Step 1: Create reactive chat store**

```typescript
// apps/extension/lib/chat/chat-store.ts
import { createSignal, createResource } from 'solid-js';
import type { Conversation, ChatMessage } from '@tab-zen/shared';
import { ChatAdapter } from './chat-adapter';

const adapter = new ChatAdapter();

export function createDocumentChatStore(documentId: () => string) {
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [listKey, setListKey] = createSignal(0);

  const [conversations, { refetch: refetchList }] = createResource(
    () => ({ key: listKey(), docId: documentId() }),
    (params) => adapter.listConversations(params.docId),
  );

  const [activeConversation, { refetch: refetchActive }] = createResource(
    activeConversationId,
    (id) => (id ? adapter.getConversation(id) : undefined),
  );

  function refreshList() { setListKey((k) => k + 1); }

  async function createConversation(): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      title: 'New Thread',
      scope: { type: 'document', documentId: documentId() },
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await adapter.saveConversation(conversation);
    refreshList();
    setActiveConversationId(id);
    return id;
  }

  async function addMessage(message: ChatMessage) {
    const conv = activeConversation();
    if (!conv) return;
    const updated: Conversation = {
      ...conv,
      messages: [...conv.messages, message],
      updatedAt: new Date().toISOString(),
    };
    await adapter.saveConversation(updated);
    refetchActive();
    refreshList();
  }

  async function updateTitle(title: string) {
    const id = activeConversationId();
    if (!id) return;
    await adapter.renameConversation(id, title);
    refetchActive();
    refreshList();
  }

  async function deleteConversation(id: string) {
    await adapter.deleteConversation(id);
    if (activeConversationId() === id) setActiveConversationId(null);
    refreshList();
  }

  async function deleteAllConversations() {
    await adapter.deleteAllConversations(documentId());
    setActiveConversationId(null);
    refreshList();
  }

  function selectConversation(id: string) { setActiveConversationId(id); }

  function clearActive() { setActiveConversationId(null); }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    addMessage,
    updateTitle,
    deleteConversation,
    deleteAllConversations,
    selectConversation,
    clearActive,
    refreshList,
  };
}

export type DocumentChatStore = ReturnType<typeof createDocumentChatStore>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-store.ts
git commit -m "feat(chat): add reactive document chat store"
```

---

### Task 5: Streaming Chat and Voice Services

**Files:**
- Create: `apps/extension/lib/chat/chat-streaming.ts`
- Create: `apps/extension/lib/chat/chat-voice.ts`
- Create: `apps/extension/lib/chat/chat-title.ts`

- [ ] **Step 1: Create chat-streaming.ts**

```typescript
// apps/extension/lib/chat/chat-streaming.ts
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamChatCompletion(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
): AsyncGenerator<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tab-zen.app',
      'X-Title': 'Tab Zen Chat',
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${error}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        /* skip malformed SSE chunks */
      }
    }
  }
}

export interface DocumentChatContext {
  title: string;
  url: string;
  author?: string;
  contentType: 'transcript' | 'article';
  content: string;
}

export function buildSystemPrompt(doc: DocumentChatContext): string {
  return `You are a helpful assistant. The user is viewing a specific document and asking questions about it.

## Document
Title: ${doc.title}
Source: ${doc.url}
Author: ${doc.author || 'Unknown'}
Type: ${doc.contentType}

## Content
${doc.content}

Answer questions based on the document content above. If the user asks something not covered in the document, say so. Be concise and reference specific parts of the content when relevant.`;
}
```

- [ ] **Step 2: Create chat-voice.ts**

```typescript
// apps/extension/lib/chat/chat-voice.ts
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');

  const response = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq transcription error (${response.status}): ${error}`);
  }

  return response.text();
}
```

- [ ] **Step 3: Create chat-title.ts**

```typescript
// apps/extension/lib/chat/chat-title.ts
import type { ChatMessage } from '@tab-zen/shared';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateConversationTitle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string | null> {
  // Need at least one user message and one assistant response
  if (messages.length < 2) return null;

  // Check if the first user message is too vague to title
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (firstUserMsg && firstUserMsg.content.trim().length < 10) {
    // If we only have 2 messages and the user message is very short, wait
    if (messages.length <= 2) return null;
  }

  const titleMessages = messages.slice(0, 6).map((m) => `${m.role}: ${m.content}`).join('\n');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tab-zen.app',
      'X-Title': 'Tab Zen Chat',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `Generate a short title (under 50 characters) for this conversation. Return only the title text, nothing else.\n\n${titleMessages}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 60,
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const title = data.choices?.[0]?.message?.content?.trim();
  return title && title.length > 0 && title.length <= 60 ? title : null;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/chat/chat-streaming.ts apps/extension/lib/chat/chat-voice.ts apps/extension/lib/chat/chat-title.ts
git commit -m "feat(chat): add streaming, voice transcription, and auto-title services"
```

---

## Phase 2: Chat UI Components

### Task 6: Updated ChatFab

**Files:**
- Modify: `apps/extension/components/detail/ChatFab.tsx`

- [ ] **Step 1: Rewrite ChatFab as a simple toggle button**

The FAB no longer manages the chat overlay — it just emits an `onToggle` event. The panel is managed by `DetailPage.tsx`.

Replace the entire contents of `apps/extension/components/detail/ChatFab.tsx`:

```tsx
// apps/extension/components/detail/ChatFab.tsx
import { Show } from 'solid-js';
import { MessageCircle, X } from 'lucide-solid';

interface ChatFabProps {
  open: boolean;
  onToggle: () => void;
}

export default function ChatFab(props: ChatFabProps) {
  return (
    <button
      onClick={props.onToggle}
      class={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
        props.open
          ? 'bg-accent text-accent-foreground shadow-accent/30'
          : 'bg-accent text-accent-foreground hover:shadow-accent/20 hover:scale-105'
      }`}
      title={props.open ? 'Close chat' : 'Chat with this page'}
    >
      <Show when={props.open} fallback={<MessageCircle size={24} />}>
        <X size={24} />
      </Show>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: Errors in DetailPage.tsx where ChatFab is used (old API) — that's expected, we'll fix in Task 9.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatFab.tsx
git commit -m "feat(chat): update ChatFab to larger 56px toggle button"
```

---

### Task 7: Chat History Panel

**Files:**
- Create: `apps/extension/components/detail/ChatHistory.tsx`

- [ ] **Step 1: Create ChatHistory component**

```tsx
// apps/extension/components/detail/ChatHistory.tsx
import { createSignal, For, Show } from 'solid-js';
import { ArrowLeft, Search, Trash2 } from 'lucide-solid';
import type { ConversationSummary } from '@tab-zen/shared';
import type { DocumentChatStore } from '@/lib/chat/chat-store';

interface ChatHistoryProps {
  store: DocumentChatStore;
  onBack: () => void;
  onSelect: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChatHistory(props: ChatHistoryProps) {
  const [search, setSearch] = createSignal('');
  const [confirmDeleteAll, setConfirmDeleteAll] = createSignal(false);

  const filtered = () => {
    const q = search().toLowerCase();
    const list = props.store.conversations() ?? [];
    if (!q) return list;
    return list.filter((c: ConversationSummary) => c.title.toLowerCase().includes(q));
  };

  async function handleDelete(e: Event, id: string) {
    e.stopPropagation();
    await props.store.deleteConversation(id);
  }

  async function handleDeleteAll() {
    await props.store.deleteAllConversations();
    setConfirmDeleteAll(false);
    props.onBack();
  }

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center gap-2 px-3 py-2.5 bg-muted/30 flex-shrink-0">
        <button
          onClick={props.onBack}
          class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <span class="text-sm font-semibold text-foreground">History</span>
      </div>

      {/* Search */}
      <div class="px-3 py-2 flex-shrink-0">
        <div class="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
          <Search size={14} class="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search threads..."
            class="bg-transparent text-sm text-foreground outline-none w-full placeholder:text-muted-foreground/40"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div class="flex-1 overflow-y-auto px-2">
        <Show when={filtered().length > 0} fallback={
          <div class="text-center text-sm text-muted-foreground/40 py-12">No conversations</div>
        }>
          <For each={filtered()}>
            {(conv) => (
              <div
                class="group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => props.onSelect(conv.id)}
              >
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-foreground truncate">{conv.title}</div>
                  <div class="text-xs text-muted-foreground/60 mt-0.5">
                    {conv.messageCount} messages · {timeAgo(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  class="p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-400 hover:bg-muted/50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Delete all */}
      <Show when={(props.store.conversations() ?? []).length > 0}>
        <div class="px-3 py-3 flex-shrink-0">
          <Show when={confirmDeleteAll()} fallback={
            <button
              onClick={() => setConfirmDeleteAll(true)}
              class="w-full py-2 rounded-lg text-sm text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors"
            >
              Delete All History
            </button>
          }>
            <div class="flex gap-2">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                class="flex-1 py-2 rounded-lg text-sm text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                class="flex-1 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors (component is not imported anywhere yet)

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatHistory.tsx
git commit -m "feat(chat): add chat history panel with search and delete"
```

---

### Task 8: Chat Panel Content

**Files:**
- Create: `apps/extension/components/detail/ChatPanelContent.tsx`

- [ ] **Step 1: Create ChatPanelContent component**

```tsx
// apps/extension/components/detail/ChatPanelContent.tsx
import { createSignal, Show, For, onMount } from 'solid-js';
import { Plus, History, X, MessageCircle } from 'lucide-solid';
import {
  ChatContainer, Message, MessageAvatar, MessageContent,
  PromptInput, PromptInputTextarea, PromptInputActions,
  ScrollButton, Loader, PromptSuggestion, ModelSwitcher, VoiceInput,
} from '@tab-zen/chat';
import type { ChatMessage, ModelOption } from '@tab-zen/shared';
import type { DocumentChatStore } from '@/lib/chat/chat-store';
import { streamChatCompletion, buildSystemPrompt, type DocumentChatContext } from '@/lib/chat/chat-streaming';
import { transcribeAudio } from '@/lib/chat/chat-voice';
import { generateConversationTitle } from '@/lib/chat/chat-title';
import type { Settings } from '@/lib/types';
import ChatHistory from './ChatHistory';

const CHAT_MODELS: ModelOption[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'anthropic/claude-haiku-4', name: 'Claude Haiku 4', provider: 'Anthropic' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
];

interface ChatPanelContentProps {
  store: DocumentChatStore;
  documentContext: DocumentChatContext;
  settings: Settings;
  onClose: () => void;
}

type PanelView = 'chat' | 'history';

export default function ChatPanelContent(props: ChatPanelContentProps) {
  const [view, setView] = createSignal<PanelView>('chat');
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal('');
  const [promptText, setPromptText] = createSignal('');
  const [currentModel, setCurrentModel] = createSignal(props.settings.chatModel);
  const [titleGenerated, setTitleGenerated] = createSignal(false);

  const suggestions = [
    'What is this about?',
    'Summarize the key points',
    'What are the main arguments?',
  ];

  const recentConversations = () => {
    const list = props.store.conversations() ?? [];
    return list.slice(0, 3);
  };

  async function handleSendMessage(text: string) {
    if (!props.settings.openRouterApiKey) {
      alert('Please set your OpenRouter API key in Settings → AI');
      return;
    }

    // Create a conversation if none is active
    if (!props.store.activeConversationId()) {
      await props.store.createConversation();
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    await props.store.addMessage(userMessage);

    setIsStreaming(true);
    setStreamingContent('');

    const conv = props.store.activeConversation();
    if (!conv) return;

    const systemPrompt = buildSystemPrompt(props.documentContext);
    const messages = conv.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      let fullContent = '';
      for await (const chunk of streamChatCompletion(
        props.settings.openRouterApiKey,
        currentModel(),
        [{ role: 'system', content: systemPrompt }, ...messages],
      )) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        modelId: currentModel(),
        createdAt: new Date().toISOString(),
      };
      await props.store.addMessage(assistantMessage);

      // Auto-title generation (fire and forget)
      if (!titleGenerated()) {
        const updatedConv = props.store.activeConversation();
        if (updatedConv && updatedConv.title === 'New Thread') {
          const title = await generateConversationTitle(
            props.settings.openRouterApiKey,
            currentModel(),
            updatedConv.messages,
          );
          if (title) {
            await props.store.updateTitle(title);
            setTitleGenerated(true);
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        createdAt: new Date().toISOString(),
      };
      await props.store.addMessage(errorMessage);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }

  async function handleVoiceTranscribe(audio: Blob): Promise<string> {
    if (!props.settings.groqApiKey) throw new Error('Groq API key not configured');
    return transcribeAudio(props.settings.groqApiKey, audio);
  }

  function handleNewConversation() {
    props.store.clearActive();
    setTitleGenerated(false);
    setView('chat');
  }

  function handleSelectConversation(id: string) {
    props.store.selectConversation(id);
    setTitleGenerated(true); // Existing conversation already has a title (or doesn't need one)
    setView('chat');
  }

  return (
    <div class="flex flex-col h-full bg-card">
      <Show when={view() === 'history'}>
        <ChatHistory
          store={props.store}
          onBack={() => setView('chat')}
          onSelect={handleSelectConversation}
        />
      </Show>

      <Show when={view() === 'chat'}>
        {/* Header */}
        <div class="flex items-center justify-between px-3 py-2.5 bg-muted/30 flex-shrink-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-sm font-semibold text-foreground truncate">
              {props.store.activeConversation()?.title ?? 'New Thread'}
            </span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <ModelSwitcher
              models={CHAT_MODELS}
              currentModelId={currentModel()}
              onModelChange={setCurrentModel}
            />
            <button
              onClick={handleNewConversation}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="New conversation"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setView('history')}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="History"
            >
              <History size={16} />
            </button>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatContainer class="flex-1 px-3 py-3">
          <div class="space-y-3">
            <Show when={props.store.activeConversation()?.messages.length} fallback={
              <div class="flex-1 flex flex-col items-center justify-center py-12">
                <MessageCircle size={28} class="mb-3 text-muted-foreground/20" />
                <p class="text-sm text-muted-foreground">Ask anything about this page</p>
              </div>
            }>
              <For each={props.store.activeConversation()?.messages}>
                {(msg) => (
                  <Message role={msg.role}>
                    <Show when={msg.role === 'assistant'}>
                      <MessageAvatar fallback="AI" />
                    </Show>
                    <MessageContent>{msg.content}</MessageContent>
                  </Message>
                )}
              </For>
            </Show>

            {/* Streaming response */}
            <Show when={isStreaming()}>
              <Message role="assistant">
                <MessageAvatar fallback="AI" />
                <MessageContent>
                  <Show when={streamingContent()} fallback={<Loader variant="loading-dots" size="sm" />}>
                    {streamingContent()}
                  </Show>
                </MessageContent>
              </Message>
            </Show>
          </div>
          <ScrollButton />
        </ChatContainer>

        {/* Recent conversations (when no active conversation) */}
        <Show when={!props.store.activeConversationId() && recentConversations().length > 0}>
          <div class="px-3 pb-2 flex-shrink-0">
            <div class="text-xs text-muted-foreground/60 mb-1.5">Recent</div>
            <For each={recentConversations()}>
              {(conv) => (
                <button
                  onClick={() => handleSelectConversation(conv.id)}
                  class="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-foreground/80 hover:bg-muted/30 transition-colors truncate"
                >
                  {conv.title}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Prompt suggestions (when no messages) */}
        <Show when={!props.store.activeConversation()?.messages.length && !props.store.activeConversationId()}>
          <div class="flex gap-1.5 px-3 pb-2 flex-wrap justify-center flex-shrink-0">
            <For each={suggestions}>
              {(suggestion) => (
                <PromptSuggestion onClick={() => handleSendMessage(suggestion)}>
                  {suggestion}
                </PromptSuggestion>
              )}
            </For>
          </div>
        </Show>

        {/* Input */}
        <div class="px-3 pb-3 pt-1 flex-shrink-0">
          <PromptInput
            isLoading={isStreaming()}
            value={promptText()}
            onValueChange={setPromptText}
            onSubmit={() => {
              const text = promptText().trim();
              if (text) {
                setPromptText('');
                handleSendMessage(text);
              }
            }}
          >
            <PromptInputTextarea placeholder="Ask about this page..." />
            <Show when={!!props.settings.groqApiKey}>
              <PromptInputActions>
                <VoiceInput
                  onTranscribe={handleVoiceTranscribe}
                  onTranscription={(text) => handleSendMessage(text)}
                />
              </PromptInputActions>
            </Show>
          </PromptInput>
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: May have minor import path issues — fix any alias issues (the extension uses `@/` aliases for `./src/`). Check `apps/extension/tsconfig.json` for alias configuration and adjust import paths if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): add ChatPanelContent with streaming, voice, and conversation management"
```

---

### Task 9: Chat Panel Wrapper (Resizable)

**Files:**
- Create: `apps/extension/components/detail/ChatPanel.tsx`

- [ ] **Step 1: Create ChatPanel resizable wrapper**

```tsx
// apps/extension/components/detail/ChatPanel.tsx
import { createSignal, Show, onMount } from 'solid-js';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@tab-zen/chat';
import type { DocumentChatContext } from '@/lib/chat/chat-streaming';
import type { DocumentChatStore } from '@/lib/chat/chat-store';
import type { Settings } from '@/lib/types';
import ChatPanelContent from './ChatPanelContent';

const CHAT_PANEL_WIDTH_KEY = 'tab-zen-chat-panel-width';
const DEFAULT_PANEL_WIDTH = 380;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 600;

interface ChatPanelProps {
  open: boolean;
  store: DocumentChatStore;
  documentContext: DocumentChatContext;
  settings: Settings;
  narrow: boolean;
  onClose: () => void;
  children: any; // Main content
}

export default function ChatPanel(props: ChatPanelProps) {
  const [panelWidth, setPanelWidth] = createSignal(DEFAULT_PANEL_WIDTH);

  onMount(() => {
    const stored = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    if (stored) {
      const w = parseInt(stored, 10);
      if (w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) setPanelWidth(w);
    }
  });

  function handleResize() {
    // After drag, read the actual width from the DOM and persist
    const panel = document.querySelector('[data-chat-panel]') as HTMLElement | null;
    if (panel) {
      const width = panel.getBoundingClientRect().width;
      setPanelWidth(Math.round(width));
      localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(Math.round(width)));
    }
  }

  return (
    <Show when={!props.narrow} fallback={
      // Narrow: main content or overlay
      <>
        <Show when={!props.open}>
          {props.children}
        </Show>
        <Show when={props.open}>
          <div class="flex-1 min-w-0 flex flex-col">
            <ChatPanelContent
              store={props.store}
              documentContext={props.documentContext}
              settings={props.settings}
              onClose={props.onClose}
            />
          </div>
        </Show>
      </>
    }>
      {/* Wide: resizable split */}
      <Show when={props.open} fallback={props.children}>
        <ResizablePanelGroup orientation="horizontal" class="flex-1 min-w-0">
          <ResizablePanel class="min-w-0">
            {props.children}
          </ResizablePanel>
          <ResizableHandle withHandle onPanelResize={handleResize} />
          <ResizablePanel
            defaultSize={Math.round((panelWidth() / (window.innerWidth - 300)) * 100)}
            data-chat-panel
            data-min-size={String(MIN_PANEL_WIDTH)}
            data-max-size={String(MAX_PANEL_WIDTH)}
          >
            <ChatPanelContent
              store={props.store}
              documentContext={props.documentContext}
              settings={props.settings}
              onClose={props.onClose}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Show>
    </Show>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension exec tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatPanel.tsx
git commit -m "feat(chat): add resizable ChatPanel wrapper with width persistence"
```

---

## Phase 3: Integration

### Task 10: Integrate Chat into DetailPage

**Files:**
- Modify: `apps/extension/components/detail/DetailPage.tsx`

This is the most complex task — it wires the ChatFab, ChatPanel, and chat store into the existing detail page layout.

- [ ] **Step 1: Add imports to DetailPage.tsx**

At the top of `apps/extension/components/detail/DetailPage.tsx`, add these imports (near the existing component imports):

```typescript
import { createDocumentChatStore } from '@/lib/chat/chat-store';
import type { DocumentChatContext } from '@/lib/chat/chat-streaming';
import ChatPanel from './ChatPanel';
```

- [ ] **Step 2: Add chat state signals**

Inside the `DetailPage` component function, after the existing signals (near line 67), add:

```typescript
  const [chatOpen, setChatOpen] = createSignal(false);

  const chatStore = createDocumentChatStore(() => props.page.id);

  const documentChatContext = (): DocumentChatContext => {
    const hasTranscript = transcriptSegments().length > 0;
    return {
      title: props.page.title,
      url: props.page.url,
      author: props.page.author,
      contentType: hasTranscript ? 'transcript' : 'article',
      content: hasTranscript
        ? transcriptSegments().map((s) => s.text).join(' ')
        : markdownContent(),
    };
  };
```

Note: `transcriptSegments` and `markdownContent` are existing signals already defined in DetailPage.

- [ ] **Step 3: Update ChatFab usage**

Find the existing `<ChatFab />` near line 931 and replace it with:

```tsx
        <ChatFab open={chatOpen()} onToggle={() => setChatOpen(!chatOpen())} />
```

- [ ] **Step 4: Wrap the main content area with ChatPanel**

This is the most surgical change. The current layout has a scrollable div containing the content column and right sidebar. We need to wrap the main content flex column (everything after the left nav) with the ChatPanel component.

Find the main content column div (the `<div class="flex-1 min-w-0 flex flex-col">` wrapper around line 646). Wrap its content with ChatPanel:

The main content column currently contains a header area and a scrollable area. We need to:

1. Keep the outer `div.flex-1.min-w-0.flex.flex-col` as-is
2. Inside it, wrap the scrollable content area with `<ChatPanel>`

Replace the scrollable content area (the `<div ref={scrollRef} class="flex-1 overflow-y-auto ...">`) by wrapping it:

```tsx
          <ChatPanel
            open={chatOpen()}
            store={chatStore}
            documentContext={documentChatContext()}
            settings={settings()!}
            narrow={hideRightNav()}
            onClose={() => setChatOpen(false)}
          >
            <div ref={scrollRef} class="flex-1 overflow-y-auto ...">
              {/* existing scrollable content unchanged */}
            </div>
          </ChatPanel>
```

The `settings()` accessor comes from the existing `useSettings()` call already in DetailPage. Find where it's used — likely through a `settings` resource. Pass it with the `!` assertion since the panel only renders when settings are loaded.

- [ ] **Step 5: Verify the extension builds and runs**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter tab-zen-extension dev`
Open the extension. Navigate to a captured page's detail view. Verify:
- The FAB appears at bottom-right (larger than before)
- Clicking the FAB opens the chat panel on the right
- The main content compresses to make room
- The drag handle works for resizing
- Clicking X or the FAB again closes the panel
- On a narrow window, the chat overlays instead of pushing

- [ ] **Step 6: Commit**

```bash
git add apps/extension/components/detail/DetailPage.tsx
git commit -m "feat(chat): integrate chat panel into detail page layout"
```

---

### Task 11: End-to-End Testing

**Files:** None (testing existing code)

- [ ] **Step 1: Test basic chat flow**

With the dev server running:
1. Open the extension, go to Settings → AI
2. Enter your OpenRouter API key (if not already set)
3. Set a Chat Model (or leave default)
4. Capture a YouTube video or web page
5. Open its detail page
6. Click the chat FAB
7. Type "What is this about?" and press Enter
8. Verify: message appears, streaming response renders, conversation saves
9. Close and reopen the panel — conversation should still be there

- [ ] **Step 2: Test conversation management**

1. Start a new conversation (click + button)
2. Send a message — verify a new conversation is created
3. Click the history button — verify both conversations appear
4. Search for one by title
5. Delete one conversation
6. Verify it's removed from the list

- [ ] **Step 3: Test auto-title generation**

1. Start a new conversation (should show "New Thread")
2. Ask a substantive question (e.g., "What React patterns are discussed in this video?")
3. After the response, wait a moment — the title should update from "New Thread" to something descriptive
4. The title should appear in the header and in the history list

- [ ] **Step 4: Test voice input (if Groq key configured)**

1. Go to Settings → AI, enter a Groq API key
2. Open a detail page, open chat
3. Verify the mic button appears in the input area
4. Click and speak, verify transcription appears in the input
5. Remove the Groq API key from settings — verify mic button disappears

- [ ] **Step 5: Test responsive behavior**

1. Resize the browser window to be narrow (< 1024px)
2. Open chat — verify it overlays the content area (not side by side)
3. Resize back to wide — verify it becomes a side panel with push behavior

- [ ] **Step 6: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix(chat): address issues found during end-to-end testing"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Settings fields (chatModel, groqApiKey) | None |
| 2 | Settings UI for chat model and Groq key | Task 1 |
| 3 | Chat database and adapter | None |
| 4 | Chat store (reactive) | Task 3 |
| 5 | Streaming, voice, and title services | None |
| 6 | Updated ChatFab | None |
| 7 | Chat history panel | Task 4 |
| 8 | Chat panel content (main UI) | Tasks 4, 5 |
| 9 | Resizable panel wrapper | None |
| 10 | DetailPage integration | Tasks 1-9 |
| 11 | End-to-end testing | Task 10 |

**Parallelizable groups:**
- Tasks 1+3+5+6+9 can all be done in parallel (no dependencies)
- Tasks 2+4+7 can be done once their single dependency completes
- Task 8 needs Tasks 4+5
- Task 10 needs everything
- Task 11 is final validation
