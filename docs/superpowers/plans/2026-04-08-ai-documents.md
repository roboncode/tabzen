# AI-Generated Documents & Summaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customizable AI prompt templates that generate structured documents (summaries, key points, action items, etc.) from saved tab content, displayed as pill tabs in the detail page.

**Architecture:** Extension-only (client-side). Prompt templates and generated documents stored in IndexedDB. AI calls go through the existing OpenRouter integration in `lib/ai.ts`. Settings page reorganized into pill tabs to accommodate template management.

**Tech Stack:** SolidJS, IndexedDB (idb), OpenRouter API, marked (markdown rendering), Tailwind CSS, WXT extension framework.

---

### Task 1: Types & Interfaces

**Files:**
- Modify: `apps/extension/lib/types.ts`

- [ ] **Step 1: Add AITemplate and AIDocument interfaces**

Add these interfaces to `apps/extension/lib/types.ts` after the `CapturePreviewData` interface:

```ts
export interface AITemplate {
  id: string;
  name: string;
  prompt: string;
  isBuiltin: boolean;
  defaultPrompt: string | null;
  isEnabled: boolean;
  sortOrder: number;
  model: string | null;
}

export interface AIDocument {
  id: string;
  tabId: string;
  templateId: string;
  content: string;
  generatedAt: string;
  promptUsed: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "feat: add AITemplate and AIDocument interfaces"
```

---

### Task 2: Built-in Prompt Templates (Markdown Files)

**Files:**
- Create: `apps/extension/prompts/summary.md`
- Create: `apps/extension/prompts/key-points.md`
- Create: `apps/extension/prompts/action-items.md`
- Create: `apps/extension/prompts/eli5.md`
- Create: `apps/extension/prompts/products-mentions.md`

- [ ] **Step 1: Create `apps/extension/prompts/summary.md`**

```md
Generate a concise summary of the following {{contentType}}. Write 2-5 sentences that capture the main topic, key arguments or findings, and the overall takeaway. Use clear, direct language. Do not include any preamble like "Here is a summary" — just write the summary itself.
```

- [ ] **Step 2: Create `apps/extension/prompts/key-points.md`**

```md
Extract the key points from the following {{contentType}} as a bulleted markdown list. Each bullet should be a complete, standalone statement — not a fragment. Focus on the most important ideas, arguments, or facts. Aim for 5-10 bullets. Do not include any preamble — just the list.
```

- [ ] **Step 3: Create `apps/extension/prompts/action-items.md`**

```md
Extract actionable tasks or steps from the following {{contentType}} as a bulleted markdown checklist using `- [ ]` syntax. Each item should be a concrete, specific action the reader could take. If the content doesn't contain actionable items, return a single bullet: "- [ ] No actionable items found in this content." Do not include any preamble — just the checklist.
```

- [ ] **Step 4: Create `apps/extension/prompts/eli5.md`**

```md
Explain the following {{contentType}} in simple terms that a non-expert would understand. Avoid jargon and technical terms — if you must use one, define it briefly. Use analogies where helpful. Keep it to 2-4 short paragraphs. Do not include any preamble like "Here is a simple explanation" — just explain.
```

- [ ] **Step 5: Create `apps/extension/prompts/products-mentions.md`**

```md
List all products, tools, services, brands, and sponsors mentioned in the following {{contentType}} as a bulleted markdown list. For each item, include:
- The name of the product/tool/service
- A brief (one-sentence) description of what it is or how it was mentioned

If nothing is mentioned, return a single bullet: "- No products or mentions found in this content." Do not include any preamble — just the list.
```

- [ ] **Step 6: Commit**

```bash
git add apps/extension/prompts/
git commit -m "feat: add built-in AI prompt template markdown files"
```

---

### Task 3: Database Layer — AITemplate & AIDocument Stores

**Files:**
- Modify: `apps/extension/lib/db.ts`

This task upgrades the IndexedDB schema to version 2 and adds CRUD operations for `aiTemplates` and `aiDocuments` stores.

- [ ] **Step 1: Add new stores to the DBSchema interface**

In `apps/extension/lib/db.ts`, update the `TabZenDB` interface to add the two new stores:

```ts
import type { Tab, Group, Capture, AITemplate, AIDocument } from "./types";

interface TabZenDB extends DBSchema {
  tabs: {
    key: string;
    value: Tab;
    indexes: {
      "by-url": string;
      "by-groupId": string;
      "by-capturedAt": string;
      "by-archived": number;
    };
  };
  groups: {
    key: string;
    value: Group;
    indexes: {
      "by-captureId": string;
      "by-position": number;
    };
  };
  captures: {
    key: string;
    value: Capture;
    indexes: {
      "by-capturedAt": string;
    };
  };
  aiTemplates: {
    key: string;
    value: AITemplate;
    indexes: {
      "by-sortOrder": number;
    };
  };
  aiDocuments: {
    key: string;
    value: AIDocument;
    indexes: {
      "by-tabId": string;
      "by-templateId": string;
    };
  };
}
```

- [ ] **Step 2: Upgrade the DB version and add migration**

Update the `getDB` function. Change version from `1` to `2` and add the `upgrade` handler for the new stores. The upgrade function needs to handle both fresh installs (v0→v2) and existing installs (v1→v2):

```ts
async function getDB(): Promise<IDBPDatabase<TabZenDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TabZenDB>("tab-zen", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const tabStore = db.createObjectStore("tabs", { keyPath: "id" });
        tabStore.createIndex("by-url", "url");
        tabStore.createIndex("by-groupId", "groupId");
        tabStore.createIndex("by-capturedAt", "capturedAt");
        tabStore.createIndex("by-archived", "archived");

        const groupStore = db.createObjectStore("groups", { keyPath: "id" });
        groupStore.createIndex("by-captureId", "captureId");
        groupStore.createIndex("by-position", "position");

        const captureStore = db.createObjectStore("captures", { keyPath: "id" });
        captureStore.createIndex("by-capturedAt", "capturedAt");
      }

      if (oldVersion < 2) {
        const templateStore = db.createObjectStore("aiTemplates", { keyPath: "id" });
        templateStore.createIndex("by-sortOrder", "sortOrder");

        const docStore = db.createObjectStore("aiDocuments", { keyPath: "id" });
        docStore.createIndex("by-tabId", "tabId");
        docStore.createIndex("by-templateId", "templateId");
      }
    },
  });
  return dbInstance;
}
```

- [ ] **Step 3: Add AITemplate CRUD functions**

Add these functions at the bottom of `apps/extension/lib/db.ts`:

```ts
// --- AI Templates ---

export async function getAllTemplates(): Promise<AITemplate[]> {
  const db = await getDB();
  const all = await db.getAll("aiTemplates");
  return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTemplate(id: string): Promise<AITemplate | undefined> {
  const db = await getDB();
  return db.get("aiTemplates", id);
}

export async function putTemplate(template: AITemplate): Promise<void> {
  const db = await getDB();
  await db.put("aiTemplates", template);
}

export async function putTemplates(templates: AITemplate[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("aiTemplates", "readwrite");
  for (const t of templates) {
    tx.store.put(t);
  }
  await tx.done;
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("aiTemplates", id);
}
```

- [ ] **Step 4: Add AIDocument CRUD functions**

Add these functions at the bottom of `apps/extension/lib/db.ts`:

```ts
// --- AI Documents ---

export async function getDocumentsForTab(tabId: string): Promise<AIDocument[]> {
  const db = await getDB();
  return db.getAllFromIndex("aiDocuments", "by-tabId", tabId);
}

export async function getDocument(tabId: string, templateId: string): Promise<AIDocument | undefined> {
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-tabId", tabId);
  return docs.find((d) => d.templateId === templateId);
}

export async function putDocument(doc: AIDocument): Promise<void> {
  const db = await getDB();
  // Enforce unique (tabId, templateId) — find and replace if exists
  const existing = await getDocument(doc.tabId, doc.templateId);
  if (existing) {
    await db.delete("aiDocuments", existing.id);
  }
  await db.put("aiDocuments", doc);
}

export async function deleteDocumentsForTab(tabId: string): Promise<void> {
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-tabId", tabId);
  const tx = db.transaction("aiDocuments", "readwrite");
  for (const doc of docs) {
    tx.store.delete(doc.id);
  }
  await tx.done;
}

export async function getAllDocuments(): Promise<AIDocument[]> {
  const db = await getDB();
  return db.getAll("aiDocuments");
}
```

- [ ] **Step 5: Update `clearAllData` to include new stores**

Update the `clearAllData` function to also clear the new stores:

```ts
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["tabs", "groups", "captures", "aiTemplates", "aiDocuments"], "readwrite");
  await tx.objectStore("tabs").clear();
  await tx.objectStore("groups").clear();
  await tx.objectStore("captures").clear();
  await tx.objectStore("aiTemplates").clear();
  await tx.objectStore("aiDocuments").clear();
  await tx.done;
}
```

- [ ] **Step 6: Update `getAllData` to include new stores**

Update `getAllData` to return templates and documents for sync:

```ts
export async function getAllData(): Promise<{
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  aiTemplates: AITemplate[];
  aiDocuments: AIDocument[];
}> {
  const db = await getDB();
  const [tabs, groups, captures, aiTemplates, aiDocuments] = await Promise.all([
    db.getAll("tabs"),
    db.getAll("groups"),
    db.getAll("captures"),
    db.getAll("aiTemplates"),
    db.getAll("aiDocuments"),
  ]);
  return { tabs, groups, captures, aiTemplates, aiDocuments };
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/extension/lib/db.ts
git commit -m "feat: add aiTemplates and aiDocuments stores to IndexedDB"
```

---

### Task 4: Template Seeding — Load Built-in Defaults

**Files:**
- Create: `apps/extension/lib/templates.ts`

This module reads the built-in prompt markdown files and seeds them into IndexedDB on first run.

- [ ] **Step 1: Create `apps/extension/lib/templates.ts`**

```ts
import { v4 as uuidv4 } from "uuid";
import { getAllTemplates, putTemplates } from "./db";
import type { AITemplate } from "./types";

// Import prompt files as raw text
import summaryPrompt from "@/prompts/summary.md?raw";
import keyPointsPrompt from "@/prompts/key-points.md?raw";
import actionItemsPrompt from "@/prompts/action-items.md?raw";
import eli5Prompt from "@/prompts/eli5.md?raw";
import productsMentionsPrompt from "@/prompts/products-mentions.md?raw";

interface BuiltinDef {
  name: string;
  prompt: string;
}

const BUILTIN_TEMPLATES: BuiltinDef[] = [
  { name: "Summary", prompt: summaryPrompt.trim() },
  { name: "Key Points", prompt: keyPointsPrompt.trim() },
  { name: "Action Items", prompt: actionItemsPrompt.trim() },
  { name: "ELI5", prompt: eli5Prompt.trim() },
  { name: "Products & Mentions", prompt: productsMentionsPrompt.trim() },
];

export async function seedTemplatesIfNeeded(): Promise<void> {
  const existing = await getAllTemplates();
  if (existing.length > 0) return;

  const templates: AITemplate[] = BUILTIN_TEMPLATES.map((def, i) => ({
    id: uuidv4(),
    name: def.name,
    prompt: def.prompt,
    isBuiltin: true,
    defaultPrompt: def.prompt,
    isEnabled: true,
    sortOrder: i,
    model: null,
  }));

  await putTemplates(templates);
}

export function getDefaultPrompt(templateName: string): string | null {
  const def = BUILTIN_TEMPLATES.find((d) => d.name === templateName);
  return def?.prompt ?? null;
}
```

- [ ] **Step 2: Call `seedTemplatesIfNeeded` from the background script**

In `apps/extension/entrypoints/background.ts`, add the import and call near the top of the `defineBackground` callback, after the existing startup tasks (after the `purgeDeletedTabs` call):

```ts
import { seedTemplatesIfNeeded } from "@/lib/templates";
```

And add this call after the `purgeDeletedTabs(30)` line:

```ts
seedTemplatesIfNeeded().catch((e) => console.warn("[TabZen] Template seed failed:", e));
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/templates.ts apps/extension/entrypoints/background.ts
git commit -m "feat: seed built-in AI prompt templates on first run"
```

---

### Task 5: AI Document Generation Function

**Files:**
- Modify: `apps/extension/lib/ai.ts`

- [ ] **Step 1: Add `generateDocument` function**

Add this function to `apps/extension/lib/ai.ts` after the existing `generateTags` function:

```ts
export async function generateDocument(
  apiKey: string,
  model: string,
  templatePrompt: string,
  content: string,
  contentType: "transcript" | "markdown",
): Promise<string> {
  const contentLabel = contentType === "transcript" ? "video transcript" : "article";
  const processedPrompt = templatePrompt.replace(/\{\{contentType\}\}/g, contentLabel);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: processedPrompt,
    },
    {
      role: "user",
      content,
    },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "chrome-extension://tab-zen",
      "X-Title": "Tab Zen",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

Note: This does NOT use `response_format: { type: "json_object" }` unlike the other AI functions, because document generation returns markdown, not JSON.

- [ ] **Step 2: Update `generateTags` to accept existing tags**

Modify the `generateTags` function signature and prompt to include existing tag vocabulary:

```ts
export async function generateTags(
  apiKey: string,
  model: string,
  tabs: { id: string; title: string; url: string; description: string | null }[],
  existingTags?: string[],
): Promise<{ id: string; tags: string[] }[]> {
```

In the system prompt content, add this line before the closing backtick of the `Rules:` section:

```
- ${existingTags && existingTags.length > 0 ? `Prefer reusing these existing tags when appropriate: ${existingTags.join(", ")}` : "Create descriptive, specific tags"}
```

The full updated system content becomes:

```ts
content: `You are a content tagger. Given a list of browser tabs, generate 2-5 relevant hashtags for each tab. Return JSON: {"tags": [{"id": "tab-id", "tags": ["tag1", "tag2"]}]}
Rules:
- Tags should be lowercase, no spaces, no # prefix
- Use specific descriptive tags (e.g., "react", "server-components", "tutorial")
- Avoid generic tags like "video", "website", "article"
- Tags should help categorize content by topic, technology, or theme
- ${existingTags && existingTags.length > 0 ? `Prefer reusing these existing tags when appropriate: ${existingTags.join(", ")}` : "Create descriptive, specific tags"}
- Reuse the same tag across tabs when the content overlaps`,
```

- [ ] **Step 3: Update `generateTags` call site in background.ts to pass existing tags**

Find where `generateTags` is called in `apps/extension/entrypoints/background.ts` and update it to pass existing tags. Search for the call and add the `existingTags` argument. You'll need to import `getAllTags` from `@/lib/db` and get the tags before calling:

```ts
const allTags = await getAllTags();
const existingTagNames = allTags.map((t) => t.tag);
const tagResults = await generateTags(settings.openRouterApiKey, settings.aiModel, tabsForTagging, existingTagNames);
```

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/ai.ts apps/extension/entrypoints/background.ts
git commit -m "feat: add generateDocument function and tag-aware tag generation"
```

---

### Task 6: Detail Page — Pill Tab Bar & AI Document Views

**Files:**
- Create: `apps/extension/components/detail/DocumentTabs.tsx`
- Create: `apps/extension/components/detail/DocumentView.tsx`
- Modify: `apps/extension/components/detail/DetailPage.tsx`

This is the largest UI task. It adds the pill tab bar to the detail page and the document view states (not generated, generating, generated).

- [ ] **Step 1: Create `apps/extension/components/detail/DocumentTabs.tsx`**

This component renders the pill tab bar for switching between Content and AI document views.

```tsx
import { For, Show } from "solid-js";
import type { AITemplate, AIDocument } from "@/lib/types";
import { Zap, Plus } from "lucide-solid";

interface DocumentTabsProps {
  templates: AITemplate[];
  documents: AIDocument[];
  activeTab: string; // "content" or a template ID
  onTabChange: (tab: string) => void;
  onGenerateAll: () => void;
  onAddCustom: () => void;
  generatingAll: boolean;
  hasContent: boolean;
}

export default function DocumentTabs(props: DocumentTabsProps) {
  const allGenerated = () =>
    props.templates.every((t) =>
      props.documents.some((d) => d.templateId === t.id),
    );

  return (
    <div class="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
      {/* Content tab — always first */}
      <button
        class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
          props.activeTab === "content"
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        onClick={() => props.onTabChange("content")}
      >
        Content
      </button>

      {/* Template tabs */}
      <For each={props.templates}>
        {(template) => {
          const hasDoc = () =>
            props.documents.some((d) => d.templateId === template.id);
          return (
            <button
              class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                props.activeTab === template.id
                  ? "bg-primary text-primary-foreground"
                  : hasDoc()
                    ? "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "bg-muted/20 text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground"
              }`}
              onClick={() => props.onTabChange(template.id)}
            >
              {template.name}
            </button>
          );
        }}
      </For>

      {/* + Custom button */}
      <button
        class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap bg-muted/20 text-muted-foreground/40 border border-dashed border-muted-foreground/15 hover:bg-muted/30 hover:text-muted-foreground"
        onClick={props.onAddCustom}
      >
        <Plus size={12} class="inline -mt-px mr-0.5" />
        Custom
      </button>

      {/* Generate All — right-aligned */}
      <Show when={props.hasContent && !allGenerated()}>
        <button
          class="ml-auto px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
          onClick={props.onGenerateAll}
          disabled={props.generatingAll}
        >
          <Zap size={12} class="inline -mt-px mr-0.5" />
          {props.generatingAll ? "Generating..." : "Generate All"}
        </button>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/extension/components/detail/DocumentView.tsx`**

This component handles the three states of an AI document view: not generated, generating, and generated.

```tsx
import { createSignal, Show } from "solid-js";
import { Loader2, RefreshCw, Copy, Check } from "lucide-solid";
import { marked } from "marked";
import type { AITemplate, AIDocument } from "@/lib/types";

interface DocumentViewProps {
  template: AITemplate;
  document: AIDocument | undefined;
  generating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export default function DocumentView(props: DocumentViewProps) {
  const [copied, setCopied] = createSignal(false);

  const htmlContent = () => {
    if (!props.document?.content) return "";
    return marked.parse(props.document.content, { async: false }) as string;
  };

  const handleCopy = () => {
    if (!props.document?.content) return;
    navigator.clipboard.writeText(props.document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Generating state */}
      <Show when={props.generating}>
        <div class="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={24} class="text-sky-400 animate-spin" />
          <p class="text-sm text-muted-foreground">
            Generating {props.template.name.toLowerCase()}...
          </p>
        </div>
      </Show>

      {/* Not generated state */}
      <Show when={!props.generating && !props.document}>
        <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <p class="text-sm">
            Generate a {props.template.name.toLowerCase()} of this content
          </p>
          <button
            onClick={props.onGenerate}
            class="px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-sm font-medium transition-colors"
          >
            Generate
          </button>
        </div>
      </Show>

      {/* Generated state */}
      <Show when={!props.generating && props.document}>
        <div class="px-2 pb-12">
          {/* Actions bar */}
          <div class="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={props.onRegenerate}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
            <button
              onClick={handleCopy}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              {copied() ? <Check size={12} /> : <Copy size={12} />}
              {copied() ? "Copied" : "Copy"}
            </button>
          </div>
          <div
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/extension/components/detail/CustomPromptView.tsx`**

This component handles the "+ Custom" tab — a text input for the user's prompt, a run button, and the result display.

```tsx
import { createSignal, Show } from "solid-js";
import { Loader2, Copy, Check } from "lucide-solid";
import { marked } from "marked";

interface CustomPromptViewProps {
  onCreateTemplate: (name: string, prompt: string) => Promise<void>;
  generating: boolean;
  result: string | null;
}

export default function CustomPromptView(props: CustomPromptViewProps) {
  const [prompt, setPrompt] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  const htmlContent = () => {
    if (!props.result) return "";
    return marked.parse(props.result, { async: false }) as string;
  };

  const handleRun = () => {
    const text = prompt().trim();
    if (!text) return;
    const name = text.slice(0, 30) + (text.length > 30 ? "..." : "");
    props.onCreateTemplate(name, text);
  };

  const handleCopy = () => {
    if (!props.result) return;
    navigator.clipboard.writeText(props.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="px-2 pb-12">
      <div class="mb-4">
        <textarea
          class="w-full bg-muted/30 text-sm text-foreground rounded-lg px-3 py-2.5 outline-none focus:bg-muted/40 transition-colors resize-none placeholder:text-muted-foreground/30"
          rows={3}
          maxLength={500}
          placeholder="Describe what you want to extract or generate from this content..."
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          disabled={props.generating}
        />
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-muted-foreground/40">
            {prompt().length}/500
          </span>
          <button
            onClick={handleRun}
            disabled={!prompt().trim() || props.generating}
            class="px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {props.generating ? "Generating..." : "Run"}
          </button>
        </div>
      </div>

      <Show when={props.generating}>
        <div class="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={24} class="text-sky-400 animate-spin" />
          <p class="text-sm text-muted-foreground">Generating...</p>
        </div>
      </Show>

      <Show when={!props.generating && props.result}>
        <div>
          <div class="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={handleCopy}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              {copied() ? <Check size={12} /> : <Copy size={12} />}
              {copied() ? "Copied" : "Copy"}
            </button>
          </div>
          <div
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 4: Integrate into `DetailPage.tsx`**

This is a significant modification to `apps/extension/components/detail/DetailPage.tsx`. The changes:

1. Import the new components and db functions
2. Add state for templates, documents, active tab, and generation
3. Add the pill tab bar between the hero and content
4. Switch content area based on active tab
5. Wire up generate/regenerate handlers

Add these imports at the top:

```ts
import { v4 as uuidv4 } from "uuid";
import type { AITemplate, AIDocument } from "@/lib/types";
import { getAllTemplates, getDocumentsForTab, putDocument, putTemplate } from "@/lib/db";
import { generateDocument } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import DocumentTabs from "./DocumentTabs";
import DocumentView from "./DocumentView";
import CustomPromptView from "./CustomPromptView";
```

Add these signals inside the `DetailPage` component function, after the existing signals:

```ts
const [templates, setTemplates] = createSignal<AITemplate[]>([]);
const [documents, setDocuments] = createSignal<AIDocument[]>([]);
const [activeDocTab, setActiveDocTab] = createSignal<string>("content");
const [generatingIds, setGeneratingIds] = createSignal<Set<string>>(new Set());
const [generatingAll, setGeneratingAll] = createSignal(false);
const [customGenerating, setCustomGenerating] = createSignal(false);
const [customResult, setCustomResult] = createSignal<string | null>(null);
```

Add a data loader in the `onMount` callback (inside the existing onMount, after the existing code):

```ts
// Load AI templates and documents
(async () => {
  const [tmpl, docs] = await Promise.all([
    getAllTemplates(),
    getDocumentsForTab(props.tab.id),
  ]);
  setTemplates(tmpl.filter((t) => t.isEnabled));
  setDocuments(docs);
})();
```

Add these handler functions inside the component:

```ts
const handleGenerate = async (template: AITemplate) => {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) return;

  setGeneratingIds((prev) => new Set([...prev, template.id]));
  try {
    const content = transcriptSegments().length > 0
      ? transcriptSegments().map((s) => s.text).join(" ")
      : markdownContent();
    const contentType = transcriptSegments().length > 0 ? "transcript" : "markdown" as const;
    const model = template.model || settings.aiModel;

    const result = await generateDocument(
      settings.openRouterApiKey,
      model,
      template.prompt,
      content,
      contentType,
    );

    const doc: AIDocument = {
      id: uuidv4(),
      tabId: props.tab.id,
      templateId: template.id,
      content: result,
      generatedAt: new Date().toISOString(),
      promptUsed: template.prompt,
    };
    await putDocument(doc);
    setDocuments(await getDocumentsForTab(props.tab.id));
  } catch (e) {
    console.error(`Failed to generate ${template.name}:`, e);
  } finally {
    setGeneratingIds((prev) => {
      const next = new Set(prev);
      next.delete(template.id);
      return next;
    });
  }
};

const handleGenerateAll = async () => {
  setGeneratingAll(true);
  const ungeneratedTemplates = templates().filter(
    (t) => !documents().some((d) => d.templateId === t.id),
  );
  await Promise.allSettled(ungeneratedTemplates.map((t) => handleGenerate(t)));
  setGeneratingAll(false);
};

const handleCreateCustomTemplate = async (name: string, prompt: string) => {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) return;

  const template: AITemplate = {
    id: uuidv4(),
    name,
    prompt,
    isBuiltin: false,
    defaultPrompt: null,
    isEnabled: true,
    sortOrder: templates().length + 1,
    model: null,
  };
  await putTemplate(template);

  setCustomGenerating(true);
  try {
    const content = transcriptSegments().length > 0
      ? transcriptSegments().map((s) => s.text).join(" ")
      : markdownContent();
    const contentType = transcriptSegments().length > 0 ? "transcript" : "markdown" as const;

    const result = await generateDocument(
      settings.openRouterApiKey,
      settings.aiModel,
      prompt,
      content,
      contentType,
    );

    const doc: AIDocument = {
      id: uuidv4(),
      tabId: props.tab.id,
      templateId: template.id,
      content: result,
      generatedAt: new Date().toISOString(),
      promptUsed: prompt,
    };
    await putDocument(doc);
    setCustomResult(result);

    // Refresh templates and documents
    const [tmpl, docs] = await Promise.all([
      getAllTemplates(),
      getDocumentsForTab(props.tab.id),
    ]);
    setTemplates(tmpl.filter((t) => t.isEnabled));
    setDocuments(docs);
    // Switch to the new template's tab
    setActiveDocTab(template.id);
  } catch (e) {
    console.error("Custom generation failed:", e);
  } finally {
    setCustomGenerating(false);
  }
};
```

Now modify the JSX. The pill tab bar goes right after the narrow TOC dropdown `<Show>` block and before the scrollable area `<div ref={scrollRef}>`. Insert it as a sibling right before the `{/* Scrollable area */}` comment:

```tsx
{/* AI Document Tabs */}
<Show when={hasContent() && templates().length > 0}>
  <DocumentTabs
    templates={templates()}
    documents={documents()}
    activeTab={activeDocTab()}
    onTabChange={setActiveDocTab}
    onGenerateAll={handleGenerateAll}
    onAddCustom={() => setActiveDocTab("custom")}
    generatingAll={generatingAll()}
    hasContent={hasContent()}
  />
</Show>
```

Then, in the content area where `<ContentView />` is rendered (inside `{/* Article / Transcript content */}`), wrap it in a conditional:

```tsx
{/* Article / Transcript / AI Document content */}
<div class="pb-6">
  <Show when={activeDocTab() === "content"}>
    <ContentView />
  </Show>
  <Show when={activeDocTab() === "custom"}>
    <CustomPromptView
      onCreateTemplate={handleCreateCustomTemplate}
      generating={customGenerating()}
      result={customResult()}
    />
  </Show>
  {templates().map((template) => (
    <Show when={activeDocTab() === template.id}>
      <DocumentView
        template={template}
        document={documents().find((d) => d.templateId === template.id)}
        generating={generatingIds().has(template.id)}
        onGenerate={() => handleGenerate(template)}
        onRegenerate={() => handleGenerate(template)}
      />
    </Show>
  ))}
</div>
```

- [ ] **Step 5: Update TOC to respond to active tab**

In the `createEffect` that extracts TOC entries, update it to only scan headings when on the "content" tab or an AI document tab with rendered HTML. The TOC already scans `scrollRef` for headings, so it will naturally pick up headings from whichever view is rendered. No change needed — the existing effect already does `requestAnimationFrame` after content changes, which will pick up the AI document headings. Just ensure the effect also tracks `activeDocTab()`:

In the `createEffect` that starts with `// Extract TOC entries from rendered headings`, add `activeDocTab()` to the tracked signals:

```ts
createEffect(() => {
  markdownContent();
  transcriptSegments();
  activeDocTab(); // Re-scan TOC when tab changes
  // ... rest of effect unchanged
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/extension/components/detail/DocumentTabs.tsx apps/extension/components/detail/DocumentView.tsx apps/extension/components/detail/CustomPromptView.tsx apps/extension/components/detail/DetailPage.tsx
git commit -m "feat: add AI document pill tabs and generation views to detail page"
```

---

### Task 7: Settings Reorganization — Pill Tabs

**Files:**
- Modify: `apps/extension/components/SettingsPanel.tsx`

Reorganize the settings page into pill tabs: General, AI, Sync, Blocked Domains, Data, Danger Zone.

- [ ] **Step 1: Add pill tab state and navigation**

At the top of the `SettingsPanel` component, add a signal for the active settings tab:

```ts
type SettingsTab = "general" | "ai" | "sync" | "domains" | "data";
const [activeSettingsTab, setActiveSettingsTab] = createSignal<SettingsTab>("general");
```

- [ ] **Step 2: Replace section headers with pill tab bar**

Replace the current flat layout with a pill tab bar after the header, then conditionally render each section. The pill tab bar goes right after the header `<div class="bg-muted/30 ...">` and before the `<Show when={settings()}>`:

```tsx
{/* Settings tab bar */}
<div class="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide max-w-2xl mx-auto">
  {(
    [
      ["general", "General"],
      ["ai", "AI"],
      ["sync", "Sync"],
      ["domains", "Blocked Domains"],
      ["data", "Data"],
    ] as const
  ).map(([key, label]) => (
    <button
      class={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
        activeSettingsTab() === key
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={() => setActiveSettingsTab(key)}
    >
      {label}
    </button>
  ))}
</div>
```

Then wrap each existing section in a `<Show when={activeSettingsTab() === "..."}>`. Remove the section header `<p>` elements (the ones with uppercase tracking) since the pill tabs replace them.

The General tab shows: Browser/Profile Name.

The AI tab shows: OpenRouter API Key, Model selection, and the template management (Task 8).

The Sync tab shows: `<SyncConfigPanel>`.

The Blocked Domains tab shows: `<BlockedDomainsManager>`.

The Data tab shows: Export/Import buttons, keyboard shortcuts, and the Danger Zone.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/SettingsPanel.tsx
git commit -m "feat: reorganize settings into pill tabs"
```

---

### Task 8: Template Management UI in Settings

**Files:**
- Create: `apps/extension/components/settings/TemplateManager.tsx`
- Modify: `apps/extension/components/SettingsPanel.tsx`

- [ ] **Step 1: Create `apps/extension/components/settings/TemplateManager.tsx`**

```tsx
import { createSignal, createResource, For, Show } from "solid-js";
import { v4 as uuidv4 } from "uuid";
import { ChevronDown, ChevronRight, RotateCcw, Trash2, Plus, GripVertical } from "lucide-solid";
import { getAllTemplates, putTemplate, deleteTemplate } from "@/lib/db";
import { getDefaultPrompt } from "@/lib/templates";
import type { AITemplate } from "@/lib/types";

export default function TemplateManager() {
  const [templates, { refetch }] = createResource(getAllTemplates);
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  const handleToggle = async (template: AITemplate) => {
    await putTemplate({ ...template, isEnabled: !template.isEnabled });
    refetch();
  };

  const handleSave = async (template: AITemplate, updates: Partial<AITemplate>) => {
    await putTemplate({ ...template, ...updates });
    refetch();
  };

  const handleReset = async (template: AITemplate) => {
    if (!template.defaultPrompt) return;
    await putTemplate({ ...template, prompt: template.defaultPrompt });
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    if (expandedId() === id) setExpandedId(null);
    refetch();
  };

  const handleAdd = async () => {
    const sortOrder = (templates()?.length ?? 0) + 1;
    const template: AITemplate = {
      id: uuidv4(),
      name: "New Template",
      prompt: "",
      isBuiltin: false,
      defaultPrompt: null,
      isEnabled: true,
      sortOrder,
      model: null,
    };
    await putTemplate(template);
    refetch();
    setExpandedId(template.id);
  };

  const isModified = (template: AITemplate) =>
    template.isBuiltin && template.defaultPrompt !== null && template.prompt !== template.defaultPrompt;

  return (
    <div>
      <div class="text-sm font-medium text-foreground mb-3">Prompt Templates</div>
      <div class="space-y-1">
        <For each={templates()}>
          {(template) => (
            <div class="bg-muted/20 rounded-lg overflow-hidden">
              {/* Row header */}
              <div class="flex items-center gap-2 px-3 py-2.5">
                <GripVertical size={14} class="text-muted-foreground/30 flex-shrink-0 cursor-grab" />
                <button
                  class="flex-1 text-left text-sm text-foreground truncate"
                  onClick={() => setExpandedId(expandedId() === template.id ? null : template.id)}
                >
                  <span class="flex items-center gap-2">
                    {expandedId() === template.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {template.name}
                    <Show when={isModified(template)}>
                      <span class="text-[10px] text-amber-400/70 font-medium">modified</span>
                    </Show>
                  </span>
                </button>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={template.isEnabled}
                    onChange={() => handleToggle(template)}
                    class="sr-only peer"
                  />
                  <div class="w-8 h-4.5 bg-muted-foreground/20 peer-checked:bg-sky-500/50 rounded-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-foreground after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3.5" />
                </label>
              </div>

              {/* Expanded editor */}
              <Show when={expandedId() === template.id}>
                <div class="px-3 pb-3 space-y-3 border-t border-muted-foreground/5">
                  <div class="pt-3">
                    <label class="block text-xs text-muted-foreground mb-1">Name</label>
                    <input
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                      value={template.name}
                      onChange={(e) => handleSave(template, { name: e.currentTarget.value })}
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-muted-foreground mb-1">Prompt</label>
                    <textarea
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors resize-none"
                      rows={4}
                      maxLength={template.isBuiltin ? undefined : 500}
                      value={template.prompt}
                      onChange={(e) => handleSave(template, { prompt: e.currentTarget.value })}
                    />
                    <Show when={!template.isBuiltin}>
                      <div class="text-xs text-muted-foreground/40 mt-1 text-right">
                        {template.prompt.length}/500
                      </div>
                    </Show>
                  </div>
                  <div class="flex items-center gap-2">
                    <Show when={isModified(template)}>
                      <button
                        onClick={() => handleReset(template)}
                        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
                      >
                        <RotateCcw size={12} />
                        Reset to Default
                      </button>
                    </Show>
                    <Show when={!template.isBuiltin}>
                      <button
                        onClick={() => handleDelete(template.id)}
                        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors ml-auto"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
      <button
        onClick={handleAdd}
        class="flex items-center gap-1.5 mt-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
      >
        <Plus size={14} />
        Add Template
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add TemplateManager to the AI tab in SettingsPanel**

In `apps/extension/components/SettingsPanel.tsx`, import and render:

```ts
import TemplateManager from "./settings/TemplateManager";
```

In the AI tab section, after the Model select, add:

```tsx
<div class="pt-2">
  <TemplateManager />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/settings/TemplateManager.tsx apps/extension/components/SettingsPanel.tsx
git commit -m "feat: add template management UI in settings AI tab"
```

---

### Task 9: Sync Payload Updates

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/extension/lib/sync.ts`
- Modify: `apps/extension/entrypoints/background.ts`

- [ ] **Step 1: Add AITemplate and AIDocument to shared types**

Add these interfaces to `packages/shared/src/types.ts`:

```ts
export interface AITemplate {
  id: string;
  name: string;
  prompt: string;
  isBuiltin: boolean;
  defaultPrompt: string | null;
  isEnabled: boolean;
  sortOrder: number;
  model: string | null;
}

export interface AIDocument {
  id: string;
  tabId: string;
  templateId: string;
  content: string;
  generatedAt: string;
  promptUsed: string;
}
```

Update `SyncPayload` to include the new fields as optional (for backward compatibility):

```ts
export interface SyncPayload {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  aiTemplates?: AITemplate[];
  aiDocuments?: AIDocument[];
  settings?: {
    aiModel: string;
    encryptedApiKey: string | null;
  };
  lastSyncedAt: string;
}
```

- [ ] **Step 2: Update sync push in background.ts**

In the `syncPush` function in `apps/extension/entrypoints/background.ts`, update the payload construction to include the new stores:

```ts
const data = await getAllData();
await pushSync({
  tabs: data.tabs,
  groups: data.groups,
  captures: data.captures,
  aiTemplates: data.aiTemplates,
  aiDocuments: data.aiDocuments,
  lastSyncedAt: new Date().toISOString(),
});
```

- [ ] **Step 3: Update sync pull to import new data**

In the `syncPullIfNeeded` function, after importing tabs/groups/captures from the remote payload, also import the new stores. Add after the existing `importData` call:

```ts
if (remote.aiTemplates?.length) {
  const { putTemplates } = await import("@/lib/db");
  await putTemplates(remote.aiTemplates);
}
if (remote.aiDocuments?.length) {
  const { putDocument } = await import("@/lib/db");
  for (const doc of remote.aiDocuments) {
    await putDocument(doc);
  }
}
```

- [ ] **Step 4: Update extension types re-export**

In `apps/extension/lib/types.ts`, add the new types to the re-export:

```ts
import type { Tab, Group, Capture, SyncPayload, AITemplate, AIDocument } from "@tab-zen/shared";
export type { Tab, Group, Capture, SyncPayload, AITemplate, AIDocument };
```

Remove the duplicate `AITemplate` and `AIDocument` interfaces from `apps/extension/lib/types.ts` (from Task 1) since they now come from shared. Keep only the re-export.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts apps/extension/lib/sync.ts apps/extension/entrypoints/background.ts apps/extension/lib/types.ts
git commit -m "feat: include AI templates and documents in sync payload"
```

---

### Task 10: API — Store & Serve AI Documents

**Files:**
- Modify: `apps/api/src/services/content-service.ts`
- Modify: `apps/api/src/routes/content.ts`

The API needs routes to store/retrieve AI documents in R2 so sync can persist them server-side.

- [ ] **Step 1: Add AI document storage methods to ContentService**

Add these methods to the `ContentService` class in `apps/api/src/services/content-service.ts`:

```ts
async storeAIDocuments(syncToken: string, documents: any[]): Promise<void> {
  const key = `${syncToken}/ai-documents.json`;
  await this.r2.put(key, JSON.stringify(documents), {
    httpMetadata: { contentType: "application/json" },
  });
}

async getAIDocuments(syncToken: string): Promise<any[] | null> {
  const key = `${syncToken}/ai-documents.json`;
  const object = await this.r2.get(key);
  if (!object) return null;
  return object.json();
}

async storeAITemplates(syncToken: string, templates: any[]): Promise<void> {
  const key = `${syncToken}/ai-templates.json`;
  await this.r2.put(key, JSON.stringify(templates), {
    httpMetadata: { contentType: "application/json" },
  });
}

async getAITemplates(syncToken: string): Promise<any[] | null> {
  const key = `${syncToken}/ai-templates.json`;
  const object = await this.r2.get(key);
  if (!object) return null;
  return object.json();
}
```

- [ ] **Step 2: Update the sync routes to handle AI data**

The sync push/pull routes in `apps/api/src/routes/sync.ts` need to persist and return `aiTemplates` and `aiDocuments` from the payload. Find the sync push handler and add storage calls for the new fields:

After the existing data storage in the push handler, add:

```ts
if (body.aiTemplates?.length) {
  await contentService.storeAITemplates(token, body.aiTemplates);
}
if (body.aiDocuments?.length) {
  await contentService.storeAIDocuments(token, body.aiDocuments);
}
```

In the pull handler, include the AI data in the response:

```ts
const aiTemplates = await contentService.getAITemplates(token);
const aiDocuments = await contentService.getAIDocuments(token);
// Include in the response object
return c.json({
  ...existingResponse,
  aiTemplates: aiTemplates || [],
  aiDocuments: aiDocuments || [],
});
```

Note: Read the actual sync route code before implementing — the exact modification depends on how the existing push/pull handlers are structured.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/content-service.ts apps/api/src/routes/sync.ts
git commit -m "feat: add AI template and document storage to API sync"
```

---

### Task 11: Wire Up & Smoke Test

**Files:** No new files — verification only.

- [ ] **Step 1: Build the extension**

Run: `cd apps/extension && pnpm build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Load the extension in Chrome**

Load the unpacked extension from `apps/extension/.output/chrome-mv3/`.

- [ ] **Step 3: Verify template seeding**

Open the extension, go to Settings > AI tab. Verify 5 built-in templates appear in the template list: Summary, Key Points, Action Items, ELI5, Products & Mentions.

- [ ] **Step 4: Verify document generation**

Open a saved tab's detail page that has content (transcript or article). Verify:
- Pill tabs appear with Content + 5 template tabs + Custom
- Clicking a template tab shows "Generate" button
- Clicking Generate produces output
- "Generate All" generates remaining templates in parallel
- Regenerate re-runs the prompt

- [ ] **Step 5: Verify custom template**

Click "+ Custom", type a prompt, click Run. Verify:
- Output appears
- The custom template shows up in Settings > AI > Templates
- The custom template appears as a pill tab on reload

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
