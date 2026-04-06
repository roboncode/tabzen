# Tab Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated detail page for captured tabs with a two-column layout: tabbed content (transcript functional) on the left, chat panel shell on the right. Accessible via expand icon on tab cards.

**Architecture:** New WXT entrypoint (`entrypoints/detail/`) opens as a chrome-extension tab. Reads tab data from IndexedDB via URL param `tabId`. Components organized under `components/detail/`. Follows existing design system tokens and patterns.

**Tech Stack:** WXT, SolidJS, Tailwind CSS, Lucide icons, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-06-tab-detail-page-design.md`

---

### Task 1: Create Detail Page Entrypoint

**Files:**
- Create: `apps/extension/entrypoints/detail/index.html`
- Create: `apps/extension/entrypoints/detail/main.tsx`
- Create: `apps/extension/entrypoints/detail/App.tsx`

- [ ] **Step 1: Create index.html**

Create `apps/extension/entrypoints/detail/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tab Zen — Detail</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create main.tsx**

Create `apps/extension/entrypoints/detail/main.tsx`:

```typescript
import { render } from "solid-js/web";
import "@/assets/global.css";
import App from "./App";

render(() => <App />, document.getElementById("app")!);
```

- [ ] **Step 3: Create App.tsx (minimal shell)**

Create `apps/extension/entrypoints/detail/App.tsx`:

```typescript
import { createResource, Show } from "solid-js";
import { getTab } from "@/lib/db";
import type { Tab } from "@/lib/types";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  const [tab] = createResource(
    () => tabId,
    async (id) => (id ? getTab(id) : undefined),
  );

  return (
    <div class="w-full min-h-screen bg-background text-foreground">
      <Show
        when={tab()}
        fallback={
          <div class="flex items-center justify-center h-screen">
            <p class="text-muted-foreground">
              {tabId ? "Loading..." : "No tab specified"}
            </p>
          </div>
        }
      >
        {(t) => (
          <div class="p-8">
            <h1 class="text-lg font-semibold">{t().title}</h1>
            <p class="text-sm text-muted-foreground mt-2">{t().url}</p>
            <p class="text-xs text-muted-foreground mt-4">
              Detail page shell — components coming in next tasks
            </p>
          </div>
        )}
      </Show>
    </div>
  );
}
```

- [ ] **Step 4: Verify it builds**

```bash
cd apps/extension && pnpm run build
```

Check that `.output/chrome-mv3/detail.html` exists in the build output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add detail page entrypoint shell"
```

---

### Task 2: Detail Header Component

**Files:**
- Create: `apps/extension/components/detail/DetailHeader.tsx`

- [ ] **Step 1: Create DetailHeader component**

Create `apps/extension/components/detail/DetailHeader.tsx`:

```typescript
import { createMemo } from "solid-js";
import { ArrowLeft, Star, ExternalLink } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator, getFaviconUrl } from "@/lib/domains";

interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
}

export default function DetailHeader(props: DetailHeaderProps) {
  const domain = createMemo(() => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  });

  const creator = createMemo(() => extractCreator(props.tab));
  const faviconSrc = createMemo(() => getFaviconUrl(props.tab));

  const avatarSrc = createMemo(() => {
    if (props.tab.creatorAvatar && creator()) return props.tab.creatorAvatar;
    return faviconSrc();
  });

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  const description = createMemo(
    () => props.tab.ogDescription || props.tab.metaDescription || null,
  );

  return (
    <div>
      {/* Top bar */}
      <div class="flex items-center gap-3 px-6 py-3 border-b border-border">
        <button
          onClick={props.onBack}
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div class="flex-1" />
        <div class="flex items-center gap-2">
          <button
            onClick={props.onToggleStar}
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              props.tab.starred
                ? "text-yellow-400 bg-yellow-400/10"
                : "text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
            }`}
          >
            <Star
              size={14}
              fill={props.tab.starred ? "currentColor" : "none"}
            />
            <span>{props.tab.starred ? "Starred" : "Star"}</span>
          </button>
          <button
            onClick={props.onOpenSource}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
          >
            <ExternalLink size={14} />
            <span>Open source</span>
          </button>
        </div>
      </div>

      {/* Hero: Thumbnail + Title */}
      <div class="flex gap-5 px-6 py-5">
        <div class="w-[180px] h-[101px] rounded-xl overflow-hidden bg-muted/40 flex-shrink-0">
          {props.tab.ogImage ? (
            <img
              src={props.tab.ogImage}
              alt=""
              class="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center">
              {faviconSrc() ? (
                <img src={faviconSrc()} alt="" class="w-8 h-8 rounded" />
              ) : (
                <span class="text-muted-foreground text-sm">{domain()}</span>
              )}
            </div>
          )}
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-base font-semibold text-foreground leading-snug">
            {props.tab.ogTitle || props.tab.title}
          </h1>
          <div class="flex items-center gap-2 mt-2">
            {avatarSrc() && (
              <img
                src={avatarSrc()}
                alt=""
                class="w-5 h-5 rounded-full flex-shrink-0"
              />
            )}
            <span class="text-sm text-muted-foreground">
              {creator() || domain()}
            </span>
            <span class="text-muted-foreground/40">·</span>
            <span class="text-sm text-muted-foreground">
              {formatTimeAgo(props.tab.publishedAt || props.tab.capturedAt)}
            </span>
          </div>
          {description() && (
            <p class="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {description()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/extension && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add DetailHeader component"
```

---

### Task 3: Transcript View Component

**Files:**
- Create: `apps/extension/components/detail/TranscriptView.tsx`
- Create: `apps/extension/tests/transcript-view.test.ts`

- [ ] **Step 1: Write timestamp formatting tests**

Create `apps/extension/tests/transcript-view.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatTimestamp, getTimestampUrl } from "@/components/detail/TranscriptView";

describe("formatTimestamp", () => {
  it("formats seconds correctly", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5000)).toBe("0:05");
    expect(formatTimestamp(65000)).toBe("1:05");
    expect(formatTimestamp(3661000)).toBe("1:01:01");
  });
});

describe("getTimestampUrl", () => {
  it("appends time parameter", () => {
    const url = getTimestampUrl("https://www.youtube.com/watch?v=abc123", 65000);
    expect(url).toBe("https://www.youtube.com/watch?v=abc123&t=65s");
  });

  it("replaces existing time parameter", () => {
    const url = getTimestampUrl("https://www.youtube.com/watch?v=abc123&t=10s", 65000);
    expect(url).toBe("https://www.youtube.com/watch?v=abc123&t=65s");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/extension && pnpm run test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create TranscriptView component**

Create `apps/extension/components/detail/TranscriptView.tsx`:

```typescript
import { createSignal, For, Show } from "solid-js";
import { Copy, Check, FileText } from "lucide-solid";
import type { TranscriptSegment } from "@tab-zen/shared";

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  onFetchTranscript?: () => void;
  loading?: boolean;
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getTimestampUrl(videoUrl: string, ms: number): string {
  const seconds = Math.floor(ms / 1000);
  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}

export default function TranscriptView(props: TranscriptViewProps) {
  const [copied, setCopied] = createSignal(false);

  const copyTranscript = () => {
    const text = props.segments
      .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="flex flex-col h-full">
      <Show
        when={props.segments.length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No transcript available</p>
            <Show when={props.onFetchTranscript}>
              <button
                onClick={props.onFetchTranscript}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Fetching..." : "Fetch Transcript"}
              </button>
            </Show>
          </div>
        }
      >
        {/* Header with count and copy */}
        <div class="flex items-center gap-3 px-2 pb-3 flex-shrink-0">
          <span class="text-xs text-muted-foreground">
            {props.segments.length} segments
          </span>
          <div class="flex-1" />
          <button
            onClick={copyTranscript}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Show when={copied()} fallback={<Copy size={12} />}>
              <Check size={12} class="text-green-400" />
            </Show>
            <span>{copied() ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Segments */}
        <div class="flex-1 overflow-y-auto space-y-0.5">
          <For each={props.segments}>
            {(segment) => (
              <div class="flex gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                <a
                  href={getTimestampUrl(props.videoUrl, segment.startMs)}
                  target="_blank"
                  class="text-sky-400 hover:text-sky-300 font-mono text-xs flex-shrink-0 pt-0.5 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatTimestamp(segment.startMs)}
                </a>
                <span class="text-sm text-foreground/90 leading-relaxed">
                  {segment.text}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/extension && pnpm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add TranscriptView component with timestamp formatting"
```

---

### Task 4: Chat Panel Shell and Placeholder Tab

**Files:**
- Create: `apps/extension/components/detail/ChatPanel.tsx`
- Create: `apps/extension/components/detail/PlaceholderTab.tsx`

- [ ] **Step 1: Create ChatPanel component (shell only)**

Create `apps/extension/components/detail/ChatPanel.tsx`:

```typescript
import { createSignal, Show } from "solid-js";
import { MessageCircle, PanelRightClose, PanelRight } from "lucide-solid";

interface ChatPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatPanel(props: ChatPanelProps) {
  return (
    <Show
      when={!props.collapsed}
      fallback={
        <button
          onClick={props.onToggle}
          class="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors z-10"
          title="Show chat"
        >
          <PanelRight size={16} />
        </button>
      }
    >
      <div class="w-[340px] flex-shrink-0 flex flex-col border-l border-border bg-[#18181c]">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <div class="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageCircle size={14} />
              Chat
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              Ask about this content
            </div>
          </div>
          <button
            onClick={props.onToggle}
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Hide chat"
          >
            <PanelRightClose size={16} />
          </button>
        </div>

        {/* Placeholder body */}
        <div class="flex-1 flex items-center justify-center px-6">
          <div class="text-center">
            <MessageCircle
              size={32}
              class="mx-auto mb-3 text-muted-foreground/30"
            />
            <p class="text-sm text-muted-foreground">
              Chat will be available in a future update
            </p>
          </div>
        </div>

        {/* Disabled input */}
        <div class="px-4 py-3 border-t border-border flex-shrink-0">
          <div class="flex gap-2 items-center">
            <div class="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed">
              Ask about this content...
            </div>
            <div class="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground/30 cursor-not-allowed">
              ↑
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
```

- [ ] **Step 2: Create PlaceholderTab component**

Create `apps/extension/components/detail/PlaceholderTab.tsx`:

```typescript
import { FileText } from "lucide-solid";

interface PlaceholderTabProps {
  title: string;
  description: string;
}

export default function PlaceholderTab(props: PlaceholderTabProps) {
  return (
    <div class="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
      <FileText size={32} class="opacity-30" />
      <p class="text-sm font-medium">{props.title}</p>
      <p class="text-xs text-muted-foreground/60">{props.description}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/extension && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ChatPanel shell and PlaceholderTab components"
```

---

### Task 5: Detail Page Assembly

**Files:**
- Create: `apps/extension/components/detail/DetailPage.tsx`
- Modify: `apps/extension/entrypoints/detail/App.tsx`

- [ ] **Step 1: Create DetailPage component**

Create `apps/extension/components/detail/DetailPage.tsx`:

```typescript
import { createSignal, createMemo, Show } from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab } from "@/lib/db";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import ChatPanel from "./ChatPanel";
import PlaceholderTab from "./PlaceholderTab";

type ContentTab = "transcript" | "summary" | "content";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [activeTab, setActiveTab] = createSignal<ContentTab>("transcript");
  const [chatCollapsed, setChatCollapsed] = createSignal(false);
  const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[]>(
    (props.tab as any).transcript || [],
  );
  const [fetchingTranscript, setFetchingTranscript] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.tab.url));

  const handleBack = () => {
    window.close();
  };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleOpenSource = () => {
    window.open(props.tab.url, "_blank");
  };

  const handleFetchTranscript = async () => {
    setFetchingTranscript(true);
    try {
      const response = await sendMessage({
        type: "GET_TRANSCRIPT",
        tabId: props.tab.id,
      });
      if (response.type === "TRANSCRIPT" && response.transcript) {
        setTranscriptSegments(response.transcript);
      }
    } catch (e) {
      console.error("Failed to fetch transcript:", e);
    } finally {
      setFetchingTranscript(false);
    }
  };

  const tabs: { id: ContentTab; label: string }[] = [
    { id: "transcript", label: "Transcript" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
  ];

  return (
    <div class="flex h-screen bg-background">
      {/* Left: Main content */}
      <div class="flex-1 min-w-0 flex flex-col relative">
        <DetailHeader
          tab={currentTab()}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenSource={handleOpenSource}
        />

        {/* Tab bar */}
        <div class="flex gap-0 px-6 border-b border-border flex-shrink-0">
          {tabs.map((tab) => (
            <button
              class={`px-4 py-2.5 text-sm transition-colors relative ${
                activeTab() === tab.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab() === tab.id && (
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-ring" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-hidden p-6">
          <Show when={activeTab() === "transcript"}>
            <Show
              when={isYouTube()}
              fallback={
                <PlaceholderTab
                  title="Transcript not available"
                  description="Transcripts are available for YouTube videos"
                />
              }
            >
              <TranscriptView
                segments={transcriptSegments()}
                videoUrl={props.tab.url}
                onFetchTranscript={
                  transcriptSegments().length === 0
                    ? handleFetchTranscript
                    : undefined
                }
                loading={fetchingTranscript()}
              />
            </Show>
          </Show>

          <Show when={activeTab() === "summary"}>
            <PlaceholderTab
              title="Summary"
              description="AI-generated summaries coming in a future update"
            />
          </Show>

          <Show when={activeTab() === "content"}>
            <PlaceholderTab
              title="Content"
              description="Web page content extraction coming in a future update"
            />
          </Show>
        </div>
      </div>

      {/* Right: Chat panel */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx to use DetailPage**

Replace `apps/extension/entrypoints/detail/App.tsx`:

```typescript
import { createResource, Show } from "solid-js";
import { getTab } from "@/lib/db";
import DetailPage from "@/components/detail/DetailPage";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  const [tab] = createResource(
    () => tabId,
    async (id) => (id ? getTab(id) : undefined),
  );

  return (
    <Show
      when={tab()}
      fallback={
        <div class="flex items-center justify-center h-screen bg-background">
          <p class="text-muted-foreground text-sm">
            {tab.loading ? "Loading..." : "Tab not found"}
          </p>
        </div>
      }
    >
      {(t) => <DetailPage tab={t()} />}
    </Show>
  );
}
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
cd apps/extension && pnpm exec tsc --noEmit
cd apps/extension && pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: assemble DetailPage with header, tabs, transcript, and chat panel"
```

---

### Task 6: Expand Icon on Tab Cards

**Files:**
- Modify: `apps/extension/components/TabCard.tsx`
- Modify: `apps/extension/components/GroupSection.tsx`

- [ ] **Step 1: Add onExpand prop and icon to TabCard**

In `apps/extension/components/TabCard.tsx`:

1. Add import:
```typescript
import { Star, Archive, ArchiveRestore, Trash2, ShieldBan, Undo2, Maximize2 } from "lucide-solid";
```

2. Add to `TabCardProps`:
```typescript
  onExpand?: (tab: Tab) => void;
```

3. Add the expand icon button inside the thumbnail overlay `<div class="absolute top-2 left-2 flex gap-1.5">` — but positioned on the right side. Add a new absolute div for the right side, after the existing left-side action buttons div (after the closing `</div>` of the `absolute top-2 left-2` div):

```tsx
        {/* Expand button - right side */}
        <Show when={props.onExpand && !props.isTrash}>
          <div class="absolute top-2 right-2">
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                props.onExpand?.(props.tab);
              }}
              title="Open detail page"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </Show>
```

- [ ] **Step 2: Wire expand handler in GroupSection**

In `apps/extension/components/GroupSection.tsx`:

1. Add to `GroupSectionProps`:
```typescript
  onExpandTab?: (tab: Tab) => void;
```

2. Pass to TabCard in the card view section:
```typescript
onExpand={props.onExpandTab}
```

- [ ] **Step 3: Wire expand handler in TabCollection**

In `apps/extension/components/TabCollection.tsx`, find where `GroupSection` is rendered and add:

```typescript
onExpandTab={(tab) => {
  const detailUrl = browser.runtime.getURL(`detail.html?tabId=${tab.id}`);
  window.open(detailUrl, "_blank");
}}
```

You'll need to check if `browser` is available — in the extension context it should be. The `browser.runtime.getURL` generates the full `chrome-extension://...` URL.

- [ ] **Step 4: Verify TypeScript and tests**

```bash
cd apps/extension && pnpm exec tsc --noEmit
cd apps/extension && pnpm run test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add expand icon on tab cards to open detail page"
```

---

### Task 7: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
cd apps/extension && pnpm run test
```

Expected: all tests pass.

- [ ] **Step 2: TypeScript check**

```bash
cd apps/extension && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Build extension**

```bash
cd apps/extension && pnpm run build
```

Verify `detail.html` is in the build output.

- [ ] **Step 4: Manual testing checklist**

1. Load extension in Chrome
2. Capture a YouTube tab
3. Hover over the tab card → verify expand icon appears (top-right of thumbnail)
4. Click expand icon → new tab opens with detail page
5. Verify header shows: thumbnail, title, channel, date, description
6. Verify "Back" button closes the tab
7. Verify "Star" button toggles star state
8. Verify "Open source" opens the YouTube URL
9. Verify transcript tab shows timestamped segments (for YouTube tabs with transcripts)
10. Click a timestamp → verify it opens YouTube at that time
11. Click "Copy" → verify transcript copied to clipboard
12. Click "Summary" tab → verify placeholder shows
13. Click "Content" tab → verify placeholder shows
14. Verify chat panel shows placeholder with disabled input
15. Click chat collapse button → verify panel hides, expand button appears
16. Capture a non-YouTube tab → open detail → verify appropriate state

- [ ] **Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve issues from detail page end-to-end testing"
```
