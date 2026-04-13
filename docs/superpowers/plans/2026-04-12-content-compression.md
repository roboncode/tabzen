# Caveman Content Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically compress document content (transcripts/articles) into a token-efficient format before using it as chat context, reducing token usage by 50-70% while preserving all factual substance.

**Architecture:** A compression service runs a one-time LLM call to compress the full document content using Caveman-style techniques (drop filler, use short synonyms, preserve facts). The compressed version is stored in IndexedDB keyed by page ID. The context manager checks for a compressed version first and falls back to the original. The compression prompt is stored as an editable markdown file following the project's AI prompt conventions. The debug panel shows which version is being used and the token savings.

**Tech Stack:** SolidJS, OpenRouter API, IndexedDB (idb), existing chat services

---

## File Structure

### apps/extension/prompts/ (new file)

```
apps/extension/prompts/
└── content-compress.md        # NEW — compression prompt template
```

### apps/extension/lib/chat/ (new + modified)

```
apps/extension/lib/chat/
├── chat-compress.ts           # NEW — compression service
├── chat-db.ts                 # MODIFY — add compressedContent store
├── chat-context-manager.ts    # MODIFY — use compressed content when available
└── chat-adapter.ts            # MODIFY — add compressed content CRUD
```

### apps/extension/components/detail/ (modified)

```
apps/extension/components/detail/
├── ChatPanelContent.tsx        # MODIFY — trigger compression, show status
└── ChatDebugPanel.tsx          # MODIFY — show compression info
```

---

## Phase 1: Compression Prompt & Service

### Task 1: Compression Prompt Template

**Files:**
- Create: `apps/extension/prompts/content-compress.md`

- [ ] **Step 1: Create the compression prompt**

```markdown
# Content Compression

Compress the following document content for use as AI chat context. Your goal is to reduce token usage by 50-70% while preserving ALL factual substance.

## Rules

- Drop: articles (a/an/the), filler words (just, really, basically, actually, simply, essentially), hedging (I think, sort of, kind of, perhaps), pleasantries, redundant phrasing
- Keep: all technical terms exact, all names/dates/numbers/URLs exact, all facts and claims, causal relationships, key quotes
- Use short synonyms (big not extensive, fix not "implement a solution for", show not demonstrate)
- Fragments OK — no need for complete sentences
- Preserve section structure if present (headings, lists)
- For transcripts: merge overlapping/repeated points, drop verbal filler (um, uh, you know, like), collapse stutters
- For articles: preserve paragraph breaks as single line breaks
- Do NOT add commentary, interpretation, or new information
- Do NOT use abbreviations that aren't in the original

## Format

Return ONLY the compressed content. No preamble, no explanation, no wrapper text.

## Content to compress

{{content}}
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/prompts/content-compress.md
git commit -m "feat(chat): add content compression prompt template"
```

---

### Task 2: Storage for Compressed Content

**Files:**
- Modify: `apps/extension/lib/chat/chat-db.ts`
- Modify: `apps/extension/lib/chat/chat-adapter.ts`

- [ ] **Step 1: Add compressedContent store to chat-db.ts**

The chat DB currently uses version 1 with `conversations` and `conversationGroups` stores. We need to bump to version 2 and add a `compressedContent` store.

Replace the entire `getChatDB` function in `apps/extension/lib/chat/chat-db.ts`:

```typescript
export async function getChatDB(): Promise<IDBPDatabase<ChatDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatDB>('tab-zen-chat', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by-groupId', 'groupId');
        convStore.createIndex('by-updatedAt', 'updatedAt');

        const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
        groupStore.createIndex('by-sortOrder', 'sortOrder');
      }
      if (oldVersion < 2) {
        db.createObjectStore('compressedContent', { keyPath: 'pageId' });
      }
    },
  });
  return dbInstance;
}
```

Also update the `ChatDB` interface to add the new store:

```typescript
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
  compressedContent: {
    key: string;
    value: CompressedContent;
  };
}
```

Add the `CompressedContent` interface at the top of the file (after imports):

```typescript
export interface CompressedContent {
  pageId: string;
  originalTokens: number;
  compressedTokens: number;
  compressedText: string;
  modelUsed: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add compressed content methods to ChatAdapter**

In `apps/extension/lib/chat/chat-adapter.ts`, add these imports at the top:

```typescript
import { getChatDB, type CompressedContent } from './chat-db';
```

Update the existing `getChatDB` import to include `CompressedContent`. Then add these methods to the `ChatAdapter` class:

```typescript
  async getCompressedContent(pageId: string): Promise<CompressedContent | undefined> {
    const db = await getChatDB();
    return db.get('compressedContent', pageId);
  }

  async saveCompressedContent(content: CompressedContent): Promise<void> {
    const db = await getChatDB();
    await db.put('compressedContent', content);
  }

  async deleteCompressedContent(pageId: string): Promise<void> {
    const db = await getChatDB();
    await db.delete('compressedContent', pageId);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/chat/chat-db.ts apps/extension/lib/chat/chat-adapter.ts
git commit -m "feat(chat): add compressed content storage to IndexedDB"
```

---

### Task 3: Compression Service

**Files:**
- Create: `apps/extension/lib/chat/chat-compress.ts`

- [ ] **Step 1: Create the compression service**

```typescript
// apps/extension/lib/chat/chat-compress.ts
import { streamChatCompletion } from "./chat-streaming";
import { estimateTokens } from "./chat-models";
import { ChatAdapter } from "./chat-adapter";
import type { CompressedContent } from "./chat-db";
// @ts-ignore — Vite raw import
import compressPromptRaw from "@/prompts/content-compress.md?raw";

const adapter = new ChatAdapter();

export interface CompressionResult {
  compressed: CompressedContent;
  isNew: boolean;
}

/**
 * Gets or creates compressed content for a page.
 * Returns cached version if available, otherwise compresses and stores.
 */
export async function getOrCompressContent(
  pageId: string,
  originalContent: string,
  apiKey: string,
  modelId: string,
  onProgress?: (status: string) => void,
): Promise<CompressionResult> {
  // Check cache first
  const existing = await adapter.getCompressedContent(pageId);
  if (existing) {
    return { compressed: existing, isNew: false };
  }

  // Compress
  onProgress?.("Compressing content for chat...");

  const prompt = compressPromptRaw.replace("{{content}}", originalContent);
  let compressedText = "";

  for await (const chunk of streamChatCompletion(apiKey, modelId, [
    { role: "user", content: prompt },
  ])) {
    compressedText += chunk;
  }

  compressedText = compressedText.trim();

  const originalTokens = estimateTokens(originalContent);
  const compressedTokens = estimateTokens(compressedText);

  const compressed: CompressedContent = {
    pageId,
    originalTokens,
    compressedTokens,
    compressedText,
    modelUsed: modelId,
    createdAt: new Date().toISOString(),
  };

  await adapter.saveCompressedContent(compressed);
  onProgress?.("");

  return { compressed, isNew: true };
}

/**
 * Invalidates cached compressed content for a page.
 * Call when the original content changes.
 */
export async function invalidateCompressedContent(pageId: string): Promise<void> {
  await adapter.deleteCompressedContent(pageId);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

Note: The `?raw` import may need a type declaration. If TypeScript complains, check if `apps/extension/` already has a `*.md` module declaration. The WXT framework typically handles this. If not, add to `apps/extension/env.d.ts` or equivalent:

```typescript
declare module '*.md?raw' {
  const content: string;
  export default content;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-compress.ts
git commit -m "feat(chat): add content compression service with caching"
```

---

## Phase 2: Integration

### Task 4: Update Context Manager to Use Compressed Content

**Files:**
- Modify: `apps/extension/lib/chat/chat-context-manager.ts`

- [ ] **Step 1: Update DocumentChatContext and preparePayload**

The `DocumentChatContext` type lives in `chat-streaming.ts`. We don't need to change it — the `content` field will just receive compressed text instead of original text. The change happens at the call site.

However, we need to update the `ContextSnapshot` to include compression info. In `apps/extension/lib/chat/chat-context-manager.ts`, add these fields to the `ContextSnapshot` interface:

```typescript
export interface ContextSnapshot {
  systemPromptTokens: number;
  documentTokens: number;
  summaryTokens: number;
  messageTokens: number;
  totalInputTokens: number;
  maxInputTokens: number;
  maxContextTokens: number;
  messagesIncluded: number;
  messagesTotal: number;
  hasBeenCompacted: boolean;
  summary: string | null;
  // Compression info
  isCompressed: boolean;
  originalDocumentTokens: number | null;
  compressionSavings: number | null; // percentage saved, e.g. 0.65 = 65%
}
```

Update the `preparePayload` function signature to accept optional compression info:

```typescript
export function preparePayload(
  documentContext: DocumentChatContext,
  conversationMessages: ChatMessage[],
  existingSummary: string | null,
  modelId: string,
  compressionInfo?: { originalTokens: number; compressedTokens: number },
): PreparedPayload {
```

And update the snapshot construction at the bottom of `preparePayload` to include:

```typescript
      // Compression info
      isCompressed: compressionInfo !== undefined,
      originalDocumentTokens: compressionInfo?.originalTokens ?? null,
      compressionSavings: compressionInfo
        ? 1 - (compressionInfo.compressedTokens / compressionInfo.originalTokens)
        : null,
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

Fix any type errors in files that use `ContextSnapshot` (ChatDebugPanel.tsx, ChatPanelContent.tsx) — the new fields are all optional-ish (`null` defaults) so they should be backward compatible.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-context-manager.ts
git commit -m "feat(chat): add compression info to ContextSnapshot"
```

---

### Task 5: Integrate Compression into ChatPanelContent

**Files:**
- Modify: `apps/extension/components/detail/ChatPanelContent.tsx`

- [ ] **Step 1: Add imports and state**

Add to imports:

```typescript
import { getOrCompressContent } from "@/lib/chat/chat-compress";
```

Add state signals after the existing ones:

```typescript
  const [compressionStatus, setCompressionStatus] = createSignal("");
  const [compressedContent, setCompressedContent] = createSignal<string | null>(null);
  const [compressionInfo, setCompressionInfo] = createSignal<{ originalTokens: number; compressedTokens: number } | null>(null);
```

- [ ] **Step 2: Add compression trigger on first message**

In `handleSendMessage`, after the `setIsStreaming(true)` line and before the payload preparation, add compression logic:

```typescript
    // Compress content on first use (cached for subsequent messages)
    let docContent = props.documentContext.content;
    let compInfo = compressionInfo();

    if (!compressedContent() && docContent.length > 500) {
      try {
        const result = await getOrCompressContent(
          props.documentContext.url, // use URL as stable page ID for compression cache
          docContent,
          props.settings.openRouterApiKey,
          currentModel(),
          setCompressionStatus,
        );
        setCompressedContent(result.compressed.compressedText);
        setCompressionInfo({
          originalTokens: result.compressed.originalTokens,
          compressedTokens: result.compressed.compressedTokens,
        });
        docContent = result.compressed.compressedText;
        compInfo = {
          originalTokens: result.compressed.originalTokens,
          compressedTokens: result.compressed.compressedTokens,
        };
      } catch (err) {
        console.error("Compression failed, using original:", err);
        // Fall through to use original content
      }
    } else if (compressedContent()) {
      docContent = compressedContent()!;
      compInfo = compressionInfo();
    }

    // Build modified document context with compressed content
    const chatContext = { ...props.documentContext, content: docContent };
```

Then update the `preparePayload` call to use `chatContext` and pass `compInfo`:

```typescript
    const { messages: llmMessages, snapshot } = preparePayload(
      chatContext,
      allMessages,
      props.store.conversationSummary(),
      currentModel(),
      compInfo ?? undefined,
    );
```

- [ ] **Step 3: Show compression status**

Add a compression status indicator below the header (after the debug panel `</Show>` and before `{/* Messages */}`):

```tsx
        {/* Compression status */}
        <Show when={compressionStatus()}>
          <div class="px-4 py-1.5 text-xs text-muted-foreground bg-muted/20 flex-shrink-0 flex items-center gap-2">
            <Loader variant="loading-dots" size="sm" />
            {compressionStatus()}
          </div>
        </Show>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): integrate content compression into chat flow"
```

---

### Task 6: Update Debug Panel with Compression Info

**Files:**
- Modify: `apps/extension/components/detail/ChatDebugPanel.tsx`

- [ ] **Step 1: Add compression section to debug panel**

In `apps/extension/components/detail/ChatDebugPanel.tsx`, add a compression info section after the token overview `</Show>` and before the `{/* Sections */}` comment:

```tsx
      {/* Compression info */}
      <Show when={snapshot()?.isCompressed}>
        <div class="px-3 py-2 bg-emerald-500/5 flex-shrink-0">
          <div class="flex justify-between text-xs">
            <span class="text-emerald-400">Content compressed</span>
            <span class="font-mono text-emerald-400">
              {snapshot()?.originalDocumentTokens?.toLocaleString()} → {snapshot()?.documentTokens.toLocaleString()} tokens
              ({Math.round((snapshot()?.compressionSavings ?? 0) * 100)}% saved)
            </span>
          </div>
        </div>
      </Show>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatDebugPanel.tsx
git commit -m "feat(chat): show compression savings in debug panel"
```

---

### Task 7: Update Context Component with Compression Badge

**Files:**
- Modify: `apps/extension/components/detail/ChatPanelContent.tsx`

- [ ] **Step 1: Add compression savings to the Context hover card**

In the Context component's `ContextContentBody` section in ChatPanelContent.tsx, add a compression row:

Find the existing `ContextContentBody` block and add after the summary `<Show>`:

```tsx
                        <Show when={snap().isCompressed}>
                          <div class="flex justify-between text-emerald-400">
                            <span>Compressed</span>
                            <span>{Math.round((snap().compressionSavings ?? 0) * 100)}% saved</span>
                          </div>
                        </Show>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): show compression savings in Context hover card"
```

---

## Phase 3: Testing

### Task 8: End-to-End Testing

**Files:** None (manual testing)

- [ ] **Step 1: Test first-message compression**

1. Open a captured page with a transcript or article
2. Open the chat panel
3. Send a message: "What is this about?"
4. Observe: "Compressing content for chat..." status should appear briefly
5. The response should arrive normally
6. Open debug panel — Document Content section should show the compressed version
7. Check compression info in debug panel — green banner showing original → compressed tokens

- [ ] **Step 2: Test compression caching**

1. Close and reopen the chat panel
2. Start a new conversation
3. Send a message
4. This time: no "Compressing..." status — it should use the cached version
5. Debug panel should still show compressed content

- [ ] **Step 3: Test Context hover card**

1. Hover over the token percentage in the header
2. Verify "Compressed: X% saved" row appears in green

- [ ] **Step 4: Test short content (no compression)**

1. Open a page with very short content (< 500 chars)
2. Open chat, send a message
3. No compression should happen — original content used directly

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(chat): address issues found during compression testing"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Compression prompt template | None |
| 2 | IndexedDB storage for compressed content | None |
| 3 | Compression service with caching | Tasks 1, 2 |
| 4 | Update ContextSnapshot with compression info | None |
| 5 | Integrate compression into ChatPanelContent | Tasks 3, 4 |
| 6 | Update debug panel with compression info | Task 4 |
| 7 | Update Context hover card with compression badge | Task 5 |
| 8 | End-to-end testing | Task 7 |

**Parallelizable:** Tasks 1+2+4 have no dependencies. Task 3 needs 1+2. Tasks 5+6 can start once their deps are done. Task 7 needs 5. Task 8 is last.
