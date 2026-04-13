# Chat Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-facing chat skills — markdown prompt templates that modify LLM behavior per-conversation, with built-in skills, custom skill authoring, default skills in settings, and a skill picker in the chat input area.

**Architecture:** Skills are markdown files (built-in) or IndexedDB records (custom) that inject instructions into the system prompt. Each conversation tracks which skills are active. The context manager appends active skill prompts to the system prompt before sending to the LLM. A skill picker dropdown in the chat input area lets users toggle skills per-conversation. Settings lets users set default skills and create/edit/delete custom skills.

**Tech Stack:** SolidJS, IndexedDB (idb), Vite `?raw` imports for built-in skills, existing chat services

---

## File Structure

### apps/extension/prompts/chat-skills/ (new directory)

```
apps/extension/prompts/chat-skills/
├── concise.md          # Short, direct answers
├── detailed.md         # Thorough, comprehensive responses
├── eli5.md             # Explain like I'm 5
├── socratic.md         # Ask questions instead of answering
└── caveman.md          # Terse caveman-style responses
```

### apps/extension/lib/chat/ (new + modified)

```
apps/extension/lib/chat/
├── chat-skills.ts              # NEW — skill types, built-in loader, CRUD for custom skills
├── chat-db.ts                  # MODIFY — add skills store (v3)
├── chat-context-manager.ts     # MODIFY — accept active skills, inject into system prompt
├── chat-store.ts               # MODIFY — track active skills per conversation
└── chat-adapter.ts             # MODIFY — persist active skills on conversation
```

### apps/extension/components/detail/ (new + modified)

```
apps/extension/components/detail/
├── ChatSkillPicker.tsx         # NEW — dropdown for toggling skills
├── ChatPanelContent.tsx        # MODIFY — add skill picker, pass skills to context manager
├── ChatDebugPanel.tsx          # MODIFY — show active skills
└── ChatSkillEditor.tsx         # NEW — create/edit custom skills (modal)
```

### apps/extension/components/settings/ (new)

```
apps/extension/components/settings/
└── SkillManager.tsx            # NEW — manage custom skills + defaults in settings
```

---

## Phase 1: Built-in Skills & Data Layer

### Task 1: Built-in Skill Prompt Files

**Files:**
- Create: `apps/extension/prompts/chat-skills/concise.md`
- Create: `apps/extension/prompts/chat-skills/detailed.md`
- Create: `apps/extension/prompts/chat-skills/eli5.md`
- Create: `apps/extension/prompts/chat-skills/socratic.md`
- Create: `apps/extension/prompts/chat-skills/caveman.md`

- [ ] **Step 1: Create concise.md**

```markdown
---
name: Concise
description: Short, direct answers. No fluff.
icon: minus-circle
---

Respond concisely. Use short sentences. No filler words, no pleasantries, no unnecessary context. Get straight to the point. If a one-word answer suffices, use it. Bullet points over paragraphs when listing things.
```

- [ ] **Step 2: Create detailed.md**

```markdown
---
name: Detailed
description: Thorough, comprehensive responses with examples.
icon: book-open
---

Respond with thorough, comprehensive answers. Include relevant context, examples, and nuance. Explain your reasoning. When referencing the document, quote specific passages. Structure longer responses with headings or bullet points for clarity.
```

- [ ] **Step 3: Create eli5.md**

```markdown
---
name: ELI5
description: Explain simply, avoid jargon.
icon: baby
---

Explain everything as simply as possible. Avoid jargon and technical terms — if you must use one, define it immediately. Use analogies and everyday comparisons. Assume the reader has no background in this topic. Short paragraphs, simple words.
```

- [ ] **Step 4: Create socratic.md**

```markdown
---
name: Socratic
description: Ask guiding questions instead of giving direct answers.
icon: help-circle
---

Instead of giving direct answers, guide the user to discover the answer themselves through thoughtful questions. Ask one question at a time. When the user answers, build on their response with follow-up questions. Only provide direct information if the user explicitly asks you to stop asking questions.
```

- [ ] **Step 5: Create caveman.md**

```markdown
---
name: Caveman
description: Ultra-compressed terse responses. Save tokens.
icon: zap
---

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Drop: articles (a/an/the), filler (just/really/basically), pleasantries (sure/certainly), hedging. Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for"). Technical terms exact.

Pattern: [thing] [action] [reason]. [next step].

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use < not <=. Fix:"
```

- [ ] **Step 6: Commit**

```bash
git add apps/extension/prompts/chat-skills/
git commit -m "feat(chat): add built-in chat skill prompt templates"
```

---

### Task 2: Skills Data Layer

**Files:**
- Create: `apps/extension/lib/chat/chat-skills.ts`
- Modify: `apps/extension/lib/chat/chat-db.ts`

- [ ] **Step 1: Add skills store to chat-db.ts**

Add the `ChatSkill` interface after the `CompressedContent` interface:

```typescript
export interface ChatSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
  isBuiltin: boolean;
  isDefault: boolean; // on by default for new conversations
  createdAt: string;
}
```

Add the new store to the `ChatDB` interface:

```typescript
  skills: {
    key: string;
    value: ChatSkill;
  };
```

Bump the DB version to 3 and add the upgrade:

```typescript
export async function getChatDB(): Promise<IDBPDatabase<ChatDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatDB>('tab-zen-chat', 3, {
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
      if (oldVersion < 3) {
        db.createObjectStore('skills', { keyPath: 'id' });
      }
    },
  });
  return dbInstance;
}
```

- [ ] **Step 2: Create chat-skills.ts**

```typescript
// apps/extension/lib/chat/chat-skills.ts
import { getChatDB, type ChatSkill } from "./chat-db";

// @ts-ignore — Vite raw imports
import conciseRaw from "@/prompts/chat-skills/concise.md?raw";
// @ts-ignore
import detailedRaw from "@/prompts/chat-skills/detailed.md?raw";
// @ts-ignore
import eli5Raw from "@/prompts/chat-skills/eli5.md?raw";
// @ts-ignore
import socraticRaw from "@/prompts/chat-skills/socratic.md?raw";
// @ts-ignore
import cavemanRaw from "@/prompts/chat-skills/caveman.md?raw";

interface ParsedSkillFrontmatter {
  name: string;
  description: string;
  icon: string;
}

function parseSkillFile(raw: string): { frontmatter: ParsedSkillFrontmatter; prompt: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: { name: "Unknown", description: "", icon: "sparkles" }, prompt: raw.trim() };

  const fmBlock = fmMatch[1];
  const prompt = fmMatch[2].trim();

  const name = fmBlock.match(/name:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
  const description = fmBlock.match(/description:\s*(.+)/)?.[1]?.trim() ?? "";
  const icon = fmBlock.match(/icon:\s*(.+)/)?.[1]?.trim() ?? "sparkles";

  return { frontmatter: { name, description, icon }, prompt };
}

const BUILTIN_RAW: Record<string, string> = {
  "builtin-concise": conciseRaw,
  "builtin-detailed": detailedRaw,
  "builtin-eli5": eli5Raw,
  "builtin-socratic": socraticRaw,
  "builtin-caveman": cavemanRaw,
};

function buildBuiltinSkills(): ChatSkill[] {
  return Object.entries(BUILTIN_RAW).map(([id, raw]) => {
    const { frontmatter, prompt } = parseSkillFile(raw);
    return {
      id,
      name: frontmatter.name,
      description: frontmatter.description,
      icon: frontmatter.icon,
      prompt,
      isBuiltin: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
  });
}

let builtinSkillsCache: ChatSkill[] | null = null;

export function getBuiltinSkills(): ChatSkill[] {
  if (!builtinSkillsCache) {
    builtinSkillsCache = buildBuiltinSkills();
  }
  return builtinSkillsCache;
}

export async function getCustomSkills(): Promise<ChatSkill[]> {
  const db = await getChatDB();
  const all = await db.getAll("skills");
  return all.filter((s) => !s.isBuiltin);
}

export async function getAllSkills(): Promise<ChatSkill[]> {
  const builtins = getBuiltinSkills();
  const custom = await getCustomSkills();
  return [...builtins, ...custom];
}

export async function getDefaultSkillIds(): Promise<string[]> {
  const all = await getAllSkills();
  return all.filter((s) => s.isDefault).map((s) => s.id);
}

export async function saveCustomSkill(skill: ChatSkill): Promise<void> {
  const db = await getChatDB();
  await db.put("skills", { ...skill, isBuiltin: false });
}

export async function deleteCustomSkill(skillId: string): Promise<void> {
  const db = await getChatDB();
  await db.delete("skills", skillId);
}

export async function setSkillDefault(skillId: string, isDefault: boolean): Promise<void> {
  // For builtins, we store a copy in the DB with the isDefault flag
  const builtins = getBuiltinSkills();
  const builtin = builtins.find((s) => s.id === skillId);
  if (builtin) {
    const db = await getChatDB();
    await db.put("skills", { ...builtin, isDefault });
    return;
  }

  // For custom skills, update in place
  const db = await getChatDB();
  const existing = await db.get("skills", skillId);
  if (existing) {
    existing.isDefault = isDefault;
    await db.put("skills", existing);
  }
}

export function getSkillById(skillId: string, allSkills: ChatSkill[]): ChatSkill | undefined {
  return allSkills.find((s) => s.id === skillId);
}

/**
 * Builds the combined skill prompt text from a list of active skill IDs.
 */
export function buildSkillPrompt(activeSkillIds: string[], allSkills: ChatSkill[]): string {
  if (activeSkillIds.length === 0) return "";

  const prompts = activeSkillIds
    .map((id) => getSkillById(id, allSkills))
    .filter((s): s is ChatSkill => s !== undefined)
    .map((s) => s.prompt);

  if (prompts.length === 0) return "";

  return "\n\n## Active Skills\n\n" + prompts.join("\n\n---\n\n");
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/chat/chat-db.ts apps/extension/lib/chat/chat-skills.ts
git commit -m "feat(chat): add skills data layer with built-in loader and custom CRUD"
```

---

### Task 3: Update Context Manager for Skills

**Files:**
- Modify: `apps/extension/lib/chat/chat-context-manager.ts`

- [ ] **Step 1: Add skills to preparePayload**

Update the `preparePayload` function signature to accept an optional `skillPrompt` parameter:

```typescript
export function preparePayload(
  documentContext: DocumentChatContext,
  conversationMessages: ChatMessage[],
  existingSummary: string | null,
  modelId: string,
  compressionInfo?: { originalTokens: number; compressedTokens: number },
  skillPrompt?: string,
): PreparedPayload {
```

Update the system prompt construction to append the skill prompt:

```typescript
  let systemPrompt = buildFullSystemPrompt(documentContext);
  if (skillPrompt) {
    systemPrompt += skillPrompt;
  }
  const systemPromptTokens = estimateTokens(systemPrompt);
```

(Change `const systemPrompt` to `let systemPrompt` and add the skill append.)

Add `activeSkillCount` to the `ContextSnapshot` interface:

```typescript
  activeSkillCount: number;
  skillTokens: number;
```

And populate them in the snapshot:

```typescript
      activeSkillCount: skillPrompt ? skillPrompt.split("---").length : 0,
      skillTokens: skillPrompt ? estimateTokens(skillPrompt) : 0,
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/chat/chat-context-manager.ts
git commit -m "feat(chat): add skill prompt injection to context manager"
```

---

### Task 4: Track Active Skills Per Conversation

**Files:**
- Modify: `apps/extension/lib/chat/chat-adapter.ts`
- Modify: `apps/extension/lib/chat/chat-store.ts`

- [ ] **Step 1: Add activeSkillIds methods to ChatAdapter**

In `apps/extension/lib/chat/chat-adapter.ts`, add:

```typescript
  async getActiveSkillIds(conversationId: string): Promise<string[]> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    return (conv as any)?.activeSkillIds ?? [];
  }

  async setActiveSkillIds(conversationId: string, skillIds: string[]): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      (conv as any).activeSkillIds = skillIds;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }
```

- [ ] **Step 2: Add skills to chat-store.ts**

In `apps/extension/lib/chat/chat-store.ts`, add imports:

```typescript
import { getDefaultSkillIds } from './chat-skills';
```

Add a signal for active skill IDs after the `conversationSummary` signal:

```typescript
  const [activeSkillIds, setActiveSkillIds] = createSignal<string[]>([]);
```

In the existing `createEffect` that loads the summary when `activeConversationId` changes, also load skill IDs:

```typescript
  createEffect(() => {
    const id = activeConversationId();
    if (id) {
      adapter.getSummary(id).then((s) => setConversationSummary(s));
      adapter.getActiveSkillIds(id).then((ids) => setActiveSkillIds(ids));
    } else {
      setConversationSummary(null);
      setActiveSkillIds([]);
    }
  });
```

Update `createConversation` to set default skills:

```typescript
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

    // Set default skills
    const defaults = await getDefaultSkillIds();
    if (defaults.length > 0) {
      await adapter.setActiveSkillIds(id, defaults);
      setActiveSkillIds(defaults);
    }

    refreshList();
    setActiveConversationId(id);
    return id;
  }
```

Add a `toggleSkill` function:

```typescript
  async function toggleSkill(skillId: string) {
    const current = activeSkillIds();
    const id = activeConversationId();
    const updated = current.includes(skillId)
      ? current.filter((s) => s !== skillId)
      : [...current, skillId];
    setActiveSkillIds(updated);
    if (id) {
      await adapter.setActiveSkillIds(id, updated);
    }
  }
```

Add to the return object: `activeSkillIds`, `toggleSkill`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/chat/chat-adapter.ts apps/extension/lib/chat/chat-store.ts
git commit -m "feat(chat): track active skills per conversation with defaults"
```

---

## Phase 2: UI Components

### Task 5: Skill Picker Dropdown

**Files:**
- Create: `apps/extension/components/detail/ChatSkillPicker.tsx`

- [ ] **Step 1: Create the skill picker component**

```tsx
// apps/extension/components/detail/ChatSkillPicker.tsx
import { createSignal, createResource, Show, For } from "solid-js";
import { Sparkles, Check } from "lucide-solid";
import { getAllSkills } from "@/lib/chat/chat-skills";
import type { ChatSkill } from "@/lib/chat/chat-db";

interface ChatSkillPickerProps {
  activeSkillIds: string[];
  onToggleSkill: (skillId: string) => void;
}

export default function ChatSkillPicker(props: ChatSkillPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [skills] = createResource(getAllSkills);

  const activeCount = () => props.activeSkillIds.length;

  return (
    <div class="relative">
      <button
        onClick={() => setOpen(!open())}
        class={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
          activeCount() > 0
            ? "text-violet-400 bg-violet-400/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        title={activeCount() > 0 ? `${activeCount()} skill(s) active` : "Add skills"}
      >
        <Sparkles size={14} />
        <Show when={activeCount() > 0}>
          <span class="text-xs">{activeCount()}</span>
        </Show>
      </button>

      <Show when={open()}>
        {/* Backdrop */}
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)} />

        {/* Dropdown */}
        <div class="absolute bottom-full left-0 mb-2 z-50 w-64 bg-card rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
          <div class="px-3 py-2 bg-muted/30 text-xs font-semibold text-foreground">
            Skills
          </div>
          <div class="max-h-64 overflow-y-auto">
            <Show when={skills()} fallback={<div class="px-3 py-4 text-xs text-muted-foreground">Loading...</div>}>
              <For each={skills()}>
                {(skill: ChatSkill) => {
                  const isActive = () => props.activeSkillIds.includes(skill.id);
                  return (
                    <button
                      class={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors ${
                        isActive() ? "bg-violet-400/5" : ""
                      }`}
                      onClick={() => {
                        props.onToggleSkill(skill.id);
                      }}
                    >
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-foreground flex items-center gap-1.5">
                          {skill.name}
                          <Show when={!skill.isBuiltin}>
                            <span class="text-xs text-muted-foreground/50">custom</span>
                          </Show>
                        </div>
                        <div class="text-xs text-muted-foreground/60 truncate">{skill.description}</div>
                      </div>
                      <Show when={isActive()}>
                        <Check size={14} class="text-violet-400 flex-shrink-0" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatSkillPicker.tsx
git commit -m "feat(chat): add skill picker dropdown component"
```

---

### Task 6: Custom Skill Editor

**Files:**
- Create: `apps/extension/components/detail/ChatSkillEditor.tsx`

- [ ] **Step 1: Create the skill editor modal**

```tsx
// apps/extension/components/detail/ChatSkillEditor.tsx
import { createSignal, Show } from "solid-js";
import { X } from "lucide-solid";
import type { ChatSkill } from "@/lib/chat/chat-db";
import { saveCustomSkill } from "@/lib/chat/chat-skills";

interface ChatSkillEditorProps {
  skill?: ChatSkill; // undefined = creating new
  onClose: () => void;
  onSaved: () => void;
}

export default function ChatSkillEditor(props: ChatSkillEditorProps) {
  const [name, setName] = createSignal(props.skill?.name ?? "");
  const [description, setDescription] = createSignal(props.skill?.description ?? "");
  const [prompt, setPrompt] = createSignal(props.skill?.prompt ?? "");
  const [saving, setSaving] = createSignal(false);

  async function handleSave() {
    if (!name().trim() || !prompt().trim()) return;
    setSaving(true);

    const skill: ChatSkill = {
      id: props.skill?.id ?? `custom-${crypto.randomUUID()}`,
      name: name().trim(),
      description: description().trim(),
      icon: "sparkles",
      prompt: prompt().trim(),
      isBuiltin: false,
      isDefault: props.skill?.isDefault ?? false,
      createdAt: props.skill?.createdAt ?? new Date().toISOString(),
    };

    await saveCustomSkill(skill);
    setSaving(false);
    props.onSaved();
    props.onClose();
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
          <span class="text-sm font-semibold text-foreground">
            {props.skill ? "Edit Skill" : "Create Skill"}
          </span>
          <button onClick={props.onClose} class="p-1 rounded-md text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              type="text"
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., Code Reviewer"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Short description of what this skill does"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Prompt</label>
            <textarea
              class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 min-h-[120px] resize-y"
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              placeholder="Instructions for the AI when this skill is active..."
            />
          </div>
        </div>

        {/* Actions */}
        <div class="flex justify-end gap-2 px-4 py-3 bg-muted/10">
          <button
            onClick={props.onClose}
            class="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name().trim() || !prompt().trim() || saving()}
            class="px-3 py-1.5 rounded-lg text-sm bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {saving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/detail/ChatSkillEditor.tsx
git commit -m "feat(chat): add custom skill editor modal"
```

---

### Task 7: Skill Manager in Settings

**Files:**
- Create: `apps/extension/components/settings/SkillManager.tsx`
- Modify: `apps/extension/components/SettingsPanel.tsx`

- [ ] **Step 1: Create SkillManager component**

```tsx
// apps/extension/components/settings/SkillManager.tsx
import { createSignal, createResource, For, Show } from "solid-js";
import { Trash2, Plus, Star, StarOff, Pencil } from "lucide-solid";
import { getAllSkills, deleteCustomSkill, setSkillDefault } from "@/lib/chat/chat-skills";
import type { ChatSkill } from "@/lib/chat/chat-db";
import ChatSkillEditor from "@/components/detail/ChatSkillEditor";

export default function SkillManager() {
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [skills] = createResource(refreshKey, getAllSkills);
  const [editingSkill, setEditingSkill] = createSignal<ChatSkill | undefined>(undefined);
  const [showEditor, setShowEditor] = createSignal(false);

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleToggleDefault(skill: ChatSkill) {
    await setSkillDefault(skill.id, !skill.isDefault);
    refresh();
  }

  async function handleDelete(skillId: string) {
    await deleteCustomSkill(skillId);
    refresh();
  }

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-foreground">Chat Skills</h3>
          <p class="text-sm text-muted-foreground">Skills modify how the AI responds in chat conversations</p>
        </div>
        <button
          onClick={() => { setEditingSkill(undefined); setShowEditor(true); }}
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-violet-500 text-white hover:bg-violet-600 transition-colors"
        >
          <Plus size={12} />
          New Skill
        </button>
      </div>

      <Show when={skills()}>
        <div class="space-y-1">
          <For each={skills()}>
            {(skill: ChatSkill) => (
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-foreground flex items-center gap-1.5">
                    {skill.name}
                    <Show when={!skill.isBuiltin}>
                      <span class="text-xs text-muted-foreground/50">custom</span>
                    </Show>
                    <Show when={skill.isDefault}>
                      <span class="text-xs text-violet-400">default</span>
                    </Show>
                  </div>
                  <div class="text-xs text-muted-foreground/60 truncate">{skill.description}</div>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleDefault(skill)}
                    class="p-1 rounded text-muted-foreground hover:text-violet-400 transition-colors"
                    title={skill.isDefault ? "Remove from defaults" : "Set as default"}
                  >
                    <Show when={skill.isDefault} fallback={<StarOff size={14} />}>
                      <Star size={14} />
                    </Show>
                  </button>
                  <Show when={!skill.isBuiltin}>
                    <button
                      onClick={() => { setEditingSkill(skill); setShowEditor(true); }}
                      class="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      class="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={showEditor()}>
        <ChatSkillEditor
          skill={editingSkill()}
          onClose={() => setShowEditor(false)}
          onSaved={refresh}
        />
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Add SkillManager to SettingsPanel**

In `apps/extension/components/SettingsPanel.tsx`, add the import:

```typescript
import SkillManager from "@/components/settings/SkillManager";
```

Find the AI tab section. After the Groq API Key block (the last setting in the AI tab), add:

```tsx
                {/* Chat Skills */}
                <SkillManager />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/settings/SkillManager.tsx apps/extension/components/SettingsPanel.tsx
git commit -m "feat(chat): add skill manager to settings with default toggles and custom creation"
```

---

## Phase 3: Integration

### Task 8: Wire Skills into ChatPanelContent

**Files:**
- Modify: `apps/extension/components/detail/ChatPanelContent.tsx`

- [ ] **Step 1: Add imports**

```typescript
import ChatSkillPicker from "./ChatSkillPicker";
import { buildSkillPrompt, getAllSkills, type ChatSkill } from "@/lib/chat/chat-skills";
```

Add `createResource` to the solid-js import if not already there.

- [ ] **Step 2: Add skills resource and state**

After the existing signals, add:

```typescript
  const [allSkills] = createResource(getAllSkills);
```

- [ ] **Step 3: Update preparePayload call to include skills**

In `handleSendMessage`, after the `chatContext` line and before the `preparePayload` call, build the skill prompt:

```typescript
    const skillPrompt = buildSkillPrompt(props.store.activeSkillIds(), allSkills() ?? []);
```

Update the `preparePayload` call:

```typescript
    const { messages: llmMessages, snapshot } = preparePayload(
      chatContext,
      allMessages,
      props.store.conversationSummary(),
      currentModel(),
      compInfo ?? undefined,
      skillPrompt || undefined,
    );
```

Also update the compaction-path `preparePayload` call similarly.

- [ ] **Step 4: Add skill picker to input area**

In the input area, add the `ChatSkillPicker` inside the left `<div class="flex items-center gap-1">`, before the compression toggle:

```tsx
                <ChatSkillPicker
                  activeSkillIds={props.store.activeSkillIds()}
                  onToggleSkill={(id) => props.store.toggleSkill(id)}
                />
```

- [ ] **Step 5: Add active skills badges below the header**

After the header `</div>` and before the debug panel, add:

```tsx
        {/* Active skills */}
        <Show when={props.store.activeSkillIds().length > 0}>
          <div class="px-3 py-1 flex gap-1 flex-wrap flex-shrink-0">
            <For each={props.store.activeSkillIds()}>
              {(skillId) => {
                const skill = () => (allSkills() ?? []).find((s: ChatSkill) => s.id === skillId);
                return (
                  <Show when={skill()}>
                    <button
                      onClick={() => props.store.toggleSkill(skillId)}
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 transition-colors"
                    >
                      {skill()!.name}
                      <X size={10} />
                    </button>
                  </Show>
                );
              }}
            </For>
          </div>
        </Show>
```

Make sure `X` is imported from lucide-solid (it already is).

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): integrate skill picker, badges, and skill prompt injection"
```

---

### Task 9: Update Debug Panel with Skills

**Files:**
- Modify: `apps/extension/components/detail/ChatDebugPanel.tsx`

- [ ] **Step 1: Add skills section to debug panel**

In `ChatDebugPanel.tsx`, add to the props interface:

```typescript
  activeSkillNames: string[];
```

After the compression info `</Show>` and before the `{/* Sections */}` comment, add:

```tsx
      {/* Active skills */}
      <Show when={props.activeSkillNames.length > 0}>
        <div class="px-3 py-2 bg-violet-500/5 flex-shrink-0">
          <div class="flex justify-between text-xs">
            <span class="text-violet-400">Active skills</span>
            <span class="text-violet-400">{props.activeSkillNames.join(", ")}</span>
          </div>
        </div>
      </Show>
```

Also add a `skillTokens` row in the token overview if skills are active — find the "Messages" row in the token overview and add after it:

```tsx
              <Show when={snap().skillTokens > 0}>
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>Skills</span>
                  <span>{snap().skillTokens.toLocaleString()}</span>
                </div>
              </Show>
```

- [ ] **Step 2: Update ChatPanelContent to pass activeSkillNames**

In ChatPanelContent.tsx, update the `ChatDebugPanel` rendering to pass the new prop:

```tsx
            <ChatDebugPanel
              snapshot={contextSnapshot()}
              systemPrompt={lastSystemPrompt()}
              documentContent={props.documentContext.content}
              summary={props.store.conversationSummary()}
              messagesPayload={lastMessagesPayload()}
              modelId={currentModel()}
              activeSkillNames={props.store.activeSkillIds().map((id) => (allSkills() ?? []).find((s: ChatSkill) => s.id === id)?.name ?? id)}
            />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && pnpm --filter extension exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/detail/ChatDebugPanel.tsx apps/extension/components/detail/ChatPanelContent.tsx
git commit -m "feat(chat): show active skills and token cost in debug panel"
```

---

## Phase 4: Testing

### Task 10: End-to-End Testing

- [ ] **Step 1: Test skill picker**

1. Open a captured page, open chat
2. Click the Sparkles icon in the input area
3. Verify dropdown shows 5 built-in skills
4. Toggle "Concise" on — verify purple badge appears below header
5. Send a message — verify the response is concise
6. Toggle "ELI5" on alongside "Concise" — verify badge count updates
7. Click badge X to remove a skill

- [ ] **Step 2: Test debug panel with skills**

1. Activate a skill and send a message
2. Open debug panel — verify "Active skills" banner shows
3. Check System Prompt section — verify skill instructions are appended
4. Check skill token count in the overview

- [ ] **Step 3: Test custom skill creation**

1. Go to Settings → AI
2. Find "Chat Skills" section at the bottom
3. Click "New Skill"
4. Create a skill: name "Code Expert", description "Focus on code", prompt "Always include code examples in your responses. Use TypeScript when possible."
5. Save — verify it appears in the list with "custom" badge
6. Go to chat — verify custom skill appears in the picker

- [ ] **Step 4: Test default skills**

1. In Settings → AI → Chat Skills, hover a skill, click the star to set as default
2. Start a new conversation — verify the skill badge appears automatically
3. Remove the default, start another conversation — verify no badge

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(chat): address issues found during skills testing"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Built-in skill prompt files | None |
| 2 | Skills data layer (DB, loader, CRUD) | Task 1 |
| 3 | Context manager skill injection | None |
| 4 | Active skills per conversation (adapter + store) | Task 2 |
| 5 | Skill picker dropdown | Task 2 |
| 6 | Custom skill editor modal | Task 2 |
| 7 | Skill manager in settings | Tasks 2, 6 |
| 8 | Wire into ChatPanelContent | Tasks 3, 4, 5 |
| 9 | Update debug panel | Task 8 |
| 10 | End-to-end testing | Task 9 |

**Parallelizable:** Tasks 1+3 have no dependencies. Task 2 needs Task 1. Tasks 4+5+6 can run once Task 2 is done. Task 7 needs Tasks 2+6. Task 8 needs 3+4+5. Task 9 needs 8.
