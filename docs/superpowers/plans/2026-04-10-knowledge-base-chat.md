# Knowledge Base & Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a SolidJS chat component library (`packages/chat`) and standalone dev app (`apps/chat`) for conversational interaction with saved content — both single-document and collection-wide knowledge base chat.

**Architecture:** Three-layer component architecture (headless primitives → styled UI → AI/feature components) with a pluggable data adapter. The chat package is pure UI with zero service dependencies. The dev app wires up OpenRouter for LLM/embeddings, GROQ for voice, and IndexedDB for local vector storage. See `docs/superpowers/specs/2026-04-10-knowledge-base-chat-design.md` for the full spec.

**Tech Stack:** SolidJS 1.9.x, Kobalte (headless UI), Tailwind CSS v4, Vite, Vitest, OpenRouter API (fetch-based), GROQ Whisper API, IndexedDB (idb), Shiki (syntax highlighting), class-variance-authority, clsx + tailwind-merge

**Design References:** `reference/prompt-kit` (primary styling), `reference/ai-elements` (Checkpoint, Context)

---

## File Structure

### packages/chat/

```
packages/chat/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                          # Public exports
│   ├── utils/
│   │   └── cn.ts                         # clsx + tailwind-merge utility
│   ├── primitives/
│   │   ├── use-text-stream.ts            # Streaming text with typewriter/fade
│   │   ├── use-stick-to-bottom.ts        # Auto-scroll management
│   │   ├── use-auto-resize.ts            # Textarea auto-sizing
│   │   └── use-voice-recorder.ts         # MediaRecorder abstraction
│   ├── ui/
│   │   ├── button.tsx                    # Variants: default, ghost, outline
│   │   ├── avatar.tsx                    # Image + fallback initials
│   │   ├── tooltip.tsx                   # Kobalte Tooltip + skin
│   │   ├── hover-card.tsx                # Kobalte HoverCard + skin
│   │   ├── collapsible.tsx               # Kobalte Collapsible + skin
│   │   ├── scroll-area.tsx               # Styled scroll container
│   │   ├── dropdown.tsx                  # Kobalte DropdownMenu + skin
│   │   ├── textarea.tsx                  # Auto-resizing via useAutoResize
│   │   ├── badge.tsx                     # Count and status variants
│   │   ├── separator.tsx                 # Styled divider
│   │   └── dialog.tsx                    # Kobalte Dialog + skin
│   └── components/
│       ├── chat-container.tsx            # Scroll container + stick-to-bottom
│       ├── message.tsx                   # Compound: Avatar, Content, Actions
│       ├── prompt-input.tsx              # Auto-sizing input + actions slot
│       ├── response-stream.tsx           # Progressive markdown streaming
│       ├── markdown.tsx                  # Markdown renderer + remark plugins
│       ├── code-block.tsx                # Shiki syntax highlighting
│       ├── loader.tsx                    # bars, text-shimmer, loading-dots, pulse-dot
│       ├── feedback-bar.tsx              # Thumbs up/down/close
│       ├── chain-of-thought.tsx          # Expandable reasoning tree
│       ├── source.tsx                    # Citation hover card
│       ├── prompt-suggestion.tsx         # Suggested follow-up chips
│       ├── scroll-button.tsx             # Scroll-to-bottom button
│       ├── checkpoint.tsx                # Restore point marker
│       ├── context.tsx                   # Token usage / cost hover card
│       ├── voice-input.tsx               # Mic button + push-to-talk
│       ├── conversation-list.tsx         # Sidebar with grouped conversations
│       ├── conversation-item.tsx         # Single conversation entry
│       ├── model-switcher.tsx            # Inline model picker
│       └── chat-scope-picker.tsx         # Filter by tags/channels
├── tests/
│   ├── primitives/
│   │   ├── use-text-stream.test.ts
│   │   ├── use-stick-to-bottom.test.ts
│   │   ├── use-auto-resize.test.ts
│   │   └── use-voice-recorder.test.ts
│   ├── ui/
│   │   └── button.test.tsx
│   └── components/
│       ├── message.test.tsx
│       ├── prompt-input.test.tsx
│       ├── loader.test.tsx
│       └── conversation-list.test.tsx
```

### apps/chat/

```
apps/chat/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── index.tsx                         # Vite entry, render App
│   ├── App.tsx                           # Root layout (sidebar + chat)
│   ├── global.css                        # Tailwind imports + theme tokens
│   ├── services/
│   │   ├── openrouter.ts                 # OpenRouter fetch wrapper (chat + embeddings)
│   │   ├── chunking.ts                   # Content → chunks + DocumentContext
│   │   ├── vector-store.ts               # IndexedDB vector storage + cosine similarity
│   │   └── voice.ts                      # GROQ Whisper transcription
│   ├── adapters/
│   │   └── local-adapter.ts              # ChatDataAdapter → IndexedDB implementation
│   ├── stores/
│   │   └── chat-store.ts                 # SolidJS store for conversation state
│   └── db.ts                             # IndexedDB schema for chat (idb)
├── tests/
│   ├── services/
│   │   ├── chunking.test.ts
│   │   └── vector-store.test.ts
│   └── adapters/
│       └── local-adapter.test.ts
```

### packages/shared/ (modifications)

```
packages/shared/src/
├── index.ts                              # Add re-exports for chat types
└── chat-types.ts                         # NEW: All chat data model types
```

---

## Phase 1: Scaffolding & Shared Types

### Task 1: Add Chat Types to packages/shared

**Files:**
- Create: `packages/shared/src/chat-types.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write the chat types file**

```typescript
// packages/shared/src/chat-types.ts

// --- Adapter Interface ---

export interface ChatDataAdapter {
  storeDocumentContext(context: DocumentContext): Promise<void>;
  storeChunks(documentId: string, chunks: Chunk[]): Promise<void>;
  searchSimilar(
    embedding: number[],
    topK: number,
    filters?: SearchFilters
  ): Promise<ChunkResult[]>;
  getDocumentContext(documentId: string): Promise<DocumentContext>;
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(conversationId: string): Promise<Conversation>;
  listConversations(): Promise<ConversationSummary[]>;
  deleteConversation(conversationId: string): Promise<void>;
  generateEmbedding(text: string): Promise<number[]>;
}

// --- Document & Chunks ---

export interface DocumentContext {
  documentId: string;
  userId?: string;
  teamId?: string;
  title: string;
  url: string;
  author?: string;
  capturedAt: string;
  contentType: 'transcript' | 'markdown';
  framingContent: string;
  metadata?: Record<string, string>;
}

export interface Chunk {
  chunkId: string;
  documentId: string;
  text: string;
  embedding: number[];
  position: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  timestampStart?: string;
  timestampEnd?: string;
  sectionHeading?: string;
  speaker?: string;
}

export interface ChunkResult {
  chunk: Chunk;
  context: DocumentContext;
  score: number;
}

// --- Conversations ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  modelId?: string;
  createdAt: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  url: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  userId?: string;
  teamId?: string;
  title: string;
  groupId?: string;
  scope: ConversationScope;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationGroup {
  id: string;
  userId?: string;
  teamId?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  groupId?: string;
  scope: ConversationScope;
  messageCount: number;
  lastMessageAt: string;
  updatedAt: string;
}

export interface ConversationScope {
  type: 'document' | 'collection';
  documentId?: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  tags?: string[];
  authors?: string[];
  contentType?: 'transcript' | 'markdown';
  dateRange?: { from: string; to: string };
}

// --- Configuration ---

export interface ChatConfig {
  models: ModelOption[];
  defaultModelId: string;
  showModelSwitcher?: boolean;
  voiceEnabled: boolean;
  onVoiceRecord?: (audio: Blob) => Promise<string>;
  onSendMessage: (message: string, modelId: string) => void;
  onStreamResponse: () => AsyncIterable<string>;
  onFeedback?: (messageId: string, helpful: boolean) => void;
  onCheckpointRestore?: (messageId: string) => void;
  contextInfo?: ContextInfo;
  theme?: 'dark' | 'light';
}

export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
}

export interface ContextInfo {
  usedTokens: number;
  maxTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheTokens?: number;
  estimatedCost?: number;
}
```

- [x] **Step 2: Add re-exports to shared index**

Add to the end of `packages/shared/src/index.ts`:

```typescript
export * from './chat-types';
```

- [x] **Step 3: Verify shared package builds**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/shared exec tsc --noEmit`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add packages/shared/src/chat-types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add chat data model types and adapter interface"
```

---

### Task 2: Scaffold packages/chat

**Files:**
- Create: `packages/chat/package.json`
- Create: `packages/chat/tsconfig.json`
- Create: `packages/chat/src/index.ts`
- Create: `packages/chat/src/utils/cn.ts`
- Create: `packages/chat/vitest.config.ts`

- [x] **Step 1: Create package.json**

```json
{
  "name": "@tab-zen/chat",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@kobalte/core": "^0.13.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-solid": "^0.400.0",
    "solid-js": "^1.9.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@solidjs/testing-library": "^0.8.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vite-plugin-solid": "^2.11.0",
    "vitest": "^4.1.0"
  },
  "peerDependencies": {
    "solid-js": "^1.9.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "paths": {
      "@tab-zen/shared": ["../shared/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [x] **Step 3: Create cn utility**

```typescript
// packages/chat/src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [x] **Step 4: Create index.ts with initial export**

```typescript
// packages/chat/src/index.ts
export { cn } from './utils/cn';
```

- [x] **Step 5: Create vitest config**

```typescript
// packages/chat/vitest.config.ts
import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@tab-zen/shared': '../shared/src/index.ts',
    },
  },
});
```

- [x] **Step 6: Install dependencies**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm install`
Expected: Dependencies installed, no errors

- [x] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat exec tsc --noEmit`
Expected: No errors

- [x] **Step 8: Commit**

```bash
git add packages/chat/
git commit -m "feat(chat): scaffold packages/chat with Kobalte, Tailwind, vitest"
```

---

### Task 3: Scaffold apps/chat

**Files:**
- Create: `apps/chat/package.json`
- Create: `apps/chat/tsconfig.json`
- Create: `apps/chat/vite.config.ts`
- Create: `apps/chat/index.html`
- Create: `apps/chat/src/index.tsx`
- Create: `apps/chat/src/App.tsx`
- Create: `apps/chat/src/global.css`

- [x] **Step 1: Create package.json**

```json
{
  "name": "@tab-zen/chat-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tab-zen/chat": "workspace:*",
    "@tab-zen/shared": "workspace:*",
    "idb": "^8.0.0",
    "solid-js": "^1.9.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.2.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vite-plugin-solid": "^2.11.0",
    "vitest": "^4.1.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "paths": {
      "@/*": ["./src/*"],
      "@tab-zen/shared": ["../../packages/shared/src/index.ts"],
      "@tab-zen/chat": ["../../packages/chat/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [x] **Step 3: Create vite.config.ts**

```typescript
// apps/chat/vite.config.ts
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tab-zen/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tab-zen/chat': path.resolve(__dirname, '../../packages/chat/src/index.ts'),
    },
  },
  css: {
    postcss: {
      plugins: [
        (await import('@tailwindcss/postcss')).default,
      ],
    },
  },
});
```

- [x] **Step 4: Create global.css**

Mirror the extension's theme tokens for dark mode. Reference: `apps/extension/assets/global.css`

```css
/* apps/chat/src/global.css */
@import "tailwindcss";

@theme inline {
  --color-background: #1b1b1f;
  --color-foreground: #dfdfd6;
  --color-card: #202127;
  --color-muted: #2e2e32;
  --color-muted-foreground: #98989f;
  --color-border: #3c3f44;
  --color-sidebar: #161618;
  --color-ring: #a8b1ff;
  --color-primary: #dfdfd6;
  --color-primary-foreground: #1b1b1f;
  --color-accent: #7c3aed;
  --color-accent-foreground: #ffffff;
  --color-citation: #3451b2;

  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
}
```

- [x] **Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tab Zen Chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

- [x] **Step 6: Create entry point**

```typescript
// apps/chat/src/index.tsx
import { render } from 'solid-js/web';
import App from './App';
import './global.css';

render(() => <App />, document.getElementById('root')!);
```

- [x] **Step 7: Create App shell**

```typescript
// apps/chat/src/App.tsx
import { type Component } from 'solid-js';

const App: Component = () => {
  return (
    <div class="flex h-screen w-screen bg-background text-foreground">
      <div class="flex flex-1 items-center justify-center text-muted-foreground">
        Chat app loading...
      </div>
    </div>
  );
};

export default App;
```

- [x] **Step 8: Install dependencies and verify dev server starts**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm install && pnpm --filter @tab-zen/chat-app dev`
Expected: Vite dev server starts, page shows "Chat app loading..."
Stop the dev server after confirming.

- [x] **Step 9: Commit**

```bash
git add apps/chat/
git commit -m "feat(chat-app): scaffold standalone SolidJS dev app with Vite + Tailwind"
```

---

## Phase 2: Headless Primitives (Layer 1)

### Task 4: useAutoResize Primitive

**Files:**
- Create: `packages/chat/src/primitives/use-auto-resize.ts`
- Create: `packages/chat/tests/primitives/use-auto-resize.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/primitives/use-auto-resize.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useAutoResize } from '../../src/primitives/use-auto-resize';

describe('useAutoResize', () => {
  it('returns a ref callback', () => {
    createRoot((dispose) => {
      const { ref } = useAutoResize();
      expect(typeof ref).toBe('function');
      dispose();
    });
  });

  it('accepts a maxHeight option', () => {
    createRoot((dispose) => {
      const { ref } = useAutoResize({ maxHeight: 200 });
      expect(typeof ref).toBe('function');
      dispose();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL — module not found

- [x] **Step 3: Implement useAutoResize**

```typescript
// packages/chat/src/primitives/use-auto-resize.ts
import { onCleanup } from 'solid-js';

interface UseAutoResizeOptions {
  maxHeight?: number;
}

export function useAutoResize(options: UseAutoResizeOptions = {}) {
  let textareaEl: HTMLTextAreaElement | undefined;

  function resize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    const scrollHeight = textareaEl.scrollHeight;
    if (options.maxHeight && scrollHeight > options.maxHeight) {
      textareaEl.style.height = `${options.maxHeight}px`;
      textareaEl.style.overflowY = 'auto';
    } else {
      textareaEl.style.height = `${scrollHeight}px`;
      textareaEl.style.overflowY = 'hidden';
    }
  }

  function ref(el: HTMLTextAreaElement) {
    textareaEl = el;
    el.addEventListener('input', resize);
    // Initial resize
    requestAnimationFrame(resize);
    onCleanup(() => el.removeEventListener('input', resize));
  }

  return { ref, resize };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/primitives/use-auto-resize.ts packages/chat/tests/primitives/use-auto-resize.test.ts
git commit -m "feat(chat): add useAutoResize primitive for textarea auto-sizing"
```

---

### Task 5: useStickToBottom Primitive

**Files:**
- Create: `packages/chat/src/primitives/use-stick-to-bottom.ts`
- Create: `packages/chat/tests/primitives/use-stick-to-bottom.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/primitives/use-stick-to-bottom.test.ts
import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import { useStickToBottom } from '../../src/primitives/use-stick-to-bottom';

describe('useStickToBottom', () => {
  it('returns ref, isAtBottom signal, and scrollToBottom function', () => {
    createRoot((dispose) => {
      const { ref, isAtBottom, scrollToBottom } = useStickToBottom();
      expect(typeof ref).toBe('function');
      expect(typeof isAtBottom).toBe('function');
      expect(typeof scrollToBottom).toBe('function');
      dispose();
    });
  });

  it('defaults to isAtBottom = true', () => {
    createRoot((dispose) => {
      const { isAtBottom } = useStickToBottom();
      expect(isAtBottom()).toBe(true);
      dispose();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL — module not found

- [x] **Step 3: Implement useStickToBottom**

```typescript
// packages/chat/src/primitives/use-stick-to-bottom.ts
import { createSignal, onCleanup } from 'solid-js';

const SCROLL_THRESHOLD = 50;

export function useStickToBottom() {
  const [isAtBottom, setIsAtBottom] = createSignal(true);
  let containerEl: HTMLElement | undefined;
  let shouldStick = true;

  function checkIfAtBottom() {
    if (!containerEl) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    const atBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
    setIsAtBottom(atBottom);
    shouldStick = atBottom;
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    if (!containerEl) return;
    containerEl.scrollTo({
      top: containerEl.scrollHeight,
      behavior,
    });
    shouldStick = true;
    setIsAtBottom(true);
  }

  function onNewContent() {
    if (shouldStick) {
      requestAnimationFrame(() => scrollToBottom('instant'));
    }
  }

  function ref(el: HTMLElement) {
    containerEl = el;
    el.addEventListener('scroll', checkIfAtBottom, { passive: true });

    const observer = new MutationObserver(onNewContent);
    observer.observe(el, { childList: true, subtree: true, characterData: true });

    onCleanup(() => {
      el.removeEventListener('scroll', checkIfAtBottom);
      observer.disconnect();
    });
  }

  return { ref, isAtBottom, scrollToBottom };
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/primitives/use-stick-to-bottom.ts packages/chat/tests/primitives/use-stick-to-bottom.test.ts
git commit -m "feat(chat): add useStickToBottom primitive for chat scroll management"
```

---

### Task 6: useTextStream Primitive

**Files:**
- Create: `packages/chat/src/primitives/use-text-stream.ts`
- Create: `packages/chat/tests/primitives/use-text-stream.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/primitives/use-text-stream.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useTextStream } from '../../src/primitives/use-text-stream';

describe('useTextStream', () => {
  it('returns displayedText, isComplete, and control functions', () => {
    createRoot((dispose) => {
      const stream = useTextStream({ mode: 'typewriter' });
      expect(stream.displayedText()).toBe('');
      expect(stream.isComplete()).toBe(true);
      expect(typeof stream.reset).toBe('function');
      expect(typeof stream.startStreaming).toBe('function');
      expect(typeof stream.pause).toBe('function');
      expect(typeof stream.resume).toBe('function');
      dispose();
    });
  });

  it('streams text from a string source', async () => {
    const result = await new Promise<string>((resolve) => {
      createRoot(async (dispose) => {
        const stream = useTextStream({
          mode: 'typewriter',
          speed: 1,
          characterChunkSize: 100,
        });
        stream.startStreaming('Hello, world!');
        // Wait for streaming to complete
        await new Promise((r) => setTimeout(r, 50));
        resolve(stream.displayedText());
        dispose();
      });
    });
    expect(result).toBe('Hello, world!');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement useTextStream**

Reference: `reference/prompt-kit/components/ui/response-stream.tsx` for the API pattern.

```typescript
// packages/chat/src/primitives/use-text-stream.ts
import { createSignal, onCleanup } from 'solid-js';

export interface UseTextStreamOptions {
  mode: 'typewriter' | 'fade';
  speed?: number;
  characterChunkSize?: number;
  fadeDuration?: number;
}

export interface TextStreamSegment {
  text: string;
  index: number;
}

export function useTextStream(options: UseTextStreamOptions) {
  const speed = options.speed ?? 20;
  const chunkSize = options.characterChunkSize ?? 3;

  const [displayedText, setDisplayedText] = createSignal('');
  const [isComplete, setIsComplete] = createSignal(true);
  const [segments, setSegments] = createSignal<TextStreamSegment[]>([]);

  let fullText = '';
  let charIndex = 0;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  let isPaused = false;
  let asyncIterator: AsyncIterator<string> | undefined;

  function clearInterval_() {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  function typewriterTick() {
    if (isPaused) return;
    if (charIndex >= fullText.length) {
      if (!asyncIterator) {
        clearInterval_();
        setIsComplete(true);
      }
      return;
    }
    const end = Math.min(charIndex + chunkSize, fullText.length);
    charIndex = end;
    setDisplayedText(fullText.slice(0, charIndex));
  }

  async function consumeAsyncIterable(source: AsyncIterable<string>) {
    asyncIterator = source[Symbol.asyncIterator]();
    try {
      while (true) {
        const { value, done } = await asyncIterator.next();
        if (done) break;
        if (value) {
          fullText += value;
          setSegments((prev) => [
            ...prev,
            { text: value, index: prev.length },
          ]);
        }
      }
    } finally {
      asyncIterator = undefined;
      // Let typewriter finish remaining chars
    }
  }

  function startStreaming(source: string | AsyncIterable<string>) {
    reset();
    setIsComplete(false);

    if (typeof source === 'string') {
      fullText = source;
      if (options.mode === 'typewriter') {
        intervalId = setInterval(typewriterTick, speed);
      } else {
        // fade mode: show all at once
        setDisplayedText(source);
        setIsComplete(true);
      }
    } else {
      if (options.mode === 'typewriter') {
        intervalId = setInterval(typewriterTick, speed);
      }
      consumeAsyncIterable(source).then(() => {
        if (options.mode === 'fade') {
          setDisplayedText(fullText);
          setIsComplete(true);
        }
        // typewriter mode: interval will finish on its own
      });
    }
  }

  function pause() {
    isPaused = true;
  }

  function resume() {
    isPaused = false;
  }

  function reset() {
    clearInterval_();
    fullText = '';
    charIndex = 0;
    isPaused = false;
    asyncIterator = undefined;
    setDisplayedText('');
    setIsComplete(true);
    setSegments([]);
  }

  onCleanup(() => {
    clearInterval_();
  });

  return {
    displayedText,
    isComplete,
    segments,
    startStreaming,
    pause,
    resume,
    reset,
  };
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/primitives/use-text-stream.ts packages/chat/tests/primitives/use-text-stream.test.ts
git commit -m "feat(chat): add useTextStream primitive with typewriter/fade modes"
```

---

### Task 7: useVoiceRecorder Primitive

**Files:**
- Create: `packages/chat/src/primitives/use-voice-recorder.ts`
- Create: `packages/chat/tests/primitives/use-voice-recorder.test.ts`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/primitives/use-voice-recorder.test.ts
import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import { useVoiceRecorder } from '../../src/primitives/use-voice-recorder';

describe('useVoiceRecorder', () => {
  it('returns isRecording signal and control functions', () => {
    createRoot((dispose) => {
      const { isRecording, start, stop } = useVoiceRecorder();
      expect(isRecording()).toBe(false);
      expect(typeof start).toBe('function');
      expect(typeof stop).toBe('function');
      dispose();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement useVoiceRecorder**

```typescript
// packages/chat/src/primitives/use-voice-recorder.ts
import { createSignal, onCleanup } from 'solid-js';

export interface UseVoiceRecorderOptions {
  mimeType?: string;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const mimeType = options.mimeType ?? 'audio/webm;codecs=opus';
  const [isRecording, setIsRecording] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let mediaRecorder: MediaRecorder | undefined;
  let chunks: Blob[] = [];
  let resolveBlob: ((blob: Blob) => void) | undefined;

  async function start(): Promise<Blob> {
    setError(null);
    chunks = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolveBlob?.(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      return new Promise<Blob>((resolve) => {
        resolveBlob = resolve;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setIsRecording(false);
      throw err;
    }
  }

  function stop() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  onCleanup(() => {
    stop();
  });

  return { isRecording, error, start, stop };
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Export all primitives from index.ts**

Update `packages/chat/src/index.ts`:

```typescript
// packages/chat/src/index.ts
export { cn } from './utils/cn';
export { useAutoResize } from './primitives/use-auto-resize';
export { useStickToBottom } from './primitives/use-stick-to-bottom';
export { useTextStream } from './primitives/use-text-stream';
export type { UseTextStreamOptions, TextStreamSegment } from './primitives/use-text-stream';
export { useVoiceRecorder } from './primitives/use-voice-recorder';
export type { UseVoiceRecorderOptions } from './primitives/use-voice-recorder';
```

- [x] **Step 6: Commit**

```bash
git add packages/chat/src/primitives/use-voice-recorder.ts packages/chat/tests/primitives/use-voice-recorder.test.ts packages/chat/src/index.ts
git commit -m "feat(chat): add useVoiceRecorder primitive and export all primitives"
```

---

## Phase 3: Styled UI Primitives (Layer 2)

### Task 8: Button Component

**Files:**
- Create: `packages/chat/src/ui/button.tsx`
- Create: `packages/chat/tests/ui/button.test.tsx`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/ui/button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Button } from '../../src/ui/button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies ghost variant class', () => {
    render(() => <Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('hover:bg-muted');
  });

  it('applies size classes', () => {
    render(() => <Button size="sm">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-8');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement Button**

Reference: `reference/prompt-kit/components/ui/button.tsx`

```tsx
// packages/chat/src/ui/button.tsx
import { type JSX, splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        ghost: 'hover:bg-muted text-foreground',
        outline: 'bg-muted/50 text-foreground hover:bg-muted',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-sm',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['variant', 'size', 'class', 'children']);
  return (
    <button
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export { buttonVariants };
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/ui/button.tsx packages/chat/tests/ui/button.test.tsx
git commit -m "feat(chat): add Button component with variant/size system"
```

---

### Task 9: Remaining UI Primitives

Build the remaining Layer 2 components. Each follows the same pattern as Button: Kobalte base + Tailwind skin + cva variants where appropriate.

**Files:**
- Create: `packages/chat/src/ui/avatar.tsx`
- Create: `packages/chat/src/ui/tooltip.tsx`
- Create: `packages/chat/src/ui/hover-card.tsx`
- Create: `packages/chat/src/ui/collapsible.tsx`
- Create: `packages/chat/src/ui/scroll-area.tsx`
- Create: `packages/chat/src/ui/dropdown.tsx`
- Create: `packages/chat/src/ui/textarea.tsx`
- Create: `packages/chat/src/ui/badge.tsx`
- Create: `packages/chat/src/ui/separator.tsx`
- Create: `packages/chat/src/ui/dialog.tsx`

- [x] **Step 1: Implement Avatar**

```tsx
// packages/chat/src/ui/avatar.tsx
import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';

export interface AvatarProps extends JSX.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function Avatar(props: AvatarProps) {
  const [local, rest] = splitProps(props, ['src', 'alt', 'fallback', 'size', 'class']);
  const size = () => local.size ?? 'md';

  return (
    <div
      class={cn(
        'inline-flex items-center justify-center rounded-md bg-accent font-semibold text-accent-foreground flex-shrink-0',
        sizeClasses[size()],
        local.class
      )}
      {...rest}
    >
      <Show when={local.src} fallback={<span>{local.fallback}</span>}>
        <img
          src={local.src}
          alt={local.alt ?? local.fallback}
          class="h-full w-full rounded-md object-cover"
        />
      </Show>
    </div>
  );
}
```

- [x] **Step 2: Implement Tooltip**

```tsx
// packages/chat/src/ui/tooltip.tsx
import { Tooltip as KTooltip } from '@kobalte/core/tooltip';
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface TooltipProps {
  content: string;
  children: JSX.Element;
  class?: string;
}

export function Tooltip(props: TooltipProps) {
  const [local, rest] = splitProps(props, ['content', 'children', 'class']);

  return (
    <KTooltip>
      <KTooltip.Trigger as="span">{local.children}</KTooltip.Trigger>
      <KTooltip.Portal>
        <KTooltip.Content
          class={cn(
            'z-50 rounded-md bg-foreground px-2.5 py-1 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95',
            local.class
          )}
        >
          <KTooltip.Arrow />
          {local.content}
        </KTooltip.Content>
      </KTooltip.Portal>
    </KTooltip>
  );
}
```

- [x] **Step 3: Implement HoverCard**

```tsx
// packages/chat/src/ui/hover-card.tsx
import { HoverCard as KHoverCard } from '@kobalte/core/hover-card';
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface HoverCardProps {
  trigger: JSX.Element;
  children: JSX.Element;
  class?: string;
}

export function HoverCard(props: HoverCardProps) {
  const [local] = splitProps(props, ['trigger', 'children', 'class']);

  return (
    <KHoverCard>
      <KHoverCard.Trigger as="span">{local.trigger}</KHoverCard.Trigger>
      <KHoverCard.Portal>
        <KHoverCard.Content
          class={cn(
            'z-50 w-64 rounded-lg bg-card p-4 shadow-lg animate-in fade-in-0 zoom-in-95',
            local.class
          )}
        >
          <KHoverCard.Arrow />
          {local.children}
        </KHoverCard.Content>
      </KHoverCard.Portal>
    </KHoverCard>
  );
}
```

- [x] **Step 4: Implement Collapsible**

```tsx
// packages/chat/src/ui/collapsible.tsx
import { Collapsible as KCollapsible } from '@kobalte/core/collapsible';
import { type JSX } from 'solid-js';
import { cn } from '../utils/cn';

export const Collapsible = KCollapsible;
export const CollapsibleTrigger = KCollapsible.Trigger;

export function CollapsibleContent(props: { children: JSX.Element; class?: string }) {
  return (
    <KCollapsible.Content
      class={cn('overflow-hidden animate-collapsible-content', props.class)}
    >
      {props.children}
    </KCollapsible.Content>
  );
}
```

- [x] **Step 5: Implement ScrollArea**

```tsx
// packages/chat/src/ui/scroll-area.tsx
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface ScrollAreaProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

export function ScrollArea(props: ScrollAreaProps) {
  const [local, rest] = splitProps(props, ['children', 'class']);

  return (
    <div
      class={cn('overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}
```

- [x] **Step 6: Implement Dropdown**

```tsx
// packages/chat/src/ui/dropdown.tsx
import { DropdownMenu as KDropdown } from '@kobalte/core/dropdown-menu';
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export const Dropdown = KDropdown;
export const DropdownTrigger = KDropdown.Trigger;

export function DropdownContent(props: { children: JSX.Element; class?: string }) {
  return (
    <KDropdown.Portal>
      <KDropdown.Content
        class={cn(
          'z-50 min-w-[8rem] rounded-lg bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95',
          props.class
        )}
      >
        {props.children}
      </KDropdown.Content>
    </KDropdown.Portal>
  );
}

export function DropdownItem(props: {
  children: JSX.Element;
  class?: string;
  onSelect?: () => void;
}) {
  return (
    <KDropdown.Item
      class={cn(
        'flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted transition-colors',
        props.class
      )}
      onSelect={props.onSelect}
    >
      {props.children}
    </KDropdown.Item>
  );
}
```

- [x] **Step 7: Implement Textarea**

```tsx
// packages/chat/src/ui/textarea.tsx
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';
import { useAutoResize } from '../primitives/use-auto-resize';

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxHeight?: number;
  autoResize?: boolean;
}

export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, ['class', 'maxHeight', 'autoResize']);
  const { ref } = useAutoResize({ maxHeight: local.maxHeight });

  return (
    <textarea
      ref={local.autoResize !== false ? ref : undefined}
      class={cn(
        'w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none',
        local.class
      )}
      rows={1}
      {...rest}
    />
  );
}
```

- [x] **Step 8: Implement Badge**

```tsx
// packages/chat/src/ui/badge.tsx
import { type JSX, splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        count: 'bg-muted text-muted-foreground min-w-5 h-5 justify-center px-1.5',
        citation: 'bg-citation text-white px-1.5 py-0.5 cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends JSX.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['variant', 'class', 'children']);
  return (
    <span class={cn(badgeVariants({ variant: local.variant }), local.class)} {...rest}>
      {local.children}
    </span>
  );
}
```

- [x] **Step 9: Implement Separator**

```tsx
// packages/chat/src/ui/separator.tsx
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator(props: SeparatorProps) {
  const [local, rest] = splitProps(props, ['orientation', 'class']);
  const isVertical = () => local.orientation === 'vertical';

  return (
    <div
      role="separator"
      class={cn(
        'shrink-0 bg-border',
        isVertical() ? 'h-full w-px' : 'h-px w-full',
        local.class
      )}
      {...rest}
    />
  );
}
```

- [x] **Step 10: Implement Dialog**

```tsx
// packages/chat/src/ui/dialog.tsx
import { Dialog as KDialog } from '@kobalte/core/dialog';
import { type JSX } from 'solid-js';
import { cn } from '../utils/cn';

export const Dialog = KDialog;
export const DialogTrigger = KDialog.Trigger;

export function DialogContent(props: { children: JSX.Element; class?: string; title: string }) {
  return (
    <KDialog.Portal>
      <KDialog.Overlay class="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0" />
      <KDialog.Content
        class={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 w-full max-w-md',
          props.class
        )}
      >
        <KDialog.Title class="text-lg font-semibold">{props.title}</KDialog.Title>
        {props.children}
        <KDialog.CloseButton class="absolute right-4 top-4 text-muted-foreground hover:text-foreground" />
      </KDialog.Content>
    </KDialog.Portal>
  );
}
```

- [x] **Step 11: Export all UI components from index.ts**

Update `packages/chat/src/index.ts` — add after the primitives exports:

```typescript
// UI Primitives
export { Button, buttonVariants } from './ui/button';
export type { ButtonProps } from './ui/button';
export { Avatar } from './ui/avatar';
export type { AvatarProps } from './ui/avatar';
export { Tooltip } from './ui/tooltip';
export { HoverCard } from './ui/hover-card';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
export { ScrollArea } from './ui/scroll-area';
export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './ui/dropdown';
export { Textarea } from './ui/textarea';
export type { TextareaProps } from './ui/textarea';
export { Badge } from './ui/badge';
export type { BadgeProps } from './ui/badge';
export { Separator } from './ui/separator';
export { Dialog, DialogTrigger, DialogContent } from './ui/dialog';
```

- [x] **Step 12: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat exec tsc --noEmit`
Expected: No errors

- [x] **Step 13: Commit**

```bash
git add packages/chat/src/ui/ packages/chat/src/index.ts
git commit -m "feat(chat): add styled UI primitives (Avatar, Tooltip, HoverCard, Collapsible, Dropdown, Textarea, Badge, Separator, Dialog)"
```

---

## Phase 4: Core Chat Components (Layer 3)

### Task 10: ChatContainer Component

**Files:**
- Create: `packages/chat/src/components/chat-container.tsx`

- [x] **Step 1: Implement ChatContainer**

Reference: `reference/prompt-kit/components/ui/chat-container.tsx`

```tsx
// packages/chat/src/components/chat-container.tsx
import { type JSX, splitProps, createContext, useContext } from 'solid-js';
import { cn } from '../utils/cn';
import { useStickToBottom } from '../primitives/use-stick-to-bottom';

interface ChatContainerContextValue {
  isAtBottom: () => boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const ChatContainerContext = createContext<ChatContainerContextValue>();

export function useChatContainer() {
  const ctx = useContext(ChatContainerContext);
  if (!ctx) throw new Error('useChatContainer must be used within ChatContainer');
  return ctx;
}

export interface ChatContainerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

export function ChatContainer(props: ChatContainerProps) {
  const [local, rest] = splitProps(props, ['children', 'class']);
  const { ref, isAtBottom, scrollToBottom } = useStickToBottom();

  return (
    <ChatContainerContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div
        ref={ref}
        class={cn('flex flex-1 flex-col overflow-y-auto', local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </ChatContainerContext.Provider>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/chat/src/components/chat-container.tsx
git commit -m "feat(chat): add ChatContainer with stick-to-bottom scroll management"
```

---

### Task 11: Message Component

**Files:**
- Create: `packages/chat/src/components/message.tsx`
- Create: `packages/chat/tests/components/message.test.tsx`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/components/message.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Message, MessageAvatar, MessageContent, MessageActions, MessageAction } from '../../src/components/message';

describe('Message', () => {
  it('renders user message', () => {
    render(() => (
      <Message role="user">
        <MessageContent>Hello world</MessageContent>
      </Message>
    ));
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('renders assistant message with avatar', () => {
    render(() => (
      <Message role="assistant">
        <MessageAvatar fallback="AI" />
        <MessageContent>I can help with that</MessageContent>
      </Message>
    ));
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('I can help with that')).toBeTruthy();
  });

  it('applies user alignment', () => {
    const { container } = render(() => (
      <Message role="user">
        <MessageContent>Test</MessageContent>
      </Message>
    ));
    const messageEl = container.firstChild as HTMLElement;
    expect(messageEl.className).toContain('justify-end');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement Message compound component**

Reference: `reference/prompt-kit/components/ui/message.tsx`

```tsx
// packages/chat/src/components/message.tsx
import { type JSX, splitProps, createContext, useContext } from 'solid-js';
import { cn } from '../utils/cn';
import { Avatar } from '../ui/avatar';
import { Tooltip } from '../ui/tooltip';
import { Button } from '../ui/button';

type MessageRole = 'user' | 'assistant';

interface MessageContextValue {
  role: MessageRole;
}

const MessageContext = createContext<MessageContextValue>();

function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('Message subcomponents must be used within Message');
  return ctx;
}

export interface MessageProps extends JSX.HTMLAttributes<HTMLDivElement> {
  role: MessageRole;
  children: JSX.Element;
}

export function Message(props: MessageProps) {
  const [local, rest] = splitProps(props, ['role', 'children', 'class']);

  return (
    <MessageContext.Provider value={{ role: local.role }}>
      <div
        class={cn(
          'flex gap-3',
          local.role === 'user' ? 'justify-end' : 'justify-start',
          local.class
        )}
        {...rest}
      >
        {local.children}
      </div>
    </MessageContext.Provider>
  );
}

export interface MessageAvatarProps {
  src?: string;
  fallback: string;
  class?: string;
}

export function MessageAvatar(props: MessageAvatarProps) {
  return (
    <Avatar
      src={props.src}
      fallback={props.fallback}
      size="md"
      class={cn('mt-0.5', props.class)}
    />
  );
}

export interface MessageContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

export function MessageContent(props: MessageContentProps) {
  const { role } = useMessage();
  const [local, rest] = splitProps(props, ['children', 'class']);

  return (
    <div
      class={cn(
        'rounded-xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%]',
        role === 'user'
          ? 'bg-muted text-foreground rounded-br-sm'
          : 'flex-1 text-foreground',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export interface MessageActionsProps {
  children: JSX.Element;
  class?: string;
}

export function MessageActions(props: MessageActionsProps) {
  return (
    <div class={cn('flex items-center gap-1 mt-1', props.class)}>
      {props.children}
    </div>
  );
}

export interface MessageActionProps {
  tooltip: string;
  children: JSX.Element;
  onClick?: () => void;
}

export function MessageAction(props: MessageActionProps) {
  return (
    <Tooltip content={props.tooltip}>
      <Button variant="ghost" size="icon-sm" onClick={props.onClick}>
        {props.children}
      </Button>
    </Tooltip>
  );
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/components/message.tsx packages/chat/tests/components/message.test.tsx
git commit -m "feat(chat): add Message compound component (Avatar, Content, Actions)"
```

---

### Task 12: PromptInput Component

**Files:**
- Create: `packages/chat/src/components/prompt-input.tsx`
- Create: `packages/chat/tests/components/prompt-input.test.tsx`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/components/prompt-input.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { PromptInput } from '../../src/components/prompt-input';

describe('PromptInput', () => {
  it('renders textarea with placeholder', () => {
    render(() => <PromptInput placeholder="Type here..." onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText('Type here...')).toBeTruthy();
  });

  it('calls onSubmit when Enter is pressed without Shift', async () => {
    const onSubmit = vi.fn();
    render(() => <PromptInput placeholder="Type..." onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Type...');
    await fireEvent.input(textarea, { target: { value: 'Hello' } });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith('Hello');
  });

  it('does not submit on Shift+Enter', async () => {
    const onSubmit = vi.fn();
    render(() => <PromptInput placeholder="Type..." onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Type...');
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement PromptInput**

Reference: `reference/prompt-kit/components/ui/prompt-input.tsx`

```tsx
// packages/chat/src/components/prompt-input.tsx
import { type JSX, splitProps, createSignal } from 'solid-js';
import { cn } from '../utils/cn';
import { Textarea } from '../ui/textarea';

export interface PromptInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  maxHeight?: number;
  actions?: JSX.Element;
  class?: string;
}

export function PromptInput(props: PromptInputProps) {
  const [local] = splitProps(props, [
    'placeholder', 'onSubmit', 'isLoading', 'disabled', 'maxHeight', 'actions', 'class',
  ]);
  const [value, setValue] = createSignal('');

  function handleSubmit() {
    const text = value().trim();
    if (!text || local.isLoading || local.disabled) return;
    local.onSubmit(text);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div class={cn('rounded-xl bg-muted/40 p-3 flex flex-col gap-2', local.class)}>
      <Textarea
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={local.placeholder}
        disabled={local.disabled || local.isLoading}
        maxHeight={local.maxHeight ?? 200}
        autoResize
        class="min-h-[20px]"
      />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          {local.actions}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!value().trim() || local.isLoading || local.disabled}
          class={cn(
            'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
            value().trim()
              ? 'bg-ring text-background hover:bg-ring/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/chat/src/components/prompt-input.tsx packages/chat/tests/components/prompt-input.test.tsx
git commit -m "feat(chat): add PromptInput with auto-resize, Enter submit, actions slot"
```

---

### Task 13: ScrollButton Component

**Files:**
- Create: `packages/chat/src/components/scroll-button.tsx`

- [x] **Step 1: Implement ScrollButton**

```tsx
// packages/chat/src/components/scroll-button.tsx
import { Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { useChatContainer } from './chat-container';
import { ChevronDown } from 'lucide-solid';

export interface ScrollButtonProps {
  class?: string;
}

export function ScrollButton(props: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useChatContainer();

  return (
    <Show when={!isAtBottom()}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => scrollToBottom()}
        class={cn(
          'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10',
          props.class
        )}
      >
        <ChevronDown size={16} />
      </Button>
    </Show>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/chat/src/components/scroll-button.tsx
git commit -m "feat(chat): add ScrollButton for scroll-to-bottom indicator"
```

---

### Task 14: Loader Component

**Files:**
- Create: `packages/chat/src/components/loader.tsx`
- Create: `packages/chat/tests/components/loader.test.tsx`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/components/loader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Loader } from '../../src/components/loader';

describe('Loader', () => {
  it('renders bars variant', () => {
    const { container } = render(() => <Loader variant="bars" />);
    expect(container.querySelector('[data-variant="bars"]')).toBeTruthy();
  });

  it('renders text-shimmer with custom text', () => {
    render(() => <Loader variant="text-shimmer" text="Thinking..." />);
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('renders loading-dots variant', () => {
    const { container } = render(() => <Loader variant="loading-dots" />);
    expect(container.querySelector('[data-variant="loading-dots"]')).toBeTruthy();
  });

  it('renders pulse-dot variant', () => {
    const { container } = render(() => <Loader variant="pulse-dot" />);
    expect(container.querySelector('[data-variant="pulse-dot"]')).toBeTruthy();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement Loader**

Reference: `reference/prompt-kit/components/ui/loader.tsx`

```tsx
// packages/chat/src/components/loader.tsx
import { type JSX, splitProps, Switch, Match } from 'solid-js';
import { cn } from '../utils/cn';

type LoaderVariant = 'bars' | 'text-shimmer' | 'loading-dots' | 'pulse-dot';
type LoaderSize = 'sm' | 'md' | 'lg';

export interface LoaderProps {
  variant: LoaderVariant;
  size?: LoaderSize;
  text?: string;
  class?: string;
}

const dotSizes = { sm: 'h-1 w-1', md: 'h-1.5 w-1.5', lg: 'h-2 w-2' };
const barSizes = { sm: 'h-3 w-0.5', md: 'h-4 w-1', lg: 'h-5 w-1' };
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export function Loader(props: LoaderProps) {
  const [local] = splitProps(props, ['variant', 'size', 'text', 'class']);
  const size = () => local.size ?? 'md';

  return (
    <div class={cn('inline-flex items-center gap-1', local.class)} data-variant={local.variant}>
      <Switch>
        <Match when={local.variant === 'bars'}>
          <div class="flex items-end gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                class={cn(
                  'rounded-full bg-muted-foreground animate-pulse',
                  barSizes[size()]
                )}
                style={{ 'animation-delay': `${i * 150}ms` }}
              />
            ))}
          </div>
        </Match>

        <Match when={local.variant === 'text-shimmer'}>
          <span
            class={cn(
              'bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer',
              textSizes[size()]
            )}
          >
            {local.text ?? 'Thinking...'}
          </span>
        </Match>

        <Match when={local.variant === 'loading-dots'}>
          <div class="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                class={cn(
                  'rounded-full bg-muted-foreground animate-bounce',
                  dotSizes[size()]
                )}
                style={{ 'animation-delay': `${i * 200}ms` }}
              />
            ))}
          </div>
        </Match>

        <Match when={local.variant === 'pulse-dot'}>
          <div class="relative flex items-center justify-center">
            <div class={cn('rounded-full bg-muted-foreground animate-ping absolute', dotSizes[size()])} />
            <div class={cn('rounded-full bg-muted-foreground', dotSizes[size()])} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}
```

- [x] **Step 4: Add shimmer keyframes to global.css**

Add to `apps/chat/src/global.css`:

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-shimmer {
  animation: shimmer 3s ease-in-out infinite;
}
```

- [x] **Step 5: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/chat/src/components/loader.tsx packages/chat/tests/components/loader.test.tsx apps/chat/src/global.css
git commit -m "feat(chat): add Loader component with bars, text-shimmer, loading-dots, pulse-dot variants"
```

---

### Task 15: Markdown Component

**Files:**
- Create: `packages/chat/src/components/markdown.tsx`

- [x] **Step 1: Install markdown dependencies**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat add solid-markdown remark-gfm remark-breaks`
Expected: Dependencies installed

- [x] **Step 2: Implement Markdown**

Reference: `reference/prompt-kit/components/ui/markdown.tsx`

```tsx
// packages/chat/src/components/markdown.tsx
import { type JSX, splitProps, lazy, Suspense } from 'solid-js';
import { cn } from '../utils/cn';
import SolidMarkdown from 'solid-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export interface MarkdownProps {
  content: string;
  class?: string;
  components?: Record<string, (props: any) => JSX.Element>;
}

export function Markdown(props: MarkdownProps) {
  const [local] = splitProps(props, ['content', 'class', 'components']);

  return (
    <div class={cn('prose prose-invert prose-sm max-w-none', local.class)}>
      <SolidMarkdown
        children={local.content}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={local.components}
      />
    </div>
  );
}
```

Note: If `solid-markdown` is not available or has compatibility issues, implement a minimal markdown renderer using `marked` library with `innerHTML`. The implementing agent should check compatibility and choose the best approach.

- [x] **Step 3: Verify it compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat exec tsc --noEmit`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add packages/chat/src/components/markdown.tsx
git commit -m "feat(chat): add Markdown component with GFM and line break support"
```

---

### Task 16: CodeBlock Component

**Files:**
- Create: `packages/chat/src/components/code-block.tsx`

- [x] **Step 1: Install shiki**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat add shiki`
Expected: Installed

- [x] **Step 2: Implement CodeBlock**

Reference: `reference/prompt-kit/components/ui/code-block.tsx`

```tsx
// packages/chat/src/components/code-block.tsx
import { type JSX, splitProps, createResource, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { codeToHtml } from 'shiki';
import { Copy, Check } from 'lucide-solid';
import { createSignal } from 'solid-js';

export interface CodeBlockProps {
  code: string;
  language?: string;
  header?: string;
  class?: string;
}

export function CodeBlock(props: CodeBlockProps) {
  const [local] = splitProps(props, ['code', 'language', 'header', 'class']);
  const [copied, setCopied] = createSignal(false);

  const [highlighted] = createResource(
    () => ({ code: local.code, lang: local.language ?? 'text' }),
    async ({ code, lang }) => {
      try {
        return await codeToHtml(code, {
          lang,
          theme: 'github-dark-default',
        });
      } catch {
        return `<pre><code>${code}</code></pre>`;
      }
    }
  );

  async function copyToClipboard() {
    await navigator.clipboard.writeText(local.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div class={cn('rounded-lg overflow-hidden bg-[#0d1117] my-2', local.class)}>
      <Show when={local.header || true}>
        <div class="flex items-center justify-between px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground">
          <span>{local.header ?? local.language ?? 'code'}</span>
          <Button variant="ghost" size="icon-sm" onClick={copyToClipboard}>
            <Show when={copied()} fallback={<Copy size={12} />}>
              <Check size={12} />
            </Show>
          </Button>
        </div>
      </Show>
      <div
        class="p-3 text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!text-xs"
        innerHTML={highlighted() ?? `<pre><code>${local.code}</code></pre>`}
      />
    </div>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add packages/chat/src/components/code-block.tsx
git commit -m "feat(chat): add CodeBlock with Shiki syntax highlighting and copy button"
```

---

### Task 17: ResponseStream Component

**Files:**
- Create: `packages/chat/src/components/response-stream.tsx`

- [x] **Step 1: Implement ResponseStream**

This component ties together `useTextStream` + `Markdown` for progressive streaming display.

```tsx
// packages/chat/src/components/response-stream.tsx
import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { useTextStream, type UseTextStreamOptions } from '../primitives/use-text-stream';
import { Markdown } from './markdown';
import { Loader } from './loader';

export interface ResponseStreamProps {
  source: string | AsyncIterable<string>;
  mode?: 'typewriter' | 'fade';
  speed?: number;
  class?: string;
  onComplete?: () => void;
}

export function ResponseStream(props: ResponseStreamProps) {
  const [local] = splitProps(props, ['source', 'mode', 'speed', 'class', 'onComplete']);

  const stream = useTextStream({
    mode: local.mode ?? 'typewriter',
    speed: local.speed,
  });

  // Start streaming when source is provided
  stream.startStreaming(local.source);

  return (
    <div class={cn('relative', local.class)}>
      <Show
        when={stream.displayedText()}
        fallback={<Loader variant="loading-dots" size="sm" />}
      >
        <Markdown content={stream.displayedText()} />
      </Show>
      <Show when={!stream.isComplete()}>
        <span class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />
      </Show>
    </div>
  );
}

export { useTextStream };
```

- [x] **Step 2: Commit**

```bash
git add packages/chat/src/components/response-stream.tsx
git commit -m "feat(chat): add ResponseStream for progressive markdown streaming"
```

---

## Phase 5: Feature Components (Layer 3)

### Task 18: Source (Citation) Component

**Files:**
- Create: `packages/chat/src/components/source.tsx`

- [x] **Step 1: Implement Source**

Reference: `reference/prompt-kit/components/ui/source.tsx`

```tsx
// packages/chat/src/components/source.tsx
import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { HoverCard } from '../ui/hover-card';
import { Badge } from '../ui/badge';

export interface SourceTriggerProps {
  label: string;
  index?: number;
  class?: string;
}

export function SourceTrigger(props: SourceTriggerProps) {
  return (
    <Badge variant="citation" class={cn('text-[11px]', props.class)}>
      <Show when={props.index !== undefined}>
        <span class="font-semibold">{props.index}</span>
      </Show>
      <Show when={!props.index}>
        {props.label}
      </Show>
    </Badge>
  );
}

export interface SourceContentProps {
  title: string;
  description?: string;
  url?: string;
  timestamp?: string;
}

export interface SourceProps {
  trigger: SourceTriggerProps;
  content: SourceContentProps;
  onClick?: () => void;
  class?: string;
}

export function Source(props: SourceProps) {
  const [local] = splitProps(props, ['trigger', 'content', 'onClick', 'class']);

  return (
    <HoverCard
      trigger={
        <span onClick={local.onClick} class="cursor-pointer">
          <SourceTrigger {...local.trigger} />
        </span>
      }
      class={local.class}
    >
      <div class="space-y-1.5">
        <p class="text-sm font-medium text-foreground">{local.content.title}</p>
        <Show when={local.content.description}>
          <p class="text-xs text-muted-foreground line-clamp-3">{local.content.description}</p>
        </Show>
        <Show when={local.content.timestamp}>
          <p class="text-xs text-muted-foreground">@ {local.content.timestamp}</p>
        </Show>
        <Show when={local.content.url}>
          <p class="text-xs text-citation truncate">{local.content.url}</p>
        </Show>
      </div>
    </HoverCard>
  );
}

export interface SourceListProps {
  children: JSX.Element;
  class?: string;
}

export function SourceList(props: SourceListProps) {
  return (
    <div class={cn('flex flex-wrap gap-1.5 mt-3', props.class)}>
      {props.children}
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/chat/src/components/source.tsx
git commit -m "feat(chat): add Source citation component with hover card preview"
```

---

### Task 19: FeedbackBar, PromptSuggestion, ChainOfThought

**Files:**
- Create: `packages/chat/src/components/feedback-bar.tsx`
- Create: `packages/chat/src/components/prompt-suggestion.tsx`
- Create: `packages/chat/src/components/chain-of-thought.tsx`

- [x] **Step 1: Implement FeedbackBar**

Reference: `reference/prompt-kit/components/ui/feedback-bar.tsx`

```tsx
// packages/chat/src/components/feedback-bar.tsx
import { splitProps } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { ThumbsUp, ThumbsDown, X } from 'lucide-solid';

export interface FeedbackBarProps {
  title?: string;
  onHelpful?: () => void;
  onNotHelpful?: () => void;
  onClose?: () => void;
  class?: string;
}

export function FeedbackBar(props: FeedbackBarProps) {
  const [local] = splitProps(props, ['title', 'onHelpful', 'onNotHelpful', 'onClose', 'class']);

  return (
    <div class={cn('flex items-center gap-2 text-xs text-muted-foreground', local.class)}>
      <span>{local.title ?? 'Was this helpful?'}</span>
      <Button variant="ghost" size="icon-sm" onClick={local.onHelpful}>
        <ThumbsUp size={12} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={local.onNotHelpful}>
        <ThumbsDown size={12} />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={local.onClose}>
        <X size={12} />
      </Button>
    </div>
  );
}
```

- [x] **Step 2: Implement PromptSuggestion**

Reference: `reference/prompt-kit/components/ui/prompt-suggestion.tsx`

```tsx
// packages/chat/src/components/prompt-suggestion.tsx
import { splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';

export interface PromptSuggestionProps {
  text: string;
  highlight?: string;
  onClick?: () => void;
  class?: string;
}

export function PromptSuggestion(props: PromptSuggestionProps) {
  const [local] = splitProps(props, ['text', 'highlight', 'onClick', 'class']);

  function renderText() {
    if (!local.highlight) return local.text;
    const idx = local.text.toLowerCase().indexOf(local.highlight.toLowerCase());
    if (idx === -1) return local.text;
    const before = local.text.slice(0, idx);
    const match = local.text.slice(idx, idx + local.highlight.length);
    const after = local.text.slice(idx + local.highlight.length);
    return (
      <>
        {before}
        <span class="text-foreground font-medium">{match}</span>
        {after}
      </>
    );
  }

  return (
    <button
      onClick={local.onClick}
      class={cn(
        'rounded-full bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer whitespace-nowrap',
        local.class
      )}
    >
      {renderText()}
    </button>
  );
}
```

- [x] **Step 3: Implement ChainOfThought**

Reference: `reference/prompt-kit/components/ui/chain-of-thought.tsx`

```tsx
// packages/chat/src/components/chain-of-thought.tsx
import { type JSX, splitProps, createSignal } from 'solid-js';
import { cn } from '../utils/cn';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { ChevronRight } from 'lucide-solid';

export interface ChainOfThoughtProps {
  children: JSX.Element;
  class?: string;
  defaultOpen?: boolean;
}

export function ChainOfThought(props: ChainOfThoughtProps) {
  return (
    <div class={cn('space-y-1', props.class)}>
      {props.children}
    </div>
  );
}

export interface ChainOfThoughtStepProps {
  children: JSX.Element;
  defaultOpen?: boolean;
}

export function ChainOfThoughtStep(props: ChainOfThoughtStepProps) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);

  return (
    <Collapsible open={open()} onOpenChange={setOpen}>
      {props.children}
    </Collapsible>
  );
}

export interface ChainOfThoughtTriggerProps {
  children: JSX.Element;
  class?: string;
}

export function ChainOfThoughtTrigger(props: ChainOfThoughtTriggerProps) {
  return (
    <CollapsibleTrigger
      class={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group w-full',
        props.class
      )}
    >
      <ChevronRight
        size={14}
        class="transition-transform group-data-[expanded]:rotate-90"
      />
      {props.children}
    </CollapsibleTrigger>
  );
}

export interface ChainOfThoughtContentProps {
  children: JSX.Element;
  class?: string;
}

export function ChainOfThoughtItemContent(props: ChainOfThoughtContentProps) {
  return (
    <CollapsibleContent class={cn('pl-5 pt-1 text-sm text-muted-foreground', props.class)}>
      {props.children}
    </CollapsibleContent>
  );
}
```

- [x] **Step 4: Commit**

```bash
git add packages/chat/src/components/feedback-bar.tsx packages/chat/src/components/prompt-suggestion.tsx packages/chat/src/components/chain-of-thought.tsx
git commit -m "feat(chat): add FeedbackBar, PromptSuggestion, ChainOfThought components"
```

---

### Task 20: Checkpoint and Context Components

**Files:**
- Create: `packages/chat/src/components/checkpoint.tsx`
- Create: `packages/chat/src/components/context.tsx`

- [x] **Step 1: Implement Checkpoint**

Reference: `reference/ai-elements/packages/elements/src/checkpoint.tsx`

```tsx
// packages/chat/src/components/checkpoint.tsx
import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Bookmark } from 'lucide-solid';

export interface CheckpointProps {
  children?: JSX.Element;
  class?: string;
}

export function Checkpoint(props: CheckpointProps) {
  return (
    <div class={cn('flex items-center gap-3 py-2', props.class)}>
      <Separator class="flex-1" />
      <div class="flex items-center gap-1.5 text-muted-foreground">
        {props.children}
      </div>
      <Separator class="flex-1" />
    </div>
  );
}

export function CheckpointIcon(props: { class?: string }) {
  return <Bookmark size={14} class={cn('text-muted-foreground', props.class)} />;
}

export interface CheckpointTriggerProps {
  tooltip?: string;
  onClick?: () => void;
  children?: JSX.Element;
  class?: string;
}

export function CheckpointTrigger(props: CheckpointTriggerProps) {
  const button = (
    <Button variant="ghost" size="icon-sm" onClick={props.onClick} class={props.class}>
      {props.children ?? 'Restore'}
    </Button>
  );

  return (
    <Show when={props.tooltip} fallback={button}>
      <Tooltip content={props.tooltip!}>{button}</Tooltip>
    </Show>
  );
}
```

- [x] **Step 2: Implement Context**

Reference: `reference/ai-elements/packages/elements/src/context.tsx`

```tsx
// packages/chat/src/components/context.tsx
import { type JSX, splitProps, Show, createMemo } from 'solid-js';
import { cn } from '../utils/cn';
import { HoverCard } from '../ui/hover-card';
import type { ContextInfo } from '@tab-zen/shared';

export interface ContextProps {
  info: ContextInfo;
  class?: string;
}

export function Context(props: ContextProps) {
  const [local] = splitProps(props, ['info', 'class']);

  const percentage = createMemo(() =>
    Math.round((local.info.usedTokens / local.info.maxTokens) * 100)
  );

  const circumference = 2 * Math.PI * 10;
  const dashOffset = createMemo(() =>
    circumference - (percentage() / 100) * circumference
  );

  const colorClass = createMemo(() => {
    if (percentage() > 90) return 'text-red-400';
    if (percentage() > 70) return 'text-yellow-400';
    return 'text-ring';
  });

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function formatCost(n: number): string {
    return `$${n.toFixed(4)}`;
  }

  return (
    <HoverCard
      trigger={
        <button class={cn('flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors', local.class)}>
          <svg width="20" height="20" viewBox="0 0 24 24" class={colorClass()}>
            <circle
              cx="12" cy="12" r="10"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.2"
            />
            <circle
              cx="12" cy="12" r="10"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray={circumference}
              stroke-dashoffset={dashOffset()}
              stroke-linecap="round"
              transform="rotate(-90 12 12)"
            />
          </svg>
          <span>{percentage()}%</span>
        </button>
      }
      class="w-56"
    >
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground font-medium">Context</span>
          <span class="text-muted-foreground">
            {formatTokens(local.info.usedTokens)} / {formatTokens(local.info.maxTokens)}
          </span>
        </div>

        {/* Progress bar */}
        <div class="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            class={cn('h-full rounded-full transition-all', colorClass().replace('text-', 'bg-'))}
            style={{ width: `${percentage()}%` }}
          />
        </div>

        {/* Token breakdown */}
        <div class="space-y-1 text-xs text-muted-foreground">
          <Show when={local.info.inputTokens}>
            <div class="flex justify-between">
              <span>Input</span>
              <span>{formatTokens(local.info.inputTokens!)}</span>
            </div>
          </Show>
          <Show when={local.info.outputTokens}>
            <div class="flex justify-between">
              <span>Output</span>
              <span>{formatTokens(local.info.outputTokens!)}</span>
            </div>
          </Show>
          <Show when={local.info.reasoningTokens}>
            <div class="flex justify-between">
              <span>Reasoning</span>
              <span>{formatTokens(local.info.reasoningTokens!)}</span>
            </div>
          </Show>
          <Show when={local.info.cacheTokens}>
            <div class="flex justify-between">
              <span>Cached</span>
              <span>{formatTokens(local.info.cacheTokens!)}</span>
            </div>
          </Show>
        </div>

        {/* Cost */}
        <Show when={local.info.estimatedCost !== undefined}>
          <div class="flex justify-between text-xs border-t border-border pt-1.5 mt-1.5">
            <span class="text-muted-foreground">Estimated cost</span>
            <span class="text-foreground">{formatCost(local.info.estimatedCost!)}</span>
          </div>
        </Show>
      </div>
    </HoverCard>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add packages/chat/src/components/checkpoint.tsx packages/chat/src/components/context.tsx
git commit -m "feat(chat): add Checkpoint restore points and Context token usage display"
```

---

### Task 21: VoiceInput Component

**Files:**
- Create: `packages/chat/src/components/voice-input.tsx`

- [x] **Step 1: Implement VoiceInput**

```tsx
// packages/chat/src/components/voice-input.tsx
import { splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { useVoiceRecorder } from '../primitives/use-voice-recorder';
import { Mic, MicOff } from 'lucide-solid';

export interface VoiceInputProps {
  onTranscribe: (audio: Blob) => Promise<string>;
  onTranscription: (text: string) => void;
  disabled?: boolean;
  class?: string;
}

export function VoiceInput(props: VoiceInputProps) {
  const [local] = splitProps(props, ['onTranscribe', 'onTranscription', 'disabled', 'class']);
  const { isRecording, start, stop, error } = useVoiceRecorder();

  async function handleClick() {
    if (isRecording()) {
      stop();
    } else {
      try {
        const blob = await start();
        const text = await local.onTranscribe(blob);
        if (text.trim()) {
          local.onTranscription(text.trim());
        }
      } catch {
        // Error is captured in useVoiceRecorder.error
      }
    }
  }

  return (
    <Tooltip content={isRecording() ? 'Stop recording' : 'Voice input'}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={local.disabled}
        class={cn(
          isRecording() && 'text-red-400 animate-pulse',
          local.class
        )}
      >
        <Show when={isRecording()} fallback={<Mic size={16} />}>
          <MicOff size={16} />
        </Show>
      </Button>
    </Tooltip>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add packages/chat/src/components/voice-input.tsx
git commit -m "feat(chat): add VoiceInput with push-to-talk and Wispr Flow-style UX"
```

---

### Task 22: ConversationList and ConversationItem

**Files:**
- Create: `packages/chat/src/components/conversation-list.tsx`
- Create: `packages/chat/src/components/conversation-item.tsx`
- Create: `packages/chat/tests/components/conversation-list.test.tsx`

- [x] **Step 1: Write the test**

```typescript
// packages/chat/tests/components/conversation-list.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { ConversationList } from '../../src/components/conversation-list';
import { ConversationItem } from '../../src/components/conversation-item';
import type { ConversationSummary, ConversationGroup } from '@tab-zen/shared';

describe('ConversationList', () => {
  const groups: ConversationGroup[] = [
    { id: 'g1', name: 'Research', sortOrder: 0, createdAt: '2026-01-01' },
  ];

  const conversations: ConversationSummary[] = [
    {
      id: 'c1', title: 'Database options', groupId: 'g1',
      scope: { type: 'collection' }, messageCount: 5,
      lastMessageAt: '2026-04-10', updatedAt: '2026-04-10',
    },
    {
      id: 'c2', title: 'Quick question', groupId: undefined,
      scope: { type: 'collection' }, messageCount: 2,
      lastMessageAt: '2026-04-09', updatedAt: '2026-04-09',
    },
  ];

  it('renders groups with conversation counts', () => {
    render(() => (
      <ConversationList
        groups={groups}
        conversations={conversations}
        activeId="c1"
        onSelect={() => {}}
        onNewChat={() => {}}
      />
    ));
    expect(screen.getByText('Research')).toBeTruthy();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: FAIL

- [x] **Step 3: Implement ConversationItem**

```tsx
// packages/chat/src/components/conversation-item.tsx
import { splitProps } from 'solid-js';
import { cn } from '../utils/cn';
import type { ConversationSummary } from '@tab-zen/shared';

export interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onSelect: (id: string) => void;
  class?: string;
}

export function ConversationItem(props: ConversationItemProps) {
  const [local] = splitProps(props, ['conversation', 'isActive', 'onSelect', 'class']);

  return (
    <button
      onClick={() => local.onSelect(local.conversation.id)}
      class={cn(
        'w-full text-left rounded-lg px-2.5 py-2 transition-colors',
        local.isActive ? 'bg-muted' : 'hover:bg-muted/50',
        local.class
      )}
    >
      <div class={cn(
        'text-[13px] truncate',
        local.isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
      )}>
        {local.conversation.title}
      </div>
      <div class="text-[11px] text-muted-foreground/60 truncate mt-0.5">
        {local.conversation.messageCount} messages
      </div>
    </button>
  );
}
```

- [x] **Step 4: Implement ConversationList**

```tsx
// packages/chat/src/components/conversation-list.tsx
import { type JSX, splitProps, For, Show, createSignal, createMemo } from 'solid-js';
import { cn } from '../utils/cn';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { ConversationItem } from './conversation-item';
import { ChevronDown, Plus, Menu, Search } from 'lucide-solid';
import type { ConversationSummary, ConversationGroup } from '@tab-zen/shared';

export interface ConversationListProps {
  groups: ConversationGroup[];
  conversations: ConversationSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onToggleSidebar?: () => void;
  class?: string;
}

export function ConversationList(props: ConversationListProps) {
  const [local] = splitProps(props, [
    'groups', 'conversations', 'activeId', 'onSelect', 'onNewChat', 'onToggleSidebar', 'class',
  ]);
  const [searchQuery, setSearchQuery] = createSignal('');

  const filteredConversations = createMemo(() => {
    const q = searchQuery().toLowerCase();
    if (!q) return local.conversations;
    return local.conversations.filter((c) =>
      c.title.toLowerCase().includes(q)
    );
  });

  const groupedConversations = createMemo(() => {
    const grouped = new Map<string | undefined, ConversationSummary[]>();
    for (const conv of filteredConversations()) {
      const key = conv.groupId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(conv);
    }
    return grouped;
  });

  const ungrouped = createMemo(() => groupedConversations().get(undefined) ?? []);

  return (
    <div class={cn('flex flex-col h-full bg-sidebar', local.class)}>
      {/* Header */}
      <div class="flex items-center justify-between p-3 pb-2">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={local.onToggleSidebar}>
            <Menu size={16} />
          </Button>
          <span class="text-sm font-semibold text-foreground">Chats</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={local.onNewChat}>
          <Plus size={16} />
        </Button>
      </div>

      {/* Search */}
      <div class="px-3 pb-2">
        <div class="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
          <Search size={13} class="text-muted-foreground/60" />
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            placeholder="Search chats..."
            class="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Conversation Groups */}
      <ScrollArea class="flex-1 px-2">
        <For each={local.groups}>
          {(group) => {
            const convs = createMemo(() => groupedConversations().get(group.id) ?? []);
            return (
              <Show when={convs().length > 0}>
                <ConversationGroupSection
                  name={group.name}
                  count={convs().length}
                  conversations={convs()}
                  activeId={local.activeId}
                  onSelect={local.onSelect}
                />
              </Show>
            );
          }}
        </For>

        {/* Ungrouped */}
        <Show when={ungrouped().length > 0}>
          <ConversationGroupSection
            name="Ungrouped"
            count={ungrouped().length}
            conversations={ungrouped()}
            activeId={local.activeId}
            onSelect={local.onSelect}
          />
        </Show>
      </ScrollArea>
    </div>
  );
}

interface ConversationGroupSectionProps {
  name: string;
  count: number;
  conversations: ConversationSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
}

function ConversationGroupSection(props: ConversationGroupSectionProps) {
  const [open, setOpen] = createSignal(true);

  return (
    <Collapsible open={open()} onOpenChange={setOpen}>
      <CollapsibleTrigger class="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-md bg-muted/30 text-[13px] text-muted-foreground font-medium hover:bg-muted/50 transition-colors cursor-pointer mt-1.5">
        <ChevronDown
          size={10}
          class={cn('transition-transform', !open() && '-rotate-90')}
        />
        <span>{props.name}</span>
        <Badge variant="count" class="ml-auto text-[11px]">
          {props.count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="pl-2 mt-0.5 space-y-0.5">
          <For each={props.conversations}>
            {(conv) => (
              <ConversationItem
                conversation={conv}
                isActive={conv.id === props.activeId}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [x] **Step 5: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/chat/src/components/conversation-list.tsx packages/chat/src/components/conversation-item.tsx packages/chat/tests/components/conversation-list.test.tsx
git commit -m "feat(chat): add ConversationList with grouped conversations and search"
```

---

### Task 23: ModelSwitcher and ChatScopePicker

**Files:**
- Create: `packages/chat/src/components/model-switcher.tsx`
- Create: `packages/chat/src/components/chat-scope-picker.tsx`

- [x] **Step 1: Implement ModelSwitcher**

```tsx
// packages/chat/src/components/model-switcher.tsx
import { splitProps, For, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../ui/dropdown';
import { Button } from '../ui/button';
import { ChevronDown } from 'lucide-solid';
import type { ModelOption } from '@tab-zen/shared';

export interface ModelSwitcherProps {
  models: ModelOption[];
  currentModelId: string;
  onModelChange: (modelId: string) => void;
  class?: string;
}

export function ModelSwitcher(props: ModelSwitcherProps) {
  const [local] = splitProps(props, ['models', 'currentModelId', 'onModelChange', 'class']);

  const currentModel = () => local.models.find((m) => m.id === local.currentModelId);

  return (
    <Show when={local.models.length > 1}>
      <Dropdown>
        <DropdownTrigger
          as={(triggerProps: any) => (
            <Button variant="ghost" size="sm" class={cn('gap-1 text-xs text-muted-foreground', local.class)} {...triggerProps}>
              {currentModel()?.name ?? local.currentModelId}
              <ChevronDown size={12} />
            </Button>
          )}
        />
        <DropdownContent>
          <For each={local.models}>
            {(model) => (
              <DropdownItem onSelect={() => local.onModelChange(model.id)}>
                <div class="flex flex-col">
                  <span class={cn(
                    'text-sm',
                    model.id === local.currentModelId && 'font-medium text-foreground'
                  )}>
                    {model.name}
                  </span>
                  <Show when={model.provider}>
                    <span class="text-xs text-muted-foreground">{model.provider}</span>
                  </Show>
                </div>
              </DropdownItem>
            )}
          </For>
        </DropdownContent>
      </Dropdown>
    </Show>
  );
}
```

- [x] **Step 2: Implement ChatScopePicker**

```tsx
// packages/chat/src/components/chat-scope-picker.tsx
import { splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../ui/dropdown';
import { Button } from '../ui/button';
import { Filter, ChevronDown } from 'lucide-solid';
import type { SearchFilters } from '@tab-zen/shared';

export interface ChatScopePickerProps {
  currentLabel: string;
  onScopeChange: (filters: SearchFilters | undefined) => void;
  availableAuthors?: string[];
  availableTags?: string[];
  class?: string;
}

export function ChatScopePicker(props: ChatScopePickerProps) {
  const [local] = splitProps(props, [
    'currentLabel', 'onScopeChange', 'availableAuthors', 'availableTags', 'class',
  ]);

  return (
    <Dropdown>
      <DropdownTrigger
        as={(triggerProps: any) => (
          <Button variant="ghost" size="sm" class={cn('gap-1 text-xs', local.class)} {...triggerProps}>
            <Filter size={12} />
            {local.currentLabel}
            <ChevronDown size={12} />
          </Button>
        )}
      />
      <DropdownContent class="min-w-[180px]">
        <DropdownItem onSelect={() => local.onScopeChange(undefined)}>
          All Content
        </DropdownItem>
        <Show when={local.availableAuthors?.length}>
          <div class="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Authors
          </div>
          {local.availableAuthors!.map((author) => (
            <DropdownItem onSelect={() => local.onScopeChange({ authors: [author] })}>
              {author}
            </DropdownItem>
          ))}
        </Show>
        <Show when={local.availableTags?.length}>
          <div class="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Tags
          </div>
          {local.availableTags!.map((tag) => (
            <DropdownItem onSelect={() => local.onScopeChange({ tags: [tag] })}>
              {tag}
            </DropdownItem>
          ))}
        </Show>
      </DropdownContent>
    </Dropdown>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add packages/chat/src/components/model-switcher.tsx packages/chat/src/components/chat-scope-picker.tsx
git commit -m "feat(chat): add ModelSwitcher and ChatScopePicker components"
```

---

### Task 24: Export All Components and Final Package Verification

**Files:**
- Modify: `packages/chat/src/index.ts`

- [x] **Step 1: Update index.ts with all exports**

```typescript
// packages/chat/src/index.ts

// Utilities
export { cn } from './utils/cn';

// Layer 1: Headless Primitives
export { useAutoResize } from './primitives/use-auto-resize';
export { useStickToBottom } from './primitives/use-stick-to-bottom';
export { useTextStream } from './primitives/use-text-stream';
export type { UseTextStreamOptions, TextStreamSegment } from './primitives/use-text-stream';
export { useVoiceRecorder } from './primitives/use-voice-recorder';
export type { UseVoiceRecorderOptions } from './primitives/use-voice-recorder';

// Layer 2: UI Primitives
export { Button, buttonVariants } from './ui/button';
export type { ButtonProps } from './ui/button';
export { Avatar } from './ui/avatar';
export type { AvatarProps } from './ui/avatar';
export { Tooltip } from './ui/tooltip';
export { HoverCard } from './ui/hover-card';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './ui/collapsible';
export { ScrollArea } from './ui/scroll-area';
export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from './ui/dropdown';
export { Textarea } from './ui/textarea';
export type { TextareaProps } from './ui/textarea';
export { Badge } from './ui/badge';
export type { BadgeProps } from './ui/badge';
export { Separator } from './ui/separator';
export { Dialog, DialogTrigger, DialogContent } from './ui/dialog';

// Layer 3: AI/Feature Components
export { ChatContainer, useChatContainer } from './components/chat-container';
export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction } from './components/message';
export { PromptInput } from './components/prompt-input';
export { ResponseStream } from './components/response-stream';
export { Markdown } from './components/markdown';
export { CodeBlock } from './components/code-block';
export { Loader } from './components/loader';
export { FeedbackBar } from './components/feedback-bar';
export { ChainOfThought, ChainOfThoughtStep, ChainOfThoughtTrigger, ChainOfThoughtItemContent } from './components/chain-of-thought';
export { Source, SourceTrigger, SourceList } from './components/source';
export { PromptSuggestion } from './components/prompt-suggestion';
export { ScrollButton } from './components/scroll-button';
export { Checkpoint, CheckpointIcon, CheckpointTrigger } from './components/checkpoint';
export { Context } from './components/context';
export { VoiceInput } from './components/voice-input';
export { ConversationList } from './components/conversation-list';
export { ConversationItem } from './components/conversation-item';
export { ModelSwitcher } from './components/model-switcher';
export { ChatScopePicker } from './components/chat-scope-picker';
```

- [x] **Step 2: Verify full package compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat exec tsc --noEmit`
Expected: No errors

- [x] **Step 3: Run all tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test`
Expected: All tests pass

- [x] **Step 4: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export all components from packages/chat"
```

---

## Phase 6: Data Layer & Services (apps/chat)

### Task 25: IndexedDB Schema for Chat

**Files:**
- Create: `apps/chat/src/db.ts`

- [x] **Step 1: Implement chat database schema**

```typescript
// apps/chat/src/db.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentContext, Chunk, Conversation, ConversationGroup } from '@tab-zen/shared';

interface ChatDB {
  documentContexts: {
    key: string;
    value: DocumentContext;
    indexes: { 'by-author': string };
  };
  chunks: {
    key: string;
    value: Chunk;
    indexes: { 'by-documentId': string };
  };
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by-groupId': string;
      'by-updatedAt': string;
      'by-scope-type': string;
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
      // Document contexts
      const docStore = db.createObjectStore('documentContexts', { keyPath: 'documentId' });
      docStore.createIndex('by-author', 'author');

      // Chunks
      const chunkStore = db.createObjectStore('chunks', { keyPath: 'chunkId' });
      chunkStore.createIndex('by-documentId', 'documentId');

      // Conversations
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by-groupId', 'groupId');
      convStore.createIndex('by-updatedAt', 'updatedAt');
      convStore.createIndex('by-scope-type', 'scope.type');

      // Conversation groups
      const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
      groupStore.createIndex('by-sortOrder', 'sortOrder');
    },
  });

  return dbInstance;
}
```

- [x] **Step 2: Commit**

```bash
git add apps/chat/src/db.ts
git commit -m "feat(chat-app): add IndexedDB schema for chat data (documents, chunks, conversations)"
```

---

### Task 26: OpenRouter Service

**Files:**
- Create: `apps/chat/src/services/openrouter.ts`

- [x] **Step 1: Implement OpenRouter service**

Reference: `apps/extension/lib/ai.ts` for the fetch pattern.

```typescript
// apps/chat/src/services/openrouter.ts

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamChatCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
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
      messages,
      stream: true,
      temperature: 0.7,
    }),
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
        // Skip malformed chunks
      }
    }
  }
}

export async function generateEmbedding(
  apiKey: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}
```

- [x] **Step 2: Commit**

```bash
git add apps/chat/src/services/openrouter.ts
git commit -m "feat(chat-app): add OpenRouter service with streaming chat and embeddings"
```

---

### Task 27: Chunking Service

**Files:**
- Create: `apps/chat/src/services/chunking.ts`
- Create: `apps/chat/tests/services/chunking.test.ts`

- [x] **Step 1: Write the test**

```typescript
// apps/chat/tests/services/chunking.test.ts
import { describe, it, expect } from 'vitest';
import { chunkTranscript, chunkMarkdown, generateDocumentContext } from '../src/services/chunking';

describe('chunkTranscript', () => {
  it('chunks transcript segments by time window', () => {
    const segments = [
      { start: 0, text: 'Hello everyone' },
      { start: 30, text: 'Today we talk about databases' },
      { start: 60, text: 'First up is Postgres' },
      { start: 120, text: 'Next is SQLite' },
      { start: 180, text: 'And finally Turso' },
      { start: 240, text: 'Thanks for watching' },
    ];
    const chunks = chunkTranscript(segments, { windowSeconds: 120 });
    expect(chunks.length).toBe(3);
    expect(chunks[0].text).toContain('Hello everyone');
    expect(chunks[0].text).toContain('First up is Postgres');
    expect(chunks[0].metadata.timestampStart).toBe('0:00');
  });
});

describe('chunkMarkdown', () => {
  it('chunks by headings', () => {
    const markdown = `# Introduction
Some intro text here.

## Section One
Content of section one with some details.

## Section Two
Content of section two with more details.`;

    const chunks = chunkMarkdown(markdown);
    expect(chunks.length).toBe(3);
    expect(chunks[0].metadata.sectionHeading).toBe('Introduction');
    expect(chunks[1].metadata.sectionHeading).toBe('Section One');
  });
});

describe('generateDocumentContext', () => {
  it('creates context from page metadata', () => {
    const ctx = generateDocumentContext({
      documentId: 'page-1',
      title: 'Test Video',
      url: 'https://youtube.com/watch?v=123',
      author: 'TechChannel',
      capturedAt: '2026-04-10',
      contentType: 'transcript',
      fullContent: 'Hello everyone, today we talk about databases and their uses in modern development.',
    });
    expect(ctx.title).toBe('Test Video');
    expect(ctx.framingContent.length).toBeGreaterThan(0);
    expect(ctx.framingContent.length).toBeLessThanOrEqual(500);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app test`
Expected: FAIL

- [x] **Step 3: Implement chunking service**

```typescript
// apps/chat/src/services/chunking.ts
import type { DocumentContext, ChunkMetadata } from '@tab-zen/shared';

interface TranscriptSegment {
  start: number;
  text: string;
}

interface ChunkOptions {
  windowSeconds?: number;
}

interface RawChunk {
  text: string;
  position: number;
  metadata: ChunkMetadata;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function chunkTranscript(
  segments: TranscriptSegment[],
  options: ChunkOptions = {}
): RawChunk[] {
  const windowSeconds = options.windowSeconds ?? 120;
  const chunks: RawChunk[] = [];
  let currentChunk: TranscriptSegment[] = [];
  let windowStart = 0;
  let position = 0;

  for (const segment of segments) {
    if (segment.start - windowStart >= windowSeconds && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.map((s) => s.text).join(' '),
        position,
        metadata: {
          timestampStart: formatTimestamp(windowStart),
          timestampEnd: formatTimestamp(currentChunk[currentChunk.length - 1].start),
        },
      });
      position++;
      windowStart = segment.start;
      currentChunk = [];
    }
    currentChunk.push(segment);
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.map((s) => s.text).join(' '),
      position,
      metadata: {
        timestampStart: formatTimestamp(windowStart),
        timestampEnd: formatTimestamp(currentChunk[currentChunk.length - 1].start),
      },
    });
  }

  return chunks;
}

export function chunkMarkdown(markdown: string): RawChunk[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const sections: { heading: string; content: string; start: number }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].content = markdown
        .slice(sections[sections.length - 1].start, match.index)
        .trim();
    }
    sections.push({
      heading: match[2],
      content: '',
      start: match.index + match[0].length,
    });
  }

  if (sections.length > 0) {
    sections[sections.length - 1].content = markdown
      .slice(sections[sections.length - 1].start)
      .trim();
  }

  if (sections.length === 0) {
    // No headings — chunk by paragraphs
    const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim());
    const chunkSize = 3;
    const chunks: RawChunk[] = [];
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      chunks.push({
        text: paragraphs.slice(i, i + chunkSize).join('\n\n'),
        position: chunks.length,
        metadata: {},
      });
    }
    return chunks;
  }

  return sections.map((section, i) => ({
    text: `${section.heading}\n\n${section.content}`,
    position: i,
    metadata: { sectionHeading: section.heading },
  }));
}

interface DocumentContextInput {
  documentId: string;
  title: string;
  url: string;
  author?: string;
  capturedAt: string;
  contentType: 'transcript' | 'markdown';
  fullContent: string;
}

export function generateDocumentContext(input: DocumentContextInput): DocumentContext {
  // Extract framing content: first ~500 chars
  const framingContent = input.fullContent.slice(0, 500).trim();

  return {
    documentId: input.documentId,
    title: input.title,
    url: input.url,
    author: input.author,
    capturedAt: input.capturedAt,
    contentType: input.contentType,
    framingContent,
  };
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/chat/src/services/chunking.ts apps/chat/tests/services/chunking.test.ts
git commit -m "feat(chat-app): add chunking service for transcripts and markdown"
```

---

### Task 28: Vector Store Service

**Files:**
- Create: `apps/chat/src/services/vector-store.ts`
- Create: `apps/chat/tests/services/vector-store.test.ts`

- [x] **Step 1: Write the test**

```typescript
// apps/chat/tests/services/vector-store.test.ts
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, findTopK } from '../src/services/vector-store';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
});

describe('findTopK', () => {
  it('returns top K results sorted by score', () => {
    const query = [1, 0, 0];
    const entries = [
      { id: 'a', embedding: [1, 0, 0] },      // score 1.0
      { id: 'b', embedding: [0, 1, 0] },      // score 0.0
      { id: 'c', embedding: [0.7, 0.7, 0] },  // score ~0.71
    ];
    const results = findTopK(query, entries, 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('a');
    expect(results[1].id).toBe('c');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app test`
Expected: FAIL

- [x] **Step 3: Implement vector store**

```typescript
// apps/chat/src/services/vector-store.ts

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

interface EmbeddingEntry {
  id: string;
  embedding: number[];
}

interface ScoredEntry {
  id: string;
  score: number;
}

export function findTopK(
  query: number[],
  entries: EmbeddingEntry[],
  k: number
): ScoredEntry[] {
  const scored = entries.map((entry) => ({
    id: entry.id,
    score: cosineSimilarity(query, entry.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
```

- [x] **Step 4: Run tests**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/chat/src/services/vector-store.ts apps/chat/tests/services/vector-store.test.ts
git commit -m "feat(chat-app): add vector store with cosine similarity search"
```

---

### Task 29: Voice Transcription Service

**Files:**
- Create: `apps/chat/src/services/voice.ts`

- [x] **Step 1: Implement GROQ voice service**

```typescript
// apps/chat/src/services/voice.ts

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(
  apiKey: string,
  audioBlob: Blob,
  model: string = 'whisper-large-v3'
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', model);
  formData.append('response_format', 'text');

  const response = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GROQ transcription error (${response.status}): ${error}`);
  }

  return response.text();
}
```

- [x] **Step 2: Commit**

```bash
git add apps/chat/src/services/voice.ts
git commit -m "feat(chat-app): add GROQ Whisper voice transcription service"
```

---

### Task 30: Local Adapter

**Files:**
- Create: `apps/chat/src/adapters/local-adapter.ts`

- [x] **Step 1: Implement LocalAdapter**

```typescript
// apps/chat/src/adapters/local-adapter.ts
import type {
  ChatDataAdapter,
  DocumentContext,
  Chunk,
  ChunkResult,
  Conversation,
  ConversationSummary,
  SearchFilters,
} from '@tab-zen/shared';
import { getChatDB } from '../db';
import { cosineSimilarity } from '../services/vector-store';
import { generateEmbedding as generateEmbeddingApi } from '../services/openrouter';

interface LocalAdapterConfig {
  openRouterApiKey: string;
  embeddingModel: string;
}

export class LocalAdapter implements ChatDataAdapter {
  private config: LocalAdapterConfig;

  constructor(config: LocalAdapterConfig) {
    this.config = config;
  }

  async storeDocumentContext(context: DocumentContext): Promise<void> {
    const db = await getChatDB();
    await db.put('documentContexts', context);
  }

  async storeChunks(documentId: string, chunks: Chunk[]): Promise<void> {
    const db = await getChatDB();
    const tx = db.transaction('chunks', 'readwrite');
    for (const chunk of chunks) {
      await tx.store.put(chunk);
    }
    await tx.done;
  }

  async searchSimilar(
    embedding: number[],
    topK: number,
    filters?: SearchFilters
  ): Promise<ChunkResult[]> {
    const db = await getChatDB();

    // Get all chunks
    let chunks = await db.getAll('chunks');

    // Apply filters by loading contexts
    if (filters) {
      const contextMap = new Map<string, DocumentContext>();
      const contexts = await db.getAll('documentContexts');
      for (const ctx of contexts) {
        contextMap.set(ctx.documentId, ctx);
      }

      chunks = chunks.filter((chunk) => {
        const ctx = contextMap.get(chunk.documentId);
        if (!ctx) return false;
        if (filters.authors?.length && (!ctx.author || !filters.authors.includes(ctx.author))) {
          return false;
        }
        if (filters.contentType && ctx.contentType !== filters.contentType) {
          return false;
        }
        return true;
      });
    }

    // Score and rank
    const scored = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(embedding, chunk.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);

    // Join with document contexts
    const results: ChunkResult[] = [];
    for (const { chunk, score } of topChunks) {
      const context = await db.get('documentContexts', chunk.documentId);
      if (context) {
        results.push({ chunk, context, score });
      }
    }

    return results;
  }

  async getDocumentContext(documentId: string): Promise<DocumentContext> {
    const db = await getChatDB();
    const ctx = await db.get('documentContexts', documentId);
    if (!ctx) throw new Error(`Document context not found: ${documentId}`);
    return ctx;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getChatDB();
    await db.put('conversations', conversation);
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
    return conv;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const db = await getChatDB();
    const conversations = await db.getAll('conversations');
    return conversations
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

  async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbeddingApi(
      this.config.openRouterApiKey,
      this.config.embeddingModel,
      text
    );
  }
}
```

- [x] **Step 2: Commit**

```bash
git add apps/chat/src/adapters/local-adapter.ts
git commit -m "feat(chat-app): add LocalAdapter implementing ChatDataAdapter with IndexedDB"
```

---

## Phase 7: App Shell & Integration

### Task 31: Chat Store

**Files:**
- Create: `apps/chat/src/stores/chat-store.ts`

- [x] **Step 1: Implement chat store**

```typescript
// apps/chat/src/stores/chat-store.ts
import { createSignal, createResource } from 'solid-js';
import type {
  ChatDataAdapter,
  Conversation,
  ConversationSummary,
  ConversationGroup,
  ConversationScope,
  ChatMessage,
  SearchFilters,
} from '@tab-zen/shared';

export function createChatStore(adapter: ChatDataAdapter) {
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [conversationListKey, setConversationListKey] = createSignal(0);

  const [conversations] = createResource(conversationListKey, () => adapter.listConversations());
  const [activeConversation, { refetch: refetchActive }] = createResource(
    activeConversationId,
    (id) => (id ? adapter.getConversation(id) : undefined)
  );

  // For now, groups are stored locally. Future: persist via adapter.
  const [groups, setGroups] = createSignal<ConversationGroup[]>([]);

  function refreshList() {
    setConversationListKey((k) => k + 1);
  }

  async function createConversation(scope: ConversationScope): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      title: 'New chat',
      scope,
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
      title: conv.messages.length === 0 ? message.content.slice(0, 50) : conv.title,
      updatedAt: new Date().toISOString(),
    };
    await adapter.saveConversation(updated);
    refetchActive();
    refreshList();
  }

  async function deleteConversation(id: string) {
    await adapter.deleteConversation(id);
    if (activeConversationId() === id) {
      setActiveConversationId(null);
    }
    refreshList();
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    groups,
    setGroups,
    createConversation,
    addMessage,
    deleteConversation,
    selectConversation,
    refreshList,
  };
}
```

- [x] **Step 2: Commit**

```bash
git add apps/chat/src/stores/chat-store.ts
git commit -m "feat(chat-app): add reactive chat store with conversation management"
```

---

### Task 32: Wire Up App Shell

**Files:**
- Modify: `apps/chat/src/App.tsx`

- [x] **Step 1: Implement the full App layout**

```tsx
// apps/chat/src/App.tsx
import { type Component, createSignal, Show, For, createMemo } from 'solid-js';
import {
  ChatContainer,
  ConversationList,
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
  PromptInput,
  ScrollButton,
  Loader,
  PromptSuggestion,
  FeedbackBar,
  Source,
  SourceList,
  ModelSwitcher,
  VoiceInput,
  Context,
} from '@tab-zen/chat';
import type { ChatMessage, ConversationScope, ModelOption } from '@tab-zen/shared';
import { LocalAdapter } from './adapters/local-adapter';
import { createChatStore } from './stores/chat-store';
import { streamChatCompletion } from './services/openrouter';
import { transcribeAudio } from './services/voice';
import { Copy, RefreshCw } from 'lucide-solid';

// Config — in a real app these come from settings
const API_KEY = ''; // User enters this
const CHAT_MODEL = 'openai/gpt-4o-mini';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const GROQ_API_KEY = ''; // Optional

const MODELS: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
];

const App: Component = () => {
  const adapter = new LocalAdapter({
    openRouterApiKey: API_KEY,
    embeddingModel: EMBEDDING_MODEL,
  });

  const store = createChatStore(adapter);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [currentModel, setCurrentModel] = createSignal(CHAT_MODEL);
  const [streamingContent, setStreamingContent] = createSignal('');

  async function handleSendMessage(text: string) {
    if (!API_KEY) {
      alert('Please set your OpenRouter API key');
      return;
    }

    // Create conversation if none active
    if (!store.activeConversationId()) {
      await store.createConversation({ type: 'collection' });
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    await store.addMessage(userMessage);

    // Stream assistant response
    setIsStreaming(true);
    setStreamingContent('');

    const conv = store.activeConversation();
    if (!conv) return;

    const messages = conv.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      let fullContent = '';
      for await (const chunk of streamChatCompletion(API_KEY, currentModel(), [
        { role: 'system', content: 'You are a helpful assistant. Answer questions based on the user\'s saved content.' },
        ...messages,
      ])) {
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
      await store.addMessage(assistantMessage);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }

  async function handleVoiceTranscribe(audio: Blob): Promise<string> {
    if (!GROQ_API_KEY) throw new Error('GROQ API key not configured');
    return transcribeAudio(GROQ_API_KEY, audio);
  }

  const suggestions = [
    'What videos mention React?',
    'Summarize recent saves',
    'Topics from this week',
  ];

  return (
    <div class="flex h-screen w-screen bg-background text-foreground">
      {/* Sidebar */}
      <Show when={sidebarOpen()}>
        <div class="w-[270px] flex-shrink-0">
          <ConversationList
            groups={store.groups()}
            conversations={store.conversations() ?? []}
            activeId={store.activeConversationId() ?? undefined}
            onSelect={store.selectConversation}
            onNewChat={() => store.createConversation({ type: 'collection' })}
            onToggleSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </Show>

      {/* Collapsed sidebar */}
      <Show when={!sidebarOpen()}>
        <div class="w-12 bg-sidebar flex flex-col items-center py-3 gap-2 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            class="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            &#9776;
          </button>
        </div>
      </Show>

      {/* Main chat area */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div class="px-5 py-3 bg-muted/30 flex items-center justify-between">
          <div>
            <h1 class="text-[15px] font-medium">
              {store.activeConversation()?.title ?? 'New Chat'}
            </h1>
            <p class="text-xs text-muted-foreground">Searching all content</p>
          </div>
          <div class="flex items-center gap-2">
            <ModelSwitcher
              models={MODELS}
              currentModelId={currentModel()}
              onModelChange={setCurrentModel}
            />
          </div>
        </div>

        {/* Messages */}
        <ChatContainer class="flex-1 px-5 py-4">
          <div class="max-w-[760px] mx-auto w-full space-y-4">
            <Show
              when={store.activeConversation()?.messages.length}
              fallback={
                <div class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Start a conversation
                </div>
              }
            >
              <For each={store.activeConversation()?.messages}>
                {(msg) => (
                  <Message role={msg.role}>
                    <Show when={msg.role === 'assistant'}>
                      <MessageAvatar fallback="AI" />
                    </Show>
                    <MessageContent>
                      {msg.content}
                    </MessageContent>
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

        {/* Input area */}
        <div class="px-5 pb-4 pt-2">
          <div class="max-w-[760px] mx-auto">
            <PromptInput
              placeholder="Ask about your saved content..."
              onSubmit={handleSendMessage}
              isLoading={isStreaming()}
              actions={
                <Show when={!!GROQ_API_KEY}>
                  <VoiceInput
                    onTranscribe={handleVoiceTranscribe}
                    onTranscription={(text) => {
                      // Insert into prompt - for now just send directly
                      handleSendMessage(text);
                    }}
                  />
                </Show>
              }
            />
            <Show when={!store.activeConversation()?.messages.length}>
              <div class="flex gap-2 mt-2 justify-center">
                <For each={suggestions}>
                  {(suggestion) => (
                    <PromptSuggestion
                      text={suggestion}
                      onClick={() => handleSendMessage(suggestion)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
```

- [x] **Step 2: Verify the app runs**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app dev`
Expected: App opens in browser with sidebar, chat area, input. Test by entering a message (will need API key set in the code to actually work with OpenRouter).

- [x] **Step 3: Commit**

```bash
git add apps/chat/src/App.tsx
git commit -m "feat(chat-app): wire up full chat app shell with sidebar, streaming, and conversation management"
```

---

### Task 33: Add Vitest Config for apps/chat

**Files:**
- Create: `apps/chat/vitest.config.ts`

- [x] **Step 1: Create vitest config**

```typescript
// apps/chat/vitest.config.ts
import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tab-zen/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@tab-zen/chat': path.resolve(__dirname, '../../packages/chat/src/index.ts'),
    },
  },
});
```

- [x] **Step 2: Run all tests across both packages**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test && pnpm --filter @tab-zen/chat-app test`
Expected: All tests pass

- [x] **Step 3: Commit**

```bash
git add apps/chat/vitest.config.ts
git commit -m "feat(chat-app): add vitest configuration"
```

---

### Task 34: Final Integration Test

- [x] **Step 1: Verify full dev server runs**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat-app dev`

Verify:
- Sidebar renders with "Chats" header, search bar, new chat button
- Sidebar toggle collapses/expands
- Main area shows "Start a conversation"
- Input area has textarea, send button
- Prompt suggestions appear below input
- Typing a message and pressing Enter adds it to the chat
- Styling matches dark mode theme tokens

- [x] **Step 2: Verify TypeScript across entire monorepo**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/shared exec tsc --noEmit && pnpm --filter @tab-zen/chat exec tsc --noEmit`
Expected: No errors

- [x] **Step 3: Run full test suite**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter @tab-zen/chat test && pnpm --filter @tab-zen/chat-app test`
Expected: All tests pass

- [x] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete M8 knowledge base & chat foundation

- packages/chat: 19 AI/feature components, 11 UI primitives, 4 headless hooks
- apps/chat: standalone dev app with OpenRouter streaming, IndexedDB storage
- Shared types: ChatDataAdapter interface, document/chunk/conversation model
- Three-layer architecture: headless → styled → feature components
- Conversation management with groups, search, model switching"
```
