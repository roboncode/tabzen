# Unified Content View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tab-based detail page with a unified content view and add web page content extraction as markdown for non-YouTube pages.

**Architecture:** Content extraction uses `browser.scripting.executeScript()` to inject Mozilla Readability into pages on capture, returning clean HTML which Turndown converts to markdown in the background script. The detail page removes pill tabs in favor of a single content area that renders TranscriptView for YouTube or MarkdownView for articles, with a scroll-reveal compact header restored.

**Tech Stack:** SolidJS, WXT, @mozilla/readability, turndown, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/types.ts` | Modify | Add `transcript?`, `content?` fields; narrow `contentType` |
| `apps/extension/lib/page-extract.ts` | Create | Readability injection + Turndown conversion |
| `apps/extension/lib/messages.ts` | Modify | Add `GET_CONTENT` message type + response |
| `apps/extension/entrypoints/background.ts` | Modify | Hook extraction into capture flows + add `GET_CONTENT` handler |
| `apps/extension/components/detail/MarkdownView.tsx` | Create | Renders markdown as styled HTML |
| `apps/extension/components/detail/DetailPage.tsx` | Modify | Remove pills, add unified ContentView, restore scroll-reveal |
| `apps/extension/components/detail/DetailHeader.tsx` | Modify | Add compact mode, remove children prop |
| `apps/extension/components/detail/PlaceholderTab.tsx` | Delete | No longer needed |
| `apps/extension/wxt.config.ts` | Modify | Add `<all_urls>` host permission |
| `apps/extension/package.json` | Modify | Add readability + turndown deps |
| `apps/extension/tests/page-extract.test.ts` | Create | Unit tests for extraction utility |

---

### Task 1: Install Dependencies and Update Config

**Files:**
- Modify: `apps/extension/package.json`
- Modify: `apps/extension/wxt.config.ts`

- [ ] **Step 1: Install @mozilla/readability, turndown, and types**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm add -F extension @mozilla/readability turndown && pnpm add -D -F extension @types/turndown
```

- [ ] **Step 2: Add `<all_urls>` host permission**

In `apps/extension/wxt.config.ts`, update the `host_permissions` array:

```typescript
host_permissions: [
  "*://*.youtube.com/*",
  "<all_urls>",
],
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/package.json apps/extension/wxt.config.ts pnpm-lock.yaml
git commit -m "chore: add readability + turndown deps, expand host permissions"
```

---

### Task 2: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add typed fields to Tab interface**

In `packages/shared/src/types.ts`, update the `Tab` interface. Replace:

```typescript
contentType: string | null;
```

with:

```typescript
contentType: "transcript" | "markdown" | null;
```

Add these two optional fields after `contentFetchedAt`:

```typescript
contentFetchedAt: string | null;
transcript?: TranscriptSegment[];
content?: string;
```

- [ ] **Step 2: Verify compilation**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run compile
```

Expected: Build succeeds. There will be errors from `background.ts` where `(tab as any).transcript` is used — those get cleaned up in Task 5.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add typed transcript and content fields to Tab interface"
```

---

### Task 3: Create Page Extraction Module

**Files:**
- Create: `apps/extension/lib/page-extract.ts`
- Create: `apps/extension/tests/page-extract.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/extension/tests/page-extract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { htmlToMarkdown, shouldExtractContent } from "@/lib/page-extract";

describe("shouldExtractContent", () => {
  it("returns true for article URLs", () => {
    expect(shouldExtractContent("https://css-tricks.com/container-queries/")).toBe(true);
    expect(shouldExtractContent("https://blog.example.com/post/123")).toBe(true);
  });

  it("returns false for YouTube URLs", () => {
    expect(shouldExtractContent("https://www.youtube.com/watch?v=abc123")).toBe(false);
    expect(shouldExtractContent("https://youtu.be/abc123")).toBe(false);
    expect(shouldExtractContent("https://www.youtube.com/shorts/abc123")).toBe(false);
  });

  it("returns false for non-http protocols", () => {
    expect(shouldExtractContent("chrome://extensions")).toBe(false);
    expect(shouldExtractContent("chrome-extension://abc/page.html")).toBe(false);
    expect(shouldExtractContent("about:blank")).toBe(false);
  });

  it("returns false for file-like URLs without articles", () => {
    expect(shouldExtractContent("https://example.com/image.png")).toBe(true); // we still try — Readability returns null for non-articles
  });
});

describe("htmlToMarkdown", () => {
  it("converts simple HTML to markdown", () => {
    const html = "<h1>Title</h1><p>Hello <strong>world</strong></p>";
    const md = htmlToMarkdown(html);
    expect(md).toContain("# Title");
    expect(md).toContain("**world**");
  });

  it("converts code blocks", () => {
    const html = "<pre><code>const x = 1;</code></pre>";
    const md = htmlToMarkdown(html);
    expect(md).toContain("const x = 1;");
  });

  it("converts links", () => {
    const html = '<p>Visit <a href="https://example.com">Example</a></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("[Example](https://example.com)");
  });

  it("handles empty input", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run test -- tests/page-extract.test.ts
```

Expected: FAIL — `@/lib/page-extract` module not found.

- [ ] **Step 3: Create the page-extract module**

Create `apps/extension/lib/page-extract.ts`:

```typescript
import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";

export interface PageExtractResult {
  title: string;
  byline: string | null;
  content: string;        // markdown
  excerpt: string | null;
  siteName: string | null;
}

/**
 * Whether we should attempt content extraction for this URL.
 * Returns false for YouTube (handled by transcript extraction),
 * non-http protocols, and chrome-internal pages.
 */
export function shouldExtractContent(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  } catch {
    return false;
  }
  if (isYouTubeWatchUrl(url)) return false;
  return true;
}

/** Convert HTML string to markdown using Turndown. Runs in background script. */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return td.turndown(html);
}

/**
 * Injected function — runs inside the target page via executeScript.
 * MUST be fully self-contained (no imports, no outer-scope references).
 * Uses Mozilla Readability which is bundled by the build tool.
 */
function runReadabilityOnPage(): {
  title: string;
  byline: string | null;
  content: string;
  excerpt: string | null;
  siteName: string | null;
} | null {
  try {
    // @ts-expect-error — Readability is imported separately via executeScript files param
    const { Readability } = globalThis.__readability__;
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article || !article.content) return null;
    return {
      title: article.title,
      byline: article.byline,
      content: article.content,
      excerpt: article.excerpt,
      siteName: article.siteName,
    };
  } catch {
    return null;
  }
}

/**
 * Extract content from a browser tab using Readability + Turndown.
 * Injects Readability into the page, gets clean HTML, converts to markdown.
 */
export async function extractPageContent(
  browserTabId: number,
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    // First, inject Readability library into the page
    await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: (readabilityCode: string) => {
        // Create a module-like namespace for Readability
        const module = { exports: {} as any };
        const fn = new Function("module", "exports", readabilityCode);
        fn(module, module.exports);
        (globalThis as any).__readability__ = { Readability: module.exports.Readability || module.exports };
      },
      args: [await getReadabilitySource()],
    });

    // Then run the extraction
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: runReadabilityOnPage,
    });

    const articleData = results?.[0]?.result;
    if (!articleData || !articleData.content) return null;

    // Convert HTML to markdown in the background script
    const markdown = htmlToMarkdown(articleData.content);
    if (!markdown.trim()) return null;

    return {
      title: articleData.title,
      byline: articleData.byline,
      content: markdown,
      excerpt: articleData.excerpt,
      siteName: articleData.siteName,
    };
  } catch (e) {
    console.warn("[TabZen] Page content extraction failed:", e);
    return null;
  }
}

/** Cache the Readability source code so we don't re-read it on every extraction */
let readabilitySourceCache: string | null = null;

async function getReadabilitySource(): Promise<string> {
  if (readabilitySourceCache) return readabilitySourceCache;
  // Fetch the Readability.js source from the extension's bundled assets
  const url = browser.runtime.getURL("readability.js");
  const response = await fetch(url);
  readabilitySourceCache = await response.text();
  return readabilitySourceCache;
}
```

**Important note for the implementer:** The Readability injection approach above requires bundling `Readability.js` as a web-accessible resource. An alternative approach that avoids this complexity: use `browser.scripting.executeScript` with `world: "MAIN"` and inline the Readability extraction logic directly — since Readability's core algorithm is relatively simple (parse DOM, score nodes, extract best candidate). However, the library approach is more robust.

For WXT, the simplest path is to resolve the Readability source at build time. If the injection approach proves problematic, a simpler fallback: have the injected function just serialize `document.documentElement.innerHTML` back to the background script, then run Readability in the background with a DOM parser like `linkedom` or `happy-dom` (already in devDependencies). Choose whichever approach works during implementation.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run test -- tests/page-extract.test.ts
```

Expected: The `shouldExtractContent` and `htmlToMarkdown` tests PASS. The `extractPageContent` function can't be unit-tested (requires browser APIs) — it's integration-tested manually.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/page-extract.ts apps/extension/tests/page-extract.test.ts
git commit -m "feat: add page content extraction module with Readability + Turndown"
```

---

### Task 4: Add GET_CONTENT Message Type

**Files:**
- Modify: `apps/extension/lib/messages.ts`

- [ ] **Step 1: Add GET_CONTENT to MessageRequest and CONTENT to MessageResponse**

In `apps/extension/lib/messages.ts`, add to the `MessageRequest` union:

```typescript
| { type: "GET_CONTENT"; tabId: string }
```

Add to the `MessageResponse` union:

```typescript
| { type: "CONTENT"; content: string | null }
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/lib/messages.ts
git commit -m "feat: add GET_CONTENT message type"
```

---

### Task 5: Hook Extraction into Background Script

**Files:**
- Modify: `apps/extension/entrypoints/background.ts`

This task has three parts: (A) add the `GET_CONTENT` handler, (B) hook extraction into `buildCapturePreview`, (C) hook into `captureSingleTab`, (D) hook into `handleQuickCapture`. Also clean up `as any` transcript casts now that the type is formalized.

- [ ] **Step 1: Add GET_CONTENT case to the message switch**

In `handleMessage()` (around line 299), add before the `default` case:

```typescript
case "GET_CONTENT":
  return handleGetContent(message.tabId);
```

- [ ] **Step 2: Add the handleGetContent function**

Add after `handleGetTranscript` (after line 513):

```typescript
async function handleGetContent(tabId: string): Promise<MessageResponse> {
  const tab = await getTab(tabId);
  if (!tab) return { type: "ERROR", message: "Tab not found" };

  // 1. Check if content is already stored locally
  if (tab.content) {
    return { type: "CONTENT", content: tab.content };
  }

  // 2. Try extracting from open browser tab
  const openTabs = await browser.tabs.query({ url: tab.url });
  if (openTabs.length > 0 && openTabs[0].id) {
    try {
      const { extractPageContent } = await import("@/lib/page-extract");
      const result = await extractPageContent(openTabs[0].id, tab.url);
      if (result) {
        await addTab({
          ...tab,
          content: result.content,
          contentKey: `content/${tab.id}`,
          contentType: "markdown",
          contentFetchedAt: new Date().toISOString(),
        });
        notifyDataChanged();
        return { type: "CONTENT", content: result.content };
      }
    } catch (e) {
      console.warn("[TabZen] Page content extraction failed:", e);
    }
  }

  return { type: "CONTENT", content: null };
}
```

- [ ] **Step 3: Hook extraction into buildCapturePreview**

In `buildCapturePreview()` (around line 978), after the YouTube transcript extraction block (after the `if (isYouTubeWatchUrl(bt.url!))` block ending around line 995), add an else branch for non-YouTube extraction:

```typescript
// Extract transcript for YouTube videos (best-effort per tab)
let transcriptSegments: TranscriptSegment[] | null = null;
let markdownContent: string | null = null;

if (isYouTubeWatchUrl(bt.url!)) {
  try {
    const { extractYouTubeTranscript } = await import("@/lib/youtube-extract");
    const result = await extractYouTubeTranscript(bt.id!, bt.url!);
    if (result?.hasTranscript) {
      transcriptSegments = result.segments;
    }
  } catch (e) {
    console.warn("[TabZen] Transcript extraction failed:", e);
  }
} else {
  try {
    const { extractPageContent } = await import("@/lib/page-extract");
    const result = await extractPageContent(bt.id!, bt.url!);
    if (result) {
      markdownContent = result.content;
    }
  } catch (e) {
    console.warn("[TabZen] Page content extraction failed:", e);
  }
}

const hasTranscript = transcriptSegments && transcriptSegments.length > 0;
const hasContent = !!markdownContent;
```

Update the tab object construction to include content:

```typescript
const tab: Tab = {
  // ... all existing fields ...
  contentKey: hasTranscript ? `transcripts/${tabId}` : hasContent ? `content/${tabId}` : null,
  contentType: hasTranscript ? "transcript" : hasContent ? "markdown" : null,
  contentFetchedAt: (hasTranscript || hasContent) ? new Date().toISOString() : null,
  transcript: hasTranscript ? transcriptSegments! : undefined,
  content: hasContent ? markdownContent! : undefined,
};
```

Remove the old `(tab as any).transcript = transcriptSegments` line and the `as any` cast on the tab type.

- [ ] **Step 4: Hook extraction into captureSingleTab**

In `captureSingleTab()` (around line 1182), apply the same pattern. After the YouTube extraction block, add an else branch:

```typescript
let transcriptSegments: TranscriptSegment[] | null = null;
let markdownContent: string | null = null;

if (isYouTubeWatchUrl(url)) {
  try {
    const { extractYouTubeTranscript } = await import("@/lib/youtube-extract");
    const result = await extractYouTubeTranscript(browserTabId, url);
    if (result?.hasTranscript) {
      transcriptSegments = result.segments;
    }
  } catch (e) {
    console.warn("[TabZen] captureSingleTab - Transcript extraction failed:", e);
  }
} else {
  try {
    const { extractPageContent } = await import("@/lib/page-extract");
    const result = await extractPageContent(browserTabId, url);
    if (result) {
      markdownContent = result.content;
    }
  } catch (e) {
    console.warn("[TabZen] captureSingleTab - Page content extraction failed:", e);
  }
}

const hasTranscript = transcriptSegments && transcriptSegments.length > 0;
const hasContent = !!markdownContent;
```

Update the tab construction similarly, using typed fields instead of `as any`.

- [ ] **Step 5: Hook extraction into handleQuickCapture background enrichment**

In `handleQuickCapture()` Pass 2 (around line 731), after the YouTube transcript enrichment block, add content extraction for non-YouTube tabs:

```typescript
// Extract content for non-YouTube pages
if (!isYouTubeWatchUrl(tab.url)) {
  try {
    const { extractPageContent } = await import("@/lib/page-extract");
    const result = await extractPageContent(browserTab.id, tab.url);
    if (result) {
      const currentTab = await getTab(tab.id);
      if (currentTab) {
        await addTab({
          ...currentTab,
          content: result.content,
          contentKey: `content/${tab.id}`,
          contentType: "markdown",
          contentFetchedAt: new Date().toISOString(),
        });
        console.log(`[TabZen] Content extracted for ${tab.url} (${result.content.length} chars)`);
      }
    }
  } catch (e) {
    console.warn("[TabZen] Content extraction failed for", tab.url, e);
  }
}
```

- [ ] **Step 6: Clean up handleGetTranscript to use typed field**

In `handleGetTranscript()` (line 458), replace `(tab as any).transcript` with `tab.transcript` and remove the `as any` casts:

```typescript
// 1. Check if transcript is already stored locally on the tab record
if (tab.transcript) {
  return { type: "TRANSCRIPT", transcript: tab.transcript };
}
```

And in the storage lines, use the typed field:

```typescript
tab.transcript = result.segments;
await addTab({
  ...tab,
  contentKey: `transcripts/${tab.id}`,
  contentType: "transcript",
  contentFetchedAt: new Date().toISOString(),
});
```

- [ ] **Step 7: Verify compilation**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run compile
```

Expected: PASS with no type errors.

- [ ] **Step 8: Run existing tests**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run test
```

Expected: All existing tests continue to pass.

- [ ] **Step 9: Commit**

```bash
git add apps/extension/entrypoints/background.ts apps/extension/lib/messages.ts
git commit -m "feat: hook page content extraction into capture flows and add GET_CONTENT handler"
```

---

### Task 6: Create MarkdownView Component

**Files:**
- Create: `apps/extension/components/detail/MarkdownView.tsx`

- [ ] **Step 1: Create the MarkdownView component**

Create `apps/extension/components/detail/MarkdownView.tsx`:

```tsx
import { createMemo, Show } from "solid-js";
import { FileText } from "lucide-solid";

interface MarkdownViewProps {
  content: string;
  onFetchContent?: () => void;
  loading?: boolean;
}

/**
 * Renders extracted markdown content as styled HTML.
 * Matches the reading experience of TranscriptView.
 */
export default function MarkdownView(props: MarkdownViewProps) {
  const htmlContent = createMemo(() => renderMarkdown(props.content));

  return (
    <div>
      <Show
        when={props.content}
        fallback={
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No content available</p>
            <Show when={props.onFetchContent}>
              <button
                onClick={props.onFetchContent}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Extracting..." : "Extract Content"}
              </button>
            </Show>
          </div>
        }
      >
        <div class="max-w-3xl mx-auto px-2 pb-12">
          <div
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}

/**
 * Simple markdown to HTML renderer.
 * Handles the subset we get from Turndown: headings, paragraphs, bold, italic,
 * links, code blocks, inline code, lists, images, blockquotes, horizontal rules.
 */
function renderMarkdown(md: string): string {
  if (!md) return "";

  let html = md
    // Escape HTML entities first (prevent XSS from content)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="bg-muted/30 rounded-lg p-4 overflow-x-auto text-sm"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-foreground mt-6 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-foreground mt-8 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-foreground mt-10 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-semibold text-foreground mt-10 mb-4">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-muted/30 my-8" />');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-2 border-muted-foreground/20 pl-4 italic text-muted-foreground">$1</blockquote>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg max-w-full my-4" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-400 hover:underline">$1</a>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted/30 px-1.5 py-0.5 rounded text-sm">$1</code>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="text-sm text-foreground/80 leading-[1.8] ml-4">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-foreground/80 leading-[1.8] ml-4 list-decimal">$1</li>');

  // Paragraphs — wrap remaining lines that aren't already wrapped in tags
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="text-sm text-foreground/80 leading-[1.8]">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="[^"]*"><\/p>/g, "");

  return html;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/components/detail/MarkdownView.tsx
git commit -m "feat: add MarkdownView component for rendered markdown content"
```

---

### Task 7: Unified Detail Page — Remove Pill Tabs, Add ContentView

**Files:**
- Modify: `apps/extension/components/detail/DetailPage.tsx`
- Modify: `apps/extension/components/detail/DetailHeader.tsx`
- Delete: `apps/extension/components/detail/PlaceholderTab.tsx`

- [ ] **Step 1: Update DetailHeader — add compact mode, remove children**

In `apps/extension/components/detail/DetailHeader.tsx`:

Replace the interface:

```typescript
interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onEditNotes: () => void;
  chatCollapsed: boolean;
  onToggleChat: () => void;
  onCopy?: () => void;
  copied?: boolean;
  /** Render only the hero card (no action bar) */
  heroOnly?: boolean;
  /** Show compact title in the action bar when hero has scrolled past */
  compact?: boolean;
  /** Content to render in the center (e.g. tabs) */
  children?: any;
}
```

Replace with:

```typescript
interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onEditNotes: () => void;
  chatCollapsed: boolean;
  onToggleChat: () => void;
  onCopy?: () => void;
  copied?: boolean;
  /** Render only the hero card (no action bar) */
  heroOnly?: boolean;
  /** Show compact title + thumbnail in the action bar */
  compact?: boolean;
}
```

In the action bar section (the return statement starting at line 156), replace the center content area. Find:

```typescript
{/* Center content (tabs) */}
<div class="flex-1 flex justify-center min-w-0">
  {props.children}
</div>
```

Replace with:

```typescript
{/* Compact title — visible when hero scrolled past */}
<Show when={props.compact}>
  <div class="flex items-center gap-2.5 ml-3 flex-1 min-w-0">
    {props.tab.ogImage && (
      <img
        src={props.tab.ogImage}
        alt=""
        class="w-7 h-7 rounded object-cover flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    )}
    <span class="text-sm font-medium text-foreground truncate">
      {title()}
    </span>
  </div>
</Show>
<Show when={!props.compact}>
  <div class="flex-1" />
</Show>
```

- [ ] **Step 2: Rewrite DetailPage — remove pills, add unified content view, restore scroll-reveal**

Replace the entire content of `apps/extension/components/detail/DetailPage.tsx`:

```tsx
import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { formatTimestamp } from "./TranscriptView";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab, softDeleteTab } from "@/lib/db";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import MarkdownView from "./MarkdownView";
import ChatPanel from "./ChatPanel";
import NotesEditor from "@/components/NotesEditor";
import ReadingProgress from "@/components/ReadingProgress";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [chatCollapsed, setChatCollapsed] = createSignal(true);
  const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[]>(
    props.tab.transcript || [],
  );
  const [markdownContent, setMarkdownContent] = createSignal<string>(
    props.tab.content || "",
  );
  const [fetchingContent, setFetchingContent] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);
  const [isNarrow, setIsNarrow] = createSignal(false);
  const [editingNotes, setEditingNotes] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [heroScrolledPast, setHeroScrolledPast] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  let heroRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 768);
      }
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => resizeObserver.disconnect());

    // Listen for data changes from other views
    const handleMessage = async (message: any) => {
      if (message.type === "DATA_CHANGED") {
        const updated = await getTab(props.tab.id);
        if (updated) {
          setCurrentTab(updated);
          if (updated.transcript) {
            setTranscriptSegments(updated.transcript);
          }
          if (updated.content) {
            setMarkdownContent(updated.content);
          }
        }
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    onCleanup(() => browser.runtime.onMessage.removeListener(handleMessage));
  });

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.tab.url));

  const hasContent = createMemo(() =>
    transcriptSegments().length > 0 || markdownContent().length > 0,
  );

  const readingTimeMin = createMemo(() => {
    const segments = transcriptSegments();
    const content = markdownContent();
    let totalWords = 0;

    if (segments.length > 0) {
      totalWords = segments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
    } else if (content) {
      totalWords = content.split(/\s+/).length;
    }

    return Math.max(1, Math.round(totalWords / 200));
  });

  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleBack = () => { window.close(); };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleOpenSource = () => { window.open(props.tab.url, "_blank"); };

  const handleArchive = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { archived: !tab.archived });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleDelete = async () => {
    await softDeleteTab(currentTab().id);
    notifyChanged();
    window.close();
  };

  const handleEditNotes = () => {
    setEditingNotes(true);
  };

  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    const updated = await getTab(tabId);
    if (updated) setCurrentTab(updated);
    setEditingNotes(false);
    notifyChanged();
  };

  const handleFetchContent = async () => {
    setFetchingContent(true);
    try {
      if (isYouTube()) {
        const response = await sendMessage({ type: "GET_TRANSCRIPT", tabId: props.tab.id });
        if (response.type === "TRANSCRIPT" && response.transcript) {
          setTranscriptSegments(response.transcript);
        }
      } else {
        const response = await sendMessage({ type: "GET_CONTENT", tabId: props.tab.id });
        if (response.type === "CONTENT" && response.content) {
          setMarkdownContent(response.content);
        }
      }
    } catch (e) {
      console.error("Failed to fetch content:", e);
    } finally {
      setFetchingContent(false);
    }
  };

  const handleCopy = () => {
    const segments = transcriptSegments();
    const content = markdownContent();

    if (segments.length > 0) {
      const text = segments.map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`).join("\n");
      navigator.clipboard.writeText(text);
    } else if (content) {
      navigator.clipboard.writeText(content);
    } else {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = () => {
    if (!heroRef || !scrollRef) return;
    const heroBottom = heroRef.offsetTop + heroRef.offsetHeight;
    setHeroScrolledPast(scrollRef.scrollTop > heroBottom - 10);
  };

  const ContentView = () => (
    <>
      {/* YouTube: always use TranscriptView (it has its own empty/fetch state) */}
      <Show when={isYouTube()}>
        <TranscriptView
          segments={transcriptSegments()}
          videoUrl={props.tab.url}
          onFetchTranscript={transcriptSegments().length === 0 ? handleFetchContent : undefined}
          loading={fetchingContent()}
        />
      </Show>
      {/* Non-YouTube with content: render markdown */}
      <Show when={!isYouTube() && markdownContent()}>
        <MarkdownView content={markdownContent()} />
      </Show>
      {/* Non-YouTube without content: show extract button */}
      <Show when={!isYouTube() && !markdownContent()}>
        <MarkdownView
          content=""
          onFetchContent={handleFetchContent}
          loading={fetchingContent()}
        />
      </Show>
    </>
  );

  return (
    <div ref={containerRef} class="flex h-screen bg-background relative">
      {/* Main content */}
      <div class="flex-1 min-w-0 flex flex-col">
        {/* Fixed action bar */}
        <DetailHeader
          tab={currentTab()}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenSource={handleOpenSource}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onEditNotes={handleEditNotes}
          chatCollapsed={chatCollapsed()}
          onToggleChat={() => setChatCollapsed(!chatCollapsed())}
          onCopy={hasContent() ? handleCopy : undefined}
          copied={copied()}
          compact={heroScrolledPast()}
        />

        {/* Scrollable area: hero + progress + content */}
        <div
          ref={scrollRef}
          class="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          {/* Hero card */}
          <div ref={heroRef}>
            <DetailHeader
              tab={currentTab()}
              onBack={handleBack}
              onToggleStar={handleToggleStar}
              onOpenSource={handleOpenSource}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onEditNotes={handleEditNotes}
              chatCollapsed={chatCollapsed()}
              onToggleChat={() => setChatCollapsed(!chatCollapsed())}
              heroOnly
            />
          </div>

          {/* Reading progress */}
          <Show when={hasContent()}>
            <div class="sticky top-0 z-10 bg-background">
              <ReadingProgress
                scrollRef={scrollRef}
                readingTimeMin={readingTimeMin()}
              />
            </div>
          </Show>

          {/* Content */}
          <div class="px-4 pb-6 flex-1">
            <ContentView />
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
        overlay={isNarrow()}
      />

      {/* Notes editor */}
      <Show when={editingNotes()}>
        <NotesEditor
          tab={currentTab()}
          onSave={handleSaveNotes}
          onClose={() => setEditingNotes(false)}
        />
      </Show>
    </div>
  );
}
```

- [ ] **Step 3: Delete PlaceholderTab**

```bash
rm apps/extension/components/detail/PlaceholderTab.tsx
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run compile
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run test
```

Expected: All tests pass. The transcript-view tests should still work since TranscriptView is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/components/detail/DetailPage.tsx apps/extension/components/detail/DetailHeader.tsx
git rm apps/extension/components/detail/PlaceholderTab.tsx
git commit -m "feat: unified content view — remove pill tabs, add MarkdownView, restore scroll-reveal header"
```

---

### Task 8: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Build the extension**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run test
```

Expected: All tests pass.

- [ ] **Step 3: Type check**

Run:
```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm -F extension run compile
```

Expected: No type errors.
