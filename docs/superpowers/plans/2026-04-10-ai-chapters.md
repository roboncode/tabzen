# AI Chapters & Capture Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate AI chapter headings for video transcripts that appear in the transcript body and "On this page" sidebar, with settings toggles for auto-tagging and auto-chapters.

**Architecture:** New `generateChapters()` function in `lib/ai.ts` calls OpenRouter to identify topic shifts in transcripts. Chapters stored as `{ title, startMs }[]` on the Page model. TranscriptView inserts `<h2 id>` headings at chapter positions, which the existing TOC extraction picks up automatically. Two new settings booleans gate auto-tagging and auto-chapters during capture.

**Tech Stack:** SolidJS, TypeScript, OpenRouter API, IndexedDB (idb)

**Spec:** `docs/superpowers/specs/2026-04-10-ai-chapters-design.md`

---

## File Structure

### Modified Files
- `packages/shared/src/types.ts` — Add `chapters` field to `Page` interface
- `apps/extension/lib/types.ts` — Add `autoTagging` and `autoChapters` to `Settings` and `DEFAULT_SETTINGS`
- `apps/extension/lib/ai.ts` — Add `generateChapters()` function
- `apps/extension/entrypoints/background.ts` — Gate tagging with `autoTagging`, add chapter generation with `autoChapters`
- `apps/extension/components/detail/TranscriptView.tsx` — Accept `chapters` prop, render `<h2 id>` headings inline
- `apps/extension/components/SettingsPanel.tsx` — Add auto-tagging and auto-chapters toggles in AI tab
- `apps/extension/components/detail/DetailPage.tsx` — Pass `chapters` to TranscriptView

---

## Task 1: Add `chapters` to Page model

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add chapters field to Page interface**

In `packages/shared/src/types.ts`, add after the `content?: string` field (line 31):

```typescript
chapters?: { title: string; startMs: number }[];
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add chapters field to Page model"
```

---

## Task 2: Add settings fields

**Files:**
- Modify: `apps/extension/lib/types.ts`

- [ ] **Step 1: Add autoTagging and autoChapters to Settings interface**

In `apps/extension/lib/types.ts`, add two new fields to the `Settings` interface (after `socialHook: boolean`):

```typescript
autoTagging: boolean;
autoChapters: boolean;
```

- [ ] **Step 2: Add defaults to DEFAULT_SETTINGS**

In the `DEFAULT_SETTINGS` constant, add after `socialHook: true`:

```typescript
autoTagging: true,
autoChapters: true,
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "feat: add autoTagging and autoChapters settings"
```

---

## Task 3: Add `generateChapters()` to ai.ts

**Files:**
- Modify: `apps/extension/lib/ai.ts`

- [ ] **Step 1: Add the generateChapters function**

Add this function at the end of `apps/extension/lib/ai.ts` (after `generateTags`):

```typescript
export async function generateChapters(
  apiKey: string,
  model: string,
  segments: { text: string; startMs: number; durationMs: number }[],
): Promise<{ title: string; startMs: number }[]> {
  // Build timestamped transcript text
  const lines: string[] = [];
  for (const seg of segments) {
    const totalSec = Math.floor(seg.startMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const ts = `${m}:${s.toString().padStart(2, "0")}`;
    lines.push(`[${ts}] ${seg.text}`);
  }
  const transcriptText = lines.join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a video chapter generator. Given a timestamped transcript, identify 4-10 topic shifts and assign a short chapter title to each. Return JSON: {"chapters": [{"title": "Chapter Title", "startMs": 0}, ...]}
Rules:
- The first chapter must start at startMs: 0
- Chapter titles should be 2-5 words, descriptive of the topic
- Chapters mark genuine topic shifts, not arbitrary time splits
- Fewer chapters for short videos, more for long ones
- startMs values must match actual timestamps from the transcript
- Sort chapters by startMs ascending`,
    },
    { role: "user", content: transcriptText },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.chapters;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/lib/ai.ts
git commit -m "feat: add generateChapters() AI function"
```

---

## Task 4: Wire chapter generation into capture flows

**Files:**
- Modify: `apps/extension/entrypoints/background.ts`

- [ ] **Step 1: Add generateChapters import**

At the top of `background.ts`, update the import from `@/lib/ai` to include `generateChapters`:

```typescript
import { aiSearch, generateTags, generateChapters } from "@/lib/ai";
```

- [ ] **Step 2: Gate QUICK_CAPTURE tagging with autoTagging setting**

In the QUICK_CAPTURE handler, around line 864, change:

```typescript
// Before:
if (settings.openRouterApiKey) {

// After:
if (settings.autoTagging && settings.openRouterApiKey) {
```

- [ ] **Step 3: Add chapter generation to QUICK_CAPTURE**

After the tagging block (after line 896's closing `}`), add chapter generation for transcript pages:

```typescript
// Pass 4: AI chapters for video transcripts
if (settings.autoChapters && settings.openRouterApiKey) {
  try {
    for (const p of pages) {
      const freshPage = await getPage(p.id);
      if (freshPage?.contentType === "transcript" && freshPage.transcript?.length && !freshPage.chapters?.length) {
        const chapters = await generateChapters(
          settings.openRouterApiKey,
          settings.aiModel,
          freshPage.transcript,
        );
        if (chapters?.length) {
          await updatePage(p.id, { chapters });
        }
      }
    }
    notifyDataChanged();
  } catch {}
}
```

- [ ] **Step 4: Gate captureSingleTab tagging with autoTagging setting**

In `captureSingleTab`, around line 1484, change:

```typescript
// Before:
if (settings.openRouterApiKey) {

// After:
if (settings.autoTagging && settings.openRouterApiKey) {
```

- [ ] **Step 5: Add chapter generation to captureSingleTab**

After the tagging async block in `captureSingleTab` (after line 1503's closing `}`), add:

```typescript
// AI chapters (async, non-blocking)
if (settings.autoChapters && settings.openRouterApiKey && hasTranscript) {
  (async () => {
    try {
      const chapters = await generateChapters(
        settings.openRouterApiKey,
        settings.aiModel,
        transcriptSegments!,
      );
      if (chapters?.length) {
        await updatePage(pageId, { chapters });
        notifyDataChanged();
      }
    } catch {}
  })();
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/extension/entrypoints/background.ts
git commit -m "feat: wire chapter generation into capture flows, gate tagging with settings"
```

---

## Task 5: Render chapters in TranscriptView

**Files:**
- Modify: `apps/extension/components/detail/TranscriptView.tsx`

- [ ] **Step 1: Add chapters prop to TranscriptViewProps**

Update the interface at the top of the file:

```typescript
interface TranscriptViewProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  chapters?: { title: string; startMs: number }[];
  onFetchTranscript?: () => void;
  loading?: boolean;
}
```

- [ ] **Step 2: Build a chapter lookup map**

Inside the `TranscriptView` component (after the `paragraphs` memo), add:

```typescript
// Map chapter startMs to chapter data for quick lookup
const chapterAtParagraph = createMemo(() => {
  const chapters = props.chapters;
  if (!chapters?.length) return new Map<number, { title: string; startMs: number; index: number }>();

  const paras = paragraphs();
  const map = new Map<number, { title: string; startMs: number; index: number }>();

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    // Find the first paragraph whose startMs is >= chapter startMs
    for (let pi = 0; pi < paras.length; pi++) {
      if (paras[pi].startMs >= chapter.startMs && !map.has(pi)) {
        map.set(pi, { ...chapter, index: ci });
        break;
      }
    }
  }

  return map;
});
```

- [ ] **Step 3: Insert chapter headings in the render loop**

Replace the `<For each={paragraphs()}>` block (lines 204-221) with:

```tsx
<For each={paragraphs()}>
  {(para, pi) => {
    const chapter = () => chapterAtParagraph().get(pi());
    return (
      <>
        <Show when={chapter()}>
          {(ch) => (
            <h2
              id={`chapter-${ch().index}`}
              class="text-lg font-semibold text-foreground mt-4 mb-2 flex items-baseline gap-3"
            >
              <span>{ch().title}</span>
              <a
                href={getTimestampUrl(props.videoUrl, ch().startMs)}
                target="_blank"
                class="text-xs font-normal text-muted-foreground/40 hover:text-sky-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {formatTimestamp(ch().startMs)}
              </a>
            </h2>
          )}
        </Show>
        <div class="group/para">
          <a
            href={getTimestampUrl(props.videoUrl, para.startMs)}
            target="_blank"
            class="flex items-center gap-3 mb-3 text-muted-foreground/25 hover:text-sky-500 group-hover/para:text-muted-foreground/40 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <span class="text-xl font-extralight tracking-tight">
              {formatTimestamp(para.startMs)}
            </span>
            <div class="h-px flex-1 bg-current" />
          </a>
          <ParagraphText segments={para.segments} videoUrl={props.videoUrl} dropCap={para.startsWithSentence && !chapter()} onSegmentHover={handleSegmentHover} />
        </div>
      </>
    );
  }}
</For>
```

Key changes:
- Each paragraph checks if a chapter heading should appear before it
- Chapter heading is an `<h2 id="chapter-{index}">` which the TOC extraction picks up
- Drop cap is suppressed for the first paragraph of a chapter (since the heading provides the visual break)
- Chapter timestamp links to the video at that point

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/detail/TranscriptView.tsx
git commit -m "feat: render chapter headings in transcript with TOC-compatible IDs"
```

---

## Task 6: Pass chapters from DetailPage to TranscriptView

**Files:**
- Modify: `apps/extension/components/detail/DetailPage.tsx`

- [ ] **Step 1: Pass chapters to TranscriptView**

Find where `TranscriptView` is rendered in DetailPage.tsx. It will be inside the `ContentView` function. Find the `<TranscriptView` JSX element and add the `chapters` prop:

```tsx
<TranscriptView
  segments={transcriptSegments()}
  videoUrl={currentPage().url}
  chapters={currentPage().chapters}
  onFetchTranscript={...}
  loading={...}
/>
```

Read the file first to find the exact location and existing props.

- [ ] **Step 2: Commit**

```bash
git add apps/extension/components/detail/DetailPage.tsx
git commit -m "feat: pass chapters from DetailPage to TranscriptView"
```

---

## Task 7: Add settings toggles

**Files:**
- Modify: `apps/extension/components/SettingsPanel.tsx`

- [ ] **Step 1: Add toggles in the AI tab**

In `SettingsPanel.tsx`, find the AI tab section. After the Model `<select>` block and its description paragraph (around line 212, before `<div class="pt-2"><TemplateManager />`), add:

```tsx
<div class="pt-4 space-y-3">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-foreground">Auto-tag pages on capture</p>
      <p class="text-xs text-muted-foreground mt-0.5">Generate tags when pages are saved</p>
    </div>
    <button
      class={`w-10 h-6 rounded-full transition-colors ${
        s().autoTagging ? "bg-sky-500" : "bg-muted/60"
      }`}
      onClick={() => save({ autoTagging: !s().autoTagging })}
      disabled={!s().openRouterApiKey}
    >
      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
        s().autoTagging ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  </div>
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-foreground">Auto-generate chapters for videos</p>
      <p class="text-xs text-muted-foreground mt-0.5">Create chapter headings from video transcripts</p>
    </div>
    <button
      class={`w-10 h-6 rounded-full transition-colors ${
        s().autoChapters ? "bg-sky-500" : "bg-muted/60"
      }`}
      onClick={() => save({ autoChapters: !s().autoChapters })}
      disabled={!s().openRouterApiKey}
    >
      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
        s().autoChapters ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/components/SettingsPanel.tsx
git commit -m "feat: add auto-tagging and auto-chapters toggles in settings"
```

---

## Task 8: Build verification

**Files:** Various (fix any compilation errors)

- [ ] **Step 1: Run TypeScript compilation**

```bash
cd apps/extension && pnpm run compile
```

Fix any type errors.

- [ ] **Step 2: Run the build**

```bash
pnpm run build
```

Fix any build errors.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Fix any test failures.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve any compilation errors from AI chapters feature"
```
