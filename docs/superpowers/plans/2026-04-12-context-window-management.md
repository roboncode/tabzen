# Context Window Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add token counting, sliding window with conversation compaction, a Context usage indicator, and a debug panel that shows the full LLM payload in real-time.

**Architecture:** A context manager service sits between the chat UI and the streaming service. It estimates tokens for each component (system prompt, document, conversation summary, messages), applies a sliding window when approaching the model's limit, triggers compaction of old messages into a summary, and exposes usage data for the Context component and debug panel. The debug panel is a toggleable drawer inside the chat panel.

**Tech Stack:** SolidJS, OpenRouter API, `@tab-zen/chat` Context component, existing chat services

---

## File Structure

### apps/extension/lib/chat/ (new + modified)

```
apps/extension/lib/chat/
├── chat-context-manager.ts   # NEW — token counting, sliding window, compaction orchestration
├── chat-models.ts            # NEW — model definitions with token limits
├── chat-streaming.ts         # MODIFY — accept pre-built messages array instead of building internally
├── chat-store.ts             # MODIFY — store conversation summary
└── chat-adapter.ts           # MODIFY — persist summary field on conversation
```

### apps/extension/components/detail/ (new + modified)

```
apps/extension/components/detail/
├── ChatPanelContent.tsx       # MODIFY — integrate context manager, add Context component, debug toggle
└── ChatDebugPanel.tsx         # NEW — debug/transparency drawer showing LLM payload
```

---

## Phase 1: Model Definitions & Token Estimation

### Task 1: Model Definitions with Token Limits

**Files:**
- Create: `apps/extension/lib/chat/chat-models.ts`

- [ ] **Step 1: Create model definitions file**

```typescript
// apps/extension/lib/chat/chat-models.ts
import type { ModelOption } from "@tab-zen/shared";

export interface ChatModel extends ModelOption {
  maxContextTokens: number;
}

export const CHAT_MODELS: ChatModel[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", maxContextTokens: 128000 },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", maxContextTokens: 128000 },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", maxContextTokens: 200000 },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic", maxContextTokens: 200000 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", maxContextTokens: 1000000 },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", maxContextTokens: 1000000 },
];

export function getModelByIdOrDefault(modelId: string): ChatModel {
  return CHAT_MODELS.find((m) => m.id === modelId) ?? CHAT_MODELS[0];
}

/**
 * Approximate token count from text.
 * Uses ~4 chars per token heuristic. Not exact, but good enough for
 * context window budgeting. Overestimates slightly which is safer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-models.ts
git commit -m "feat(chat): add model definitions with token limits and estimator"
```

---

### Task 2: Context Manager Service

**Files:**
- Create: `apps/extension/lib/chat/chat-context-manager.ts`

- [ ] **Step 1: Create context manager**

```typescript
// apps/extension/lib/chat/chat-context-manager.ts
import type { ChatMessage } from "@tab-zen/shared";
import type { DocumentChatContext } from "./chat-streaming";
import { estimateTokens, getModelByIdOrDefault } from "./chat-models";
import { streamChatCompletion } from "./chat-streaming";

const CONTEXT_BUDGET_RATIO = 0.75; // Use 75% of context for input, leave 25% for output
const COMPACTION_THRESHOLD = 0.70; // Compact when input usage exceeds 70% of budget
const MIN_RECENT_MESSAGES = 4; // Always keep at least the last 4 messages (2 exchanges)

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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
}

export interface PreparedPayload {
  messages: LLMMessage[];
  snapshot: ContextSnapshot;
}

/**
 * Builds the LLM message array with context window management.
 * Applies sliding window + compaction when approaching limits.
 */
export function preparePayload(
  documentContext: DocumentChatContext,
  conversationMessages: ChatMessage[],
  existingSummary: string | null,
  modelId: string,
): PreparedPayload {
  const model = getModelByIdOrDefault(modelId);
  const maxInputTokens = Math.floor(model.maxContextTokens * CONTEXT_BUDGET_RATIO);

  // Build system prompt
  const systemPrompt = buildFullSystemPrompt(documentContext);
  const systemPromptTokens = estimateTokens(systemPrompt);

  // Document tokens are part of the system prompt
  const documentTokens = estimateTokens(documentContext.content);

  // Summary tokens (if any)
  const summaryTokens = existingSummary ? estimateTokens(existingSummary) : 0;

  // Fixed cost: system prompt + summary
  const fixedTokens = systemPromptTokens + summaryTokens;
  const budgetForMessages = maxInputTokens - fixedTokens;

  // Calculate how many messages fit in the remaining budget
  let messageTokens = 0;
  let startIndex = 0;

  // Estimate all message tokens
  const messageTokenEstimates = conversationMessages.map((m) => estimateTokens(m.content) + 4); // +4 for role/framing

  // Total message tokens
  const totalMessageTokens = messageTokenEstimates.reduce((a, b) => a + b, 0);

  if (totalMessageTokens <= budgetForMessages) {
    // All messages fit
    messageTokens = totalMessageTokens;
    startIndex = 0;
  } else {
    // Sliding window: work backwards from most recent
    messageTokens = 0;
    startIndex = conversationMessages.length;
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const tokenCost = messageTokenEstimates[i];
      if (messageTokens + tokenCost > budgetForMessages && startIndex < conversationMessages.length - MIN_RECENT_MESSAGES + 1) {
        break;
      }
      messageTokens += tokenCost;
      startIndex = i;
    }
  }

  const includedMessages = conversationMessages.slice(startIndex);

  // Build the LLM messages array
  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add summary if exists
  if (existingSummary) {
    llmMessages.push({
      role: "system",
      content: `## Previous Conversation Context\n${existingSummary}`,
    });
  }

  // Add the included messages
  for (const msg of includedMessages) {
    llmMessages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  const totalInputTokens = fixedTokens + messageTokens;

  return {
    messages: llmMessages,
    snapshot: {
      systemPromptTokens,
      documentTokens,
      summaryTokens,
      messageTokens,
      totalInputTokens,
      maxInputTokens,
      maxContextTokens: model.maxContextTokens,
      messagesIncluded: includedMessages.length,
      messagesTotal: conversationMessages.length,
      hasBeenCompacted: existingSummary !== null,
      summary: existingSummary,
    },
  };
}

/**
 * Determines if the conversation needs compaction based on current token usage.
 */
export function needsCompaction(snapshot: ContextSnapshot): boolean {
  return (
    snapshot.totalInputTokens > snapshot.maxInputTokens * COMPACTION_THRESHOLD &&
    snapshot.messagesTotal > MIN_RECENT_MESSAGES
  );
}

/**
 * Compacts older messages into a summary using the LLM.
 * Returns the new summary text.
 */
export async function compactConversation(
  apiKey: string,
  modelId: string,
  existingSummary: string | null,
  messagesToCompact: ChatMessage[],
): Promise<string> {
  const messagesText = messagesToCompact
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const prompt = existingSummary
    ? `Update this conversation summary with the new messages below. Preserve all key information, decisions, and context. Be thorough but concise.

## Existing Summary
${existingSummary}

## New Messages
${messagesText}

Write the updated summary:`
    : `Summarize this conversation. Preserve all key information, decisions, questions asked, and conclusions reached. Be thorough but concise.

## Messages
${messagesText}

Write the summary:`;

  let summary = "";
  for await (const chunk of streamChatCompletion(apiKey, modelId, [
    { role: "user", content: prompt },
  ])) {
    summary += chunk;
  }

  return summary.trim();
}

function buildFullSystemPrompt(doc: DocumentChatContext): string {
  return `You are a helpful assistant. The user is viewing a specific document and asking questions about it.

## Document
Title: ${doc.title}
Source: ${doc.url}
Author: ${doc.author || "Unknown"}
Type: ${doc.contentType}

## Content
${doc.content}

Answer questions based on the document content above. If the user asks something not covered in the document, say so. Be concise and reference specific parts of the content when relevant.`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-context-manager.ts
git commit -m "feat(chat): add context manager with sliding window and compaction"
```

---

## Phase 2: Store & Adapter Updates

### Task 3: Add Summary to Conversation

**Files:**
- Modify: `apps/extension/lib/chat/chat-adapter.ts`
- Modify: `apps/extension/lib/chat/chat-store.ts`

- [ ] **Step 1: Add updateSummary to ChatAdapter**

In `apps/extension/lib/chat/chat-adapter.ts`, add this method after `renameConversation`:

```typescript
  async updateSummary(conversationId: string, summary: string): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      (conv as any).summary = summary;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }

  async getSummary(conversationId: string): Promise<string | null> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    return (conv as any)?.summary ?? null;
  }
```

Note: We store `summary` as an extra field on the Conversation object. IndexedDB is schemaless for object properties — no migration needed. The `as any` cast is because the shared `Conversation` type doesn't have `summary` yet. We add it to the local type only.

- [ ] **Step 2: Add summary accessor and updater to chat-store.ts**

In `apps/extension/lib/chat/chat-store.ts`, add a summary signal and expose it. After the `activeConversation` resource definition, add:

```typescript
  const [conversationSummary, setConversationSummary] = createSignal<string | null>(null);

  // Load summary when active conversation changes
  createEffect(() => {
    const id = activeConversationId();
    if (id) {
      adapter.getSummary(id).then((s) => setConversationSummary(s));
    } else {
      setConversationSummary(null);
    }
  });

  async function updateSummary(summary: string) {
    const id = activeConversationId();
    if (!id) return;
    await adapter.updateSummary(id, summary);
    setConversationSummary(summary);
  }
```

Add `createEffect` to the imports at the top:

```typescript
import { createSignal, createResource, createEffect } from 'solid-js';
```

Add to the return object:

```typescript
  return {
    conversations,
    activeConversation,
    activeConversationId,
    conversationSummary,
    createConversation,
    addMessage,
    updateTitle,
    updateSummary,
    deleteConversation,
    deleteAllConversations,
    selectConversation,
    clearActive,
    refreshList,
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/chat/chat-adapter.ts apps/extension/lib/chat/chat-store.ts
git commit -m "feat(chat): add conversation summary persistence to adapter and store"
```

---

## Phase 3: Debug Panel

### Task 4: Chat Debug Panel Component

**Files:**
- Create: `apps/extension/components/detail/ChatDebugPanel.tsx`

- [ ] **Step 1: Create the debug panel component**

```tsx
// apps/extension/components/detail/ChatDebugPanel.tsx
import { Show, For, createSignal } from "solid-js";
import { ChevronDown, ChevronRight } from "lucide-solid";
import type { ContextSnapshot } from "@/lib/chat/chat-context-manager";

interface DebugSection {
  label: string;
  content: string;
  tokens: number;
}

interface ChatDebugPanelProps {
  snapshot: ContextSnapshot | null;
  systemPrompt: string | null;
  documentContent: string | null;
  summary: string | null;
  messagesPayload: Array<{ role: string; content: string }>;
  modelId: string;
}

function TokenBadge(props: { tokens: number }) {
  return (
    <span class="text-xs font-mono text-muted-foreground/60 ml-auto">
      ~{props.tokens.toLocaleString()} tokens
    </span>
  );
}

function CollapsibleSection(props: { label: string; tokens: number; children: any; defaultOpen?: boolean }) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  return (
    <div class="border-b border-border/30 last:border-b-0">
      <button
        class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(!open())}
      >
        <Show when={open()} fallback={<ChevronRight size={12} class="text-muted-foreground/60" />}>
          <ChevronDown size={12} class="text-muted-foreground/60" />
        </Show>
        <span class="text-foreground/80 font-medium">{props.label}</span>
        <TokenBadge tokens={props.tokens} />
      </button>
      <Show when={open()}>
        <div class="px-3 pb-3">
          <pre class="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto bg-background/50 rounded p-2">
            {props.children}
          </pre>
        </div>
      </Show>
    </div>
  );
}

export default function ChatDebugPanel(props: ChatDebugPanelProps) {
  const snapshot = () => props.snapshot;

  return (
    <div class="flex flex-col h-full overflow-hidden bg-card">
      {/* Header */}
      <div class="px-3 py-2 bg-muted/30 flex-shrink-0">
        <div class="text-sm font-semibold text-foreground">Debug Inspector</div>
        <div class="text-xs text-muted-foreground mt-0.5">
          Model: {props.modelId}
        </div>
      </div>

      {/* Token overview */}
      <Show when={snapshot()}>
        {(snap) => (
          <div class="px-3 py-2 bg-muted/10 flex-shrink-0 space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Input tokens</span>
              <span class="font-mono">{snap().totalInputTokens.toLocaleString()} / {snap().maxInputTokens.toLocaleString()}</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                class={`h-full rounded-full transition-all ${
                  snap().totalInputTokens / snap().maxInputTokens > 0.9
                    ? "bg-red-400"
                    : snap().totalInputTokens / snap().maxInputTokens > 0.7
                      ? "bg-yellow-400"
                      : "bg-sky-400"
                }`}
                style={{ width: `${Math.min((snap().totalInputTokens / snap().maxInputTokens) * 100, 100)}%` }}
              />
            </div>
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Messages: {snap().messagesIncluded} of {snap().messagesTotal}</span>
              <Show when={snap().hasBeenCompacted}>
                <span class="text-yellow-400">Compacted</span>
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* Sections */}
      <div class="flex-1 overflow-y-auto">
        <Show when={props.systemPrompt}>
          <CollapsibleSection
            label="System Prompt"
            tokens={snapshot()?.systemPromptTokens ?? 0}
          >
            {props.systemPrompt}
          </CollapsibleSection>
        </Show>

        <Show when={props.summary}>
          <CollapsibleSection
            label="Conversation Summary"
            tokens={snapshot()?.summaryTokens ?? 0}
            defaultOpen
          >
            {props.summary}
          </CollapsibleSection>
        </Show>

        <Show when={props.messagesPayload.length > 0}>
          <CollapsibleSection
            label={`Messages (${props.messagesPayload.length})`}
            tokens={snapshot()?.messageTokens ?? 0}
            defaultOpen
          >
            <For each={props.messagesPayload}>
              {(msg) => (
                <div class="mb-2 last:mb-0">
                  <span class={`font-semibold ${msg.role === "user" ? "text-sky-400" : msg.role === "assistant" ? "text-emerald-400" : "text-yellow-400"}`}>
                    [{msg.role}]
                  </span>
                  {" "}{msg.content.length > 500 ? msg.content.slice(0, 500) + "..." : msg.content}
                </div>
              )}
            </For>
          </CollapsibleSection>
        </Show>

        <Show when={props.documentContent}>
          <CollapsibleSection
            label="Document Content"
            tokens={snapshot()?.documentTokens ?? 0}
          >
            {(props.documentContent?.length ?? 0) > 1000
              ? props.documentContent!.slice(0, 1000) + `\n\n... (${props.documentContent!.length.toLocaleString()} chars total)`
              : props.documentContent}
          </CollapsibleSection>
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatDebugPanel.tsx
git commit -m "feat(chat): add debug inspector panel for LLM payload transparency"
```

---

## Phase 4: Integration

### Task 5: Integrate Context Manager into ChatPanelContent

**Files:**
- Modify: `apps/extension/components/detail/ChatPanelContent.tsx`

This is the main integration task. It wires the context manager, Context component, and debug panel into the existing chat UI.

- [ ] **Step 1: Update imports**

At the top of `apps/extension/components/detail/ChatPanelContent.tsx`, add/update imports:

```typescript
// Add these new imports
import { Code } from "lucide-solid";
import {
  Context, ContextTrigger, ContextContent, ContextContentHeader,
  ContextContentBody, ContextInputUsage,
} from "@tab-zen/chat";
import { preparePayload, needsCompaction, compactConversation, type ContextSnapshot } from "@/lib/chat/chat-context-manager";
import { CHAT_MODELS, getModelByIdOrDefault } from "@/lib/chat/chat-models";
import ChatDebugPanel from "./ChatDebugPanel";
```

Remove the old `CHAT_MODELS` array and the `buildSystemPrompt` import (context manager has its own). Remove `streamChatCompletion` import too — we'll import it through the context manager path. Actually, keep `streamChatCompletion` — it's still used directly for the streaming call.

Remove:
```typescript
import { streamChatCompletion, buildSystemPrompt, type DocumentChatContext } from "@/lib/chat/chat-streaming";
```

Replace with:
```typescript
import { streamChatCompletion, type DocumentChatContext } from "@/lib/chat/chat-streaming";
```

Remove the `CHAT_MODELS` constant (lines 17-24) — it now comes from `chat-models.ts`.

- [ ] **Step 2: Add state signals for context and debug**

Inside the component function, after the existing signals, add:

```typescript
  const [contextSnapshot, setContextSnapshot] = createSignal<ContextSnapshot | null>(null);
  const [debugOpen, setDebugOpen] = createSignal(false);
  const [lastSystemPrompt, setLastSystemPrompt] = createSignal<string | null>(null);
  const [lastMessagesPayload, setLastMessagesPayload] = createSignal<Array<{ role: string; content: string }>>([]);
```

- [ ] **Step 3: Replace the message-building logic in handleSendMessage**

Replace the block from `setIsStreaming(true)` through the `streamChatCompletion` call with the context manager approach:

```typescript
    setIsStreaming(true);
    setStreamingContent("");

    // Build messages from known state to avoid race with async resource refetch
    const conv = props.store.activeConversation();
    const priorMessages = conv ? conv.messages : [];
    const allMessages = [...priorMessages, userMessage];

    // Prepare payload with context window management
    const { messages: llmMessages, snapshot } = preparePayload(
      props.documentContext,
      allMessages,
      props.store.conversationSummary(),
      currentModel(),
    );

    setContextSnapshot(snapshot);
    setLastSystemPrompt(llmMessages.find((m) => m.role === "system")?.content ?? null);
    setLastMessagesPayload(llmMessages.filter((m) => m.role !== "system"));

    // Check if we need compaction (fire and forget after response)
    const shouldCompact = needsCompaction(snapshot);

    try {
      let fullContent = "";
      for await (const chunk of streamChatCompletion(
        props.settings.openRouterApiKey,
        currentModel(),
        llmMessages,
      )) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      setIsStreaming(false);
      setStreamingContent("");

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        modelId: currentModel(),
        createdAt: new Date().toISOString(),
      };
      await props.store.addMessage(assistantMessage);

      // Compact if needed (after saving the response)
      if (shouldCompact) {
        const messagesCount = allMessages.length;
        const messagesToCompact = allMessages.slice(0, messagesCount - MIN_RECENT_MESSAGES);
        if (messagesToCompact.length > 0) {
          const summary = await compactConversation(
            props.settings.openRouterApiKey,
            currentModel(),
            props.store.conversationSummary(),
            messagesToCompact,
          );
          await props.store.updateSummary(summary);
          // Update snapshot after compaction
          const newPayload = preparePayload(
            props.documentContext,
            [...allMessages, assistantMessage],
            summary,
            currentModel(),
          );
          setContextSnapshot(newPayload.snapshot);
        }
      }
```

Add `MIN_RECENT_MESSAGES` import at the top of the file or define it:

```typescript
const MIN_RECENT_MESSAGES = 4;
```

- [ ] **Step 4: Add Context component to the header**

In the chat header, after the title span and before the action buttons, add the Context component:

```tsx
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-sm font-semibold text-foreground truncate">
              {props.store.activeConversation()?.title ?? "New Thread"}
            </span>
            <Show when={contextSnapshot()}>
              {(snap) => (
                <Context
                  usedTokens={snap().totalInputTokens}
                  maxTokens={snap().maxInputTokens}
                  inputTokens={snap().messageTokens + snap().summaryTokens}
                >
                  <ContextTrigger class="h-6 px-1 text-xs" />
                  <ContextContent>
                    <ContextContentHeader />
                    <ContextContentBody>
                      <div class="space-y-1 text-xs">
                        <ContextInputUsage />
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">Document</span>
                          <span>{snap().documentTokens.toLocaleString()}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-muted-foreground">Messages</span>
                          <span>{snap().messagesIncluded} of {snap().messagesTotal}</span>
                        </div>
                        <Show when={snap().hasBeenCompacted}>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Summary</span>
                            <span>{snap().summaryTokens.toLocaleString()}</span>
                          </div>
                        </Show>
                      </div>
                    </ContextContentBody>
                  </ContextContent>
                </Context>
              )}
            </Show>
          </div>
```

- [ ] **Step 5: Add debug toggle button to header**

Add a debug toggle button next to the existing header buttons (before the close button):

```tsx
            <button
              onClick={() => setDebugOpen(!debugOpen())}
              class={`p-1.5 rounded-md transition-colors ${
                debugOpen()
                  ? "text-sky-400 bg-sky-400/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              title="Debug inspector"
            >
              <Code size={16} />
            </button>
```

- [ ] **Step 6: Add debug panel below the header**

After the header `</div>` and before the `{/* Messages */}` comment, add:

```tsx
        {/* Debug inspector */}
        <Show when={debugOpen()}>
          <div class="flex-shrink-0 max-h-[40%] overflow-hidden border-b border-border/30">
            <ChatDebugPanel
              snapshot={contextSnapshot()}
              systemPrompt={lastSystemPrompt()}
              documentContent={props.documentContext.content}
              summary={props.store.conversationSummary()}
              messagesPayload={lastMessagesPayload()}
              modelId={currentModel()}
            />
          </div>
        </Show>
```

- [ ] **Step 7: Add messages-dropped indicator**

After the `<For>` loop for messages and before the streaming block, add an indicator when messages have been dropped:

```tsx
            <Show when={contextSnapshot() && contextSnapshot()!.messagesIncluded < contextSnapshot()!.messagesTotal}>
              <div class="text-center text-xs text-muted-foreground/50 py-1">
                Using last {contextSnapshot()!.messagesIncluded} of {contextSnapshot()!.messagesTotal} messages
              </div>
            </Show>
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

Fix any import or type issues.

- [ ] **Step 9: Commit**

```bash
git add apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): integrate context manager, Context component, and debug panel"
```

---

## Phase 5: Cleanup

### Task 6: Remove Duplicate buildSystemPrompt

**Files:**
- Modify: `apps/extension/lib/chat/chat-streaming.ts`

- [ ] **Step 1: Remove buildSystemPrompt from chat-streaming.ts**

The `buildSystemPrompt` function is now in `chat-context-manager.ts`. Remove it from `chat-streaming.ts` but keep the `DocumentChatContext` interface export (it's used elsewhere).

In `apps/extension/lib/chat/chat-streaming.ts`, remove the `buildSystemPrompt` function and the `DocumentChatContext` export. Move the interface to `chat-context-manager.ts` or keep it in `chat-streaming.ts` as a type-only export.

Actually, keep `DocumentChatContext` in `chat-streaming.ts` since it's imported by `DetailPage.tsx`. Just remove `buildSystemPrompt`:

```typescript
// Remove this function from chat-streaming.ts:
export function buildSystemPrompt(doc: DocumentChatContext): string { ... }
```

Update any remaining imports of `buildSystemPrompt` from `chat-streaming` to import from `chat-context-manager` instead. Check `ChatPanelContent.tsx` — it should already be updated from Task 5.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-streaming.ts apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "refactor(chat): remove duplicate buildSystemPrompt, single source in context manager"
```

---

### Task 7: End-to-End Testing

**Files:** None (manual testing)

- [ ] **Step 1: Test basic chat with context indicator**

1. Open a captured page's detail view
2. Open the chat panel
3. Send a message
4. Verify the Context indicator appears in the header (percentage + donut icon)
5. Hover over it — verify the popup shows token breakdown

- [ ] **Step 2: Test debug panel**

1. Click the `</>` (Code) icon in the header
2. Verify the debug panel opens below the header
3. Check: System Prompt section shows the full prompt with document metadata
4. Check: Messages section shows the messages sent to the LLM
5. Check: Token overview bar shows usage
6. Send another message — verify debug panel updates in real-time
7. Close debug panel — verify it toggles cleanly

- [ ] **Step 3: Test compaction (requires a long conversation)**

1. Choose a model with a smaller context (GPT-4o Mini, 128k)
2. Open a page with a long transcript
3. Have a multi-turn conversation (10+ exchanges)
4. Watch the Context indicator — when it approaches 70%, compaction should fire
5. After compaction, verify: "Compacted" badge appears, summary section in debug panel shows the summary
6. Continue chatting — the model should still know what was discussed earlier

- [ ] **Step 4: Test messages-dropped indicator**

1. If compaction triggers, verify "Using last N of M messages" text appears between old and new messages

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(chat): address issues found during context management testing"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Model definitions with token limits | None |
| 2 | Context manager (sliding window + compaction) | Task 1 |
| 3 | Summary persistence in adapter/store | None |
| 4 | Debug panel component | Task 2 |
| 5 | Integration into ChatPanelContent | Tasks 1-4 |
| 6 | Remove duplicate buildSystemPrompt | Task 5 |
| 7 | End-to-end testing | Task 6 |

**Parallelizable:** Tasks 1+3 can run in parallel. Task 4 can start once Task 2 is done. Task 5 needs everything. Tasks 6-7 are sequential cleanup.
