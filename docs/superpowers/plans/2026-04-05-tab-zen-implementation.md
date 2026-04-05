# Tab Zen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that captures, organizes, and searches browser tabs using AI, with cross-browser sync via Cloudflare.

**Architecture:** WXT extension with SolidJS + Tailwind for UI. Three entry points (popup, side panel, full page) share components. Background service worker orchestrates capture, AI, and sync. IndexedDB stores the collection; chrome.storage.local stores settings. A Cloudflare Workers + D1 sync service lives in `sync-service/`.

**Tech Stack:** WXT, SolidJS, Tailwind CSS, IndexedDB (via idb), OpenRouter API, Cloudflare Workers + D1 + KV, Hono (sync service router)

---

## File Structure

```
tab-zen/
├── entrypoints/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── tabs/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── background.ts
│   └── content.ts
├── lib/
│   ├── types.ts            # Shared data model types
│   ├── db.ts               # IndexedDB wrapper (idb)
│   ├── settings.ts         # chrome.storage.local settings
│   ├── ai.ts               # OpenRouter integration
│   ├── metadata.ts         # OG/meta extraction messaging
│   ├── duplicates.ts       # URL normalization and matching
│   ├── sync.ts             # Cloudflare sync client
│   ├── export.ts           # JSON + HTML bookmarks export/import
│   └── messages.ts         # Type-safe message passing between scripts
├── components/
│   ├── TabCard.tsx          # Card view for a single tab
│   ├── TabRow.tsx           # Row/compact view for a single tab
│   ├── GroupSection.tsx     # Collapsible group with tabs
│   ├── SearchBar.tsx        # Search input with results
│   ├── FilterPills.tsx      # All / By Date / Archived / Duplicates
│   ├── ViewToggle.tsx       # Cards/Rows toggle
│   ├── CapturePreview.tsx   # Preview of proposed AI groups before confirm
│   ├── TabCollection.tsx    # Main collection view (groups list)
│   ├── SettingsPanel.tsx    # Settings UI
│   ├── NotesEditor.tsx      # Inline notes editing for a tab
│   └── EmptyState.tsx       # Empty state when no tabs saved
├── sync-service/
│   ├── src/
│   │   └── index.ts         # Hono Worker with D1
│   ├── schema.sql           # D1 table definitions
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
├── public/
│   └── icon/
├── assets/
├── package.json
├── wxt.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── tsconfig.json
```

---

### Task 1: Project Setup — Tailwind CSS and Dependencies

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Modify: `wxt.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install all dependencies**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen
npm install idb uuid
npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer
```

- [ ] **Step 2: Create Tailwind config**

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./entrypoints/**/*.{html,tsx,ts}",
    "./components/**/*.{tsx,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create PostCSS config**

Create `postcss.config.js`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 4: Update wxt.config.ts with permissions and entry points**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  manifest: {
    name: "Tab Zen",
    description: "AI-powered tab organization and management",
    permissions: [
      "tabs",
      "activeTab",
      "storage",
      "sidePanel",
      "contextMenus",
    ],
    commands: {
      _execute_side_panel: {
        suggested_key: { default: "Ctrl+Shift+Z", mac: "Command+Shift+Z" },
        description: "Toggle Tab Zen side panel",
      },
      "capture-all-tabs": {
        suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
        description: "Capture all open tabs",
      },
    },
  },
});
```

- [ ] **Step 5: Verify build works**

```bash
npm run compile
```

Expected: No errors (or only expected WXT type warnings).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tailwind.config.ts postcss.config.js wxt.config.ts
git commit -m "feat: add Tailwind CSS, idb, uuid dependencies and WXT permissions"
```

---

### Task 2: Data Model Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create the shared types file**

Create `lib/types.ts`:

```ts
export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  metaDescription: string | null;
  notes: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  capturedAt: string;
  sourceLabel: string;
  archived: boolean;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  captureId: string;
  position: number;
  archived: boolean;
}

export interface Capture {
  id: string;
  capturedAt: string;
  sourceLabel: string;
  tabCount: number;
}

export interface Settings {
  sourceLabel: string;
  openRouterApiKey: string;
  aiModel: string;
  syncEnabled: boolean;
  syncToken: string | null;
  syncUrl: string;
  viewMode: "cards" | "rows";
  activeFilter: "all" | "byDate" | "archived" | "duplicates";
}

export const DEFAULT_SETTINGS: Settings = {
  sourceLabel: "Chrome - Default",
  openRouterApiKey: "",
  aiModel: "openai/gpt-4o-mini",
  syncEnabled: false,
  syncToken: null,
  syncUrl: "https://tab-zen-sync.<your-subdomain>.workers.dev",
  viewMode: "cards",
  activeFilter: "all",
};

export interface AIGroupSuggestion {
  groupName: string;
  tabIds: string[];
}

export interface CapturePreviewData {
  captureId: string;
  groups: AIGroupSuggestion[];
  tabs: Tab[];
}

export interface SyncPayload {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
  lastSyncedAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared data model types"
```

---

### Task 3: IndexedDB Storage Layer

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Create the IndexedDB wrapper**

Create `lib/db.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Tab, Group, Capture } from "./types";

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
}

let dbInstance: IDBPDatabase<TabZenDB> | null = null;

async function getDB(): Promise<IDBPDatabase<TabZenDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<TabZenDB>("tab-zen", 1, {
    upgrade(db) {
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
    },
  });
  return dbInstance;
}

// --- Tabs ---

export async function addTab(tab: Tab): Promise<void> {
  const db = await getDB();
  await db.put("tabs", tab);
}

export async function addTabs(tabs: Tab[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("tabs", "readwrite");
  for (const tab of tabs) {
    tx.store.put(tab);
  }
  await tx.done;
}

export async function getTab(id: string): Promise<Tab | undefined> {
  const db = await getDB();
  return db.get("tabs", id);
}

export async function getAllTabs(): Promise<Tab[]> {
  const db = await getDB();
  return db.getAll("tabs");
}

export async function getTabsByGroup(groupId: string): Promise<Tab[]> {
  const db = await getDB();
  return db.getAllFromIndex("tabs", "by-groupId", groupId);
}

export async function getTabByUrl(url: string): Promise<Tab | undefined> {
  const db = await getDB();
  const tabs = await db.getAllFromIndex("tabs", "by-url", url);
  return tabs[0];
}

export async function updateTab(
  id: string,
  updates: Partial<Tab>,
): Promise<void> {
  const db = await getDB();
  const tab = await db.get("tabs", id);
  if (tab) {
    await db.put("tabs", { ...tab, ...updates });
  }
}

export async function deleteTab(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("tabs", id);
}

export async function searchTabs(query: string): Promise<Tab[]> {
  const db = await getDB();
  const all = await db.getAll("tabs");
  const lower = query.toLowerCase();
  return all.filter(
    (t) =>
      t.title.toLowerCase().includes(lower) ||
      t.url.toLowerCase().includes(lower) ||
      t.ogDescription?.toLowerCase().includes(lower) ||
      t.ogTitle?.toLowerCase().includes(lower) ||
      t.metaDescription?.toLowerCase().includes(lower) ||
      t.notes?.toLowerCase().includes(lower),
  );
}

// --- Groups ---

export async function addGroup(group: Group): Promise<void> {
  const db = await getDB();
  await db.put("groups", group);
}

export async function addGroups(groups: Group[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("groups", "readwrite");
  for (const group of groups) {
    tx.store.put(group);
  }
  await tx.done;
}

export async function getGroup(id: string): Promise<Group | undefined> {
  const db = await getDB();
  return db.get("groups", id);
}

export async function getAllGroups(): Promise<Group[]> {
  const db = await getDB();
  return db.getAll("groups");
}

export async function getGroupsByCapture(captureId: string): Promise<Group[]> {
  const db = await getDB();
  return db.getAllFromIndex("groups", "by-captureId", captureId);
}

export async function updateGroup(
  id: string,
  updates: Partial<Group>,
): Promise<void> {
  const db = await getDB();
  const group = await db.get("groups", id);
  if (group) {
    await db.put("groups", { ...group, ...updates });
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("groups", id);
}

// --- Captures ---

export async function addCapture(capture: Capture): Promise<void> {
  const db = await getDB();
  await db.put("captures", capture);
}

export async function getAllCaptures(): Promise<Capture[]> {
  const db = await getDB();
  return db.getAll("captures");
}

export async function deleteCapture(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("captures", id);
}

// --- Bulk operations ---

export async function getAllData(): Promise<{
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
}> {
  const db = await getDB();
  const [tabs, groups, captures] = await Promise.all([
    db.getAll("tabs"),
    db.getAll("groups"),
    db.getAll("captures"),
  ]);
  return { tabs, groups, captures };
}

export async function importData(data: {
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
}): Promise<{ imported: number; skipped: number }> {
  const db = await getDB();
  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(["tabs", "groups", "captures"], "readwrite");

  for (const capture of data.captures) {
    const existing = await tx.objectStore("captures").get(capture.id);
    if (!existing) {
      await tx.objectStore("captures").put(capture);
    }
  }

  for (const group of data.groups) {
    const existing = await tx.objectStore("groups").get(group.id);
    if (!existing) {
      await tx.objectStore("groups").put(group);
    }
  }

  for (const tab of data.tabs) {
    const existingByUrl = await tx
      .objectStore("tabs")
      .index("by-url")
      .get(tab.url);
    if (existingByUrl) {
      skipped++;
    } else {
      await tx.objectStore("tabs").put(tab);
      imported++;
    }
  }

  await tx.done;
  return { imported, skipped };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add IndexedDB storage layer with idb wrapper"
```

---

### Task 4: Settings Storage

**Files:**
- Create: `lib/settings.ts`

- [ ] **Step 1: Create settings module using WXT storage**

Create `lib/settings.ts`:

```ts
import { storage } from "wxt/storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS_KEY = "local:settings";

export async function getSettings(): Promise<Settings> {
  const stored = await storage.getItem<Settings>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(
  updates: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await storage.setItem(SETTINGS_KEY, updated);
  return updated;
}

export function watchSettings(
  callback: (newValue: Settings) => void,
): () => void {
  return storage.watch<Settings>(SETTINGS_KEY, (newValue) => {
    callback({ ...DEFAULT_SETTINGS, ...newValue });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/settings.ts
git commit -m "feat: add settings storage using WXT storage API"
```

---

### Task 5: Message Passing Types

**Files:**
- Create: `lib/messages.ts`

- [ ] **Step 1: Create typed message definitions**

Create `lib/messages.ts`:

```ts
import type { CapturePreviewData, Tab } from "./types";

export type MessageRequest =
  | { type: "CAPTURE_ALL_TABS" }
  | { type: "CAPTURE_SINGLE_TAB"; tabId: number }
  | { type: "CONFIRM_CAPTURE"; captureData: CapturePreviewData }
  | { type: "GET_UNCAPTURED_COUNT" }
  | { type: "SEARCH_TABS"; query: string }
  | { type: "AI_SEARCH"; query: string }
  | { type: "OPEN_TAB"; tabId: string }
  | { type: "GET_METADATA"; url: string };

export type MessageResponse =
  | { type: "CAPTURE_PREVIEW"; data: CapturePreviewData }
  | { type: "UNCAPTURED_COUNT"; count: number }
  | { type: "SEARCH_RESULTS"; tabs: Tab[] }
  | { type: "TAB_OPENED"; tab: Tab }
  | { type: "METADATA"; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; metaDescription: string | null }
  | { type: "ERROR"; message: string }
  | { type: "SUCCESS" };

export function sendMessage(
  message: MessageRequest,
): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/messages.ts
git commit -m "feat: add typed message passing between extension scripts"
```

---

### Task 6: URL Normalization and Duplicate Detection

**Files:**
- Create: `lib/duplicates.ts`

- [ ] **Step 1: Create duplicate detection module**

Create `lib/duplicates.ts`:

```ts
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
];

export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const param of UTM_PARAMS) {
      url.searchParams.delete(param);
    }
    url.searchParams.sort();
    // Remove trailing slash from pathname
    if (url.pathname.endsWith("/") && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function isDuplicate(
  url: string,
  existingUrls: Set<string>,
): boolean {
  return existingUrls.has(normalizeUrl(url));
}

export function buildUrlSet(urls: string[]): Set<string> {
  return new Set(urls.map(normalizeUrl));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/duplicates.ts
git commit -m "feat: add URL normalization and duplicate detection"
```

---

### Task 7: OpenRouter AI Integration

**Files:**
- Create: `lib/ai.ts`

- [ ] **Step 1: Create AI module**

Create `lib/ai.ts`:

```ts
import type { AIGroupSuggestion } from "./types";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[],
): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
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
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function groupTabsWithAI(
  apiKey: string,
  model: string,
  tabs: { id: string; title: string; url: string; description: string | null }[],
): Promise<AIGroupSuggestion[]> {
  const tabList = tabs
    .map((t) => `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a tab organizer. Given a list of browser tabs, group them into meaningful categories. Return JSON with this exact structure:
{"groups": [{"groupName": "Category Name", "tabIds": ["id1", "id2"]}]}
Rules:
- Create 2-8 groups depending on tab diversity
- Group names should be descriptive but concise (2-4 words)
- Every tab must be assigned to exactly one group
- Group by topic/purpose, not by domain (unless domain IS the topic)
- If tabs are very similar, use a specific name (e.g., "React Tutorials" not "YouTube Videos")`,
    },
    {
      role: "user",
      content: `Group these tabs:\n${tabList}`,
    },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.groups;
}

export async function aiSearch(
  apiKey: string,
  model: string,
  query: string,
  tabs: { id: string; title: string; url: string; description: string | null; notes: string | null }[],
): Promise<string[]> {
  const tabList = tabs
    .map(
      (t) =>
        `- [${t.id}] "${t.title}" (${t.url})${t.description ? ` — ${t.description}` : ""}${t.notes ? ` [Notes: ${t.notes}]` : ""}`,
    )
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a search assistant for a tab collection. Given a natural language query and a list of saved tabs, return the IDs of tabs that match the query. Return JSON: {"matchingTabIds": ["id1", "id2"]}. Return an empty array if nothing matches. Rank by relevance — most relevant first.`,
    },
    {
      role: "user",
      content: `Query: "${query}"\n\nTabs:\n${tabList}`,
    },
  ];

  const response = await callOpenRouter(apiKey, model, messages);
  const parsed = JSON.parse(response);
  return parsed.matchingTabIds;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add OpenRouter AI integration for tab grouping and search"
```

---

### Task 8: Export/Import Module

**Files:**
- Create: `lib/export.ts`

- [ ] **Step 1: Create export/import module**

Create `lib/export.ts`:

```ts
import { getAllData, importData } from "./db";
import type { Tab, Group, Capture } from "./types";

interface ExportData {
  version: 1;
  exportedAt: string;
  tabs: Tab[];
  groups: Group[];
  captures: Capture[];
}

export async function exportAsJson(): Promise<string> {
  const data = await getAllData();
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importFromJson(
  jsonString: string,
): Promise<{ imported: number; skipped: number }> {
  const data: ExportData = JSON.parse(jsonString);
  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }
  return importData(data);
}

export async function exportAsHtmlBookmarks(): Promise<string> {
  const { tabs, groups } = await getAllData();
  const groupMap = new Map<string, Group>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  const tabsByGroup = new Map<string, Tab[]>();
  for (const tab of tabs) {
    const list = tabsByGroup.get(tab.groupId) || [];
    list.push(tab);
    tabsByGroup.set(tab.groupId, list);
  }

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Tab Zen Export</TITLE>
<H1>Tab Zen Export</H1>
<DL><p>\n`;

  for (const [groupId, groupTabs] of tabsByGroup) {
    const group = groupMap.get(groupId);
    const name = group?.name || "Ungrouped";
    html += `    <DT><H3>${escapeHtml(name)}</H3>\n`;
    html += `    <DL><p>\n`;
    for (const tab of groupTabs) {
      html += `        <DT><A HREF="${escapeHtml(tab.url)}">${escapeHtml(tab.title)}</A>\n`;
    }
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/export.ts
git commit -m "feat: add JSON and HTML bookmarks export/import"
```

---

### Task 9: Sync Client

**Files:**
- Create: `lib/sync.ts`

- [ ] **Step 1: Create the Cloudflare sync client**

Create `lib/sync.ts`:

```ts
import type { SyncPayload } from "./types";
import { getSettings } from "./settings";

async function syncRequest(
  endpoint: string,
  body?: unknown,
): Promise<Response> {
  const settings = await getSettings();
  if (!settings.syncToken) throw new Error("No sync token configured");

  const response = await fetch(`${settings.syncUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.syncToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync error: ${response.status} - ${text}`);
  }

  return response;
}

export async function initSync(): Promise<string> {
  const response = await syncRequest("/sync/init");
  const data = await response.json();
  return data.token;
}

export async function verifySync(): Promise<boolean> {
  try {
    const response = await syncRequest("/sync/verify");
    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export async function pushSync(payload: SyncPayload): Promise<void> {
  await syncRequest("/sync/push", payload);
}

export async function pullSync(
  lastSyncedAt: string,
): Promise<SyncPayload | null> {
  const response = await syncRequest("/sync/pull", { since: lastSyncedAt });
  const data = await response.json();
  if (!data.tabs?.length && !data.groups?.length && !data.captures?.length) {
    return null;
  }
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sync.ts
git commit -m "feat: add Cloudflare sync client"
```

---

### Task 10: Content Script — OG/Meta Extraction

**Files:**
- Modify: `entrypoints/content.ts`

- [ ] **Step 1: Replace the content script with metadata extraction**

Replace `entrypoints/content.ts` with:

```ts
export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_METADATA") {
        const ogTitle =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || null;
        const ogDescription =
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") || null;
        const ogImage =
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute("content") || null;
        const metaDescription =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || null;

        sendResponse({
          type: "METADATA",
          ogTitle,
          ogDescription,
          ogImage,
          metaDescription,
        });
      }
      return true;
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat: content script extracts OG and meta description data"
```

---

### Task 11: Background Service Worker

**Files:**
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: Implement the full background service worker**

Replace `entrypoints/background.ts` with:

```ts
import { v4 as uuidv4 } from "uuid";
import {
  getAllTabs,
  addTabs,
  addGroups,
  addCapture,
  updateTab,
  getTab,
  searchTabs,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normalizeUrl, buildUrlSet, isDuplicate } from "@/lib/duplicates";
import { groupTabsWithAI, aiSearch } from "@/lib/ai";
import type {
  Tab,
  Group,
  Capture,
  CapturePreviewData,
} from "@/lib/types";
import type { MessageRequest, MessageResponse } from "@/lib/messages";

export default defineBackground(() => {
  // --- Badge: Uncaptured tab count ---
  async function updateBadge(): Promise<void> {
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));

    const openTabs = await browser.tabs.query({});
    let uncaptured = 0;
    for (const tab of openTabs) {
      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        if (!isDuplicate(tab.url, existingUrls)) {
          uncaptured++;
        }
      }
    }

    if (uncaptured > 0) {
      await browser.action.setBadgeText({ text: String(uncaptured) });
      await browser.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    } else {
      await browser.action.setBadgeText({ text: "" });
    }
  }

  // Update badge on tab events
  browser.tabs.onCreated.addListener(() => updateBadge());
  browser.tabs.onRemoved.addListener(() => updateBadge());
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      updateBadge();
    }
  });

  // Initial badge update
  updateBadge();

  // --- Context Menu ---
  browser.contextMenus.create({
    id: "save-tab-to-tabzen",
    title: "Save to Tab Zen",
    contexts: ["page", "link"],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-tab-to-tabzen" && tab) {
      const url = info.linkUrl || tab.url;
      const title = tab.title || url || "Untitled";
      if (url) {
        await captureSingleTab(tab.id!, url, title, tab.favIconUrl || "");
      }
    }
  });

  // --- Keyboard shortcuts ---
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "capture-all-tabs") {
      const preview = await buildCapturePreview();
      // Auto-confirm for keyboard shortcut (no preview UI)
      if (preview.tabs.length > 0) {
        await confirmCapture(preview);
      }
    }
  });

  // --- Message handler ---
  browser.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true;
    },
  );

  async function handleMessage(
    message: MessageRequest,
  ): Promise<MessageResponse> {
    switch (message.type) {
      case "CAPTURE_ALL_TABS":
        return handleCaptureAllTabs();
      case "CAPTURE_SINGLE_TAB":
        return handleCaptureSingleTab(message.tabId);
      case "CONFIRM_CAPTURE":
        return handleConfirmCapture(message.captureData);
      case "GET_UNCAPTURED_COUNT":
        return handleGetUncapturedCount();
      case "SEARCH_TABS":
        return handleSearchTabs(message.query);
      case "AI_SEARCH":
        return handleAISearch(message.query);
      case "OPEN_TAB":
        return handleOpenTab(message.tabId);
      default:
        return { type: "ERROR", message: "Unknown message type" };
    }
  }

  async function handleCaptureAllTabs(): Promise<MessageResponse> {
    try {
      const preview = await buildCapturePreview();
      return { type: "CAPTURE_PREVIEW", data: preview };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleCaptureSingleTab(
    browserTabId: number,
  ): Promise<MessageResponse> {
    try {
      const tab = await browser.tabs.get(browserTabId);
      if (!tab.url) return { type: "ERROR", message: "Tab has no URL" };
      await captureSingleTab(
        browserTabId,
        tab.url,
        tab.title || "Untitled",
        tab.favIconUrl || "",
      );
      await updateBadge();
      return { type: "SUCCESS" };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleConfirmCapture(
    captureData: CapturePreviewData,
  ): Promise<MessageResponse> {
    try {
      await confirmCapture(captureData);
      return { type: "SUCCESS" };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleGetUncapturedCount(): Promise<MessageResponse> {
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));
    const openTabs = await browser.tabs.query({});
    let count = 0;
    for (const tab of openTabs) {
      if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
        if (!isDuplicate(tab.url, existingUrls)) {
          count++;
        }
      }
    }
    return { type: "UNCAPTURED_COUNT", count };
  }

  async function handleSearchTabs(
    query: string,
  ): Promise<MessageResponse> {
    const tabs = await searchTabs(query);
    return { type: "SEARCH_RESULTS", tabs };
  }

  async function handleAISearch(
    query: string,
  ): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      if (!settings.openRouterApiKey) {
        return { type: "ERROR", message: "OpenRouter API key not configured" };
      }
      const allTabs = await getAllTabs();
      const tabData = allTabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        description: t.ogDescription || t.metaDescription,
        notes: t.notes,
      }));
      const matchingIds = await aiSearch(
        settings.openRouterApiKey,
        settings.aiModel,
        query,
        tabData,
      );
      const results = allTabs.filter((t) => matchingIds.includes(t.id));
      return { type: "SEARCH_RESULTS", tabs: results };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleOpenTab(tabId: string): Promise<MessageResponse> {
    const tab = await getTab(tabId);
    if (!tab) return { type: "ERROR", message: "Tab not found" };

    await browser.tabs.create({ url: tab.url });
    await updateTab(tabId, {
      viewCount: tab.viewCount + 1,
      lastViewedAt: new Date().toISOString(),
    });

    const updated = await getTab(tabId);
    return { type: "TAB_OPENED", tab: updated! };
  }

  // --- Capture helpers ---

  async function fetchMetadata(
    browserTabId: number,
  ): Promise<{
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
  }> {
    try {
      const response = await browser.tabs.sendMessage(browserTabId, {
        type: "GET_METADATA",
      });
      return response;
    } catch {
      return {
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        metaDescription: null,
      };
    }
  }

  async function buildCapturePreview(): Promise<CapturePreviewData> {
    const settings = await getSettings();
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));
    const openTabs = await browser.tabs.query({});
    const captureId = uuidv4();

    // Filter to new tabs only
    const newBrowserTabs = openTabs.filter(
      (t) =>
        t.url &&
        !t.url.startsWith("chrome://") &&
        !t.url.startsWith("chrome-extension://") &&
        !isDuplicate(t.url!, existingUrls),
    );

    // Fetch metadata for all new tabs
    const tabsWithMeta: Tab[] = await Promise.all(
      newBrowserTabs.map(async (bt) => {
        const meta = await fetchMetadata(bt.id!);
        return {
          id: uuidv4(),
          url: bt.url!,
          title: bt.title || "Untitled",
          favicon: bt.favIconUrl || "",
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
          ogImage: meta.ogImage,
          metaDescription: meta.metaDescription,
          notes: null,
          viewCount: 0,
          lastViewedAt: null,
          capturedAt: new Date().toISOString(),
          sourceLabel: settings.sourceLabel,
          archived: false,
          groupId: "", // Will be set after AI grouping
        };
      }),
    );

    // AI grouping
    let groups: { groupName: string; tabIds: string[] }[];
    if (settings.openRouterApiKey && tabsWithMeta.length > 0) {
      try {
        groups = await groupTabsWithAI(
          settings.openRouterApiKey,
          settings.aiModel,
          tabsWithMeta.map((t) => ({
            id: t.id,
            title: t.title,
            url: t.url,
            description: t.ogDescription || t.metaDescription,
          })),
        );
      } catch {
        // Fallback: group by domain
        groups = groupByDomain(tabsWithMeta);
      }
    } else {
      groups = groupByDomain(tabsWithMeta);
    }

    // Assign groupIds to tabs
    const groupObjects: { groupName: string; tabIds: string[] }[] = [];
    for (const g of groups) {
      const groupId = uuidv4();
      groupObjects.push({ groupName: g.groupName, tabIds: g.tabIds });
      for (const tabId of g.tabIds) {
        const tab = tabsWithMeta.find((t) => t.id === tabId);
        if (tab) tab.groupId = groupId;
      }
    }

    return {
      captureId,
      groups: groupObjects,
      tabs: tabsWithMeta,
    };
  }

  function groupByDomain(
    tabs: Tab[],
  ): { groupName: string; tabIds: string[] }[] {
    const byDomain = new Map<string, string[]>();
    for (const tab of tabs) {
      try {
        const domain = new URL(tab.url).hostname.replace("www.", "");
        const list = byDomain.get(domain) || [];
        list.push(tab.id);
        byDomain.set(domain, list);
      } catch {
        const list = byDomain.get("Other") || [];
        list.push(tab.id);
        byDomain.set("Other", list);
      }
    }
    return Array.from(byDomain.entries()).map(([domain, tabIds]) => ({
      groupName: domain,
      tabIds,
    }));
  }

  async function confirmCapture(
    preview: CapturePreviewData,
  ): Promise<void> {
    const settings = await getSettings();

    // Create groups
    const groups: Group[] = preview.groups.map((g, i) => {
      const groupId =
        preview.tabs.find((t) =>
          g.tabIds.includes(t.id),
        )?.groupId || uuidv4();
      return {
        id: groupId,
        name: g.groupName,
        captureId: preview.captureId,
        position: i,
        archived: false,
      };
    });

    // Create capture record
    const capture: Capture = {
      id: preview.captureId,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      tabCount: preview.tabs.length,
    };

    await addCapture(capture);
    await addGroups(groups);
    await addTabs(preview.tabs);
    await updateBadge();
  }

  async function captureSingleTab(
    browserTabId: number,
    url: string,
    title: string,
    favicon: string,
  ): Promise<void> {
    const settings = await getSettings();
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));

    if (isDuplicate(url, existingUrls)) return;

    const meta = await fetchMetadata(browserTabId);
    const captureId = uuidv4();
    const groupId = uuidv4();

    const tab: Tab = {
      id: uuidv4(),
      url,
      title,
      favicon,
      ...meta,
      notes: null,
      viewCount: 0,
      lastViewedAt: null,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      archived: false,
      groupId,
    };

    const group: Group = {
      id: groupId,
      name: new URL(url).hostname.replace("www.", ""),
      captureId,
      position: 0,
      archived: false,
    };

    const capture: Capture = {
      id: captureId,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      tabCount: 1,
    };

    await addCapture(capture);
    await addGroups([group]);
    await addTabs([tab]);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: implement background service worker with capture, AI grouping, badge, and context menu"
```

---

### Task 12: Shared CSS Entry Point

**Files:**
- Create: `assets/global.css`

- [ ] **Step 1: Create global Tailwind CSS file**

Create `assets/global.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 2: Commit**

```bash
git add assets/global.css
git commit -m "feat: add global Tailwind CSS entry point"
```

---

### Task 13: Shared UI Components — TabCard, TabRow, EmptyState

**Files:**
- Create: `components/TabCard.tsx`
- Create: `components/TabRow.tsx`
- Create: `components/EmptyState.tsx`

- [ ] **Step 1: Create TabCard component**

Create `components/TabCard.tsx`:

```tsx
import type { Tab } from "@/lib/types";

interface TabCardProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function TabCard(props: TabCardProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  const description = () =>
    props.tab.ogDescription || props.tab.metaDescription || null;

  return (
    <div
      class="bg-slate-800 rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-blue-500 transition-all"
      onClick={() => props.onOpen(props.tab)}
    >
      {props.tab.ogImage && (
        <div class="h-32 overflow-hidden bg-slate-700">
          <img
            src={props.tab.ogImage}
            alt=""
            class="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div class="p-3">
        <div class="flex items-center gap-2 mb-1.5">
          {props.tab.favicon && (
            <img src={props.tab.favicon} alt="" class="w-4 h-4 rounded-sm" />
          )}
          <span class="text-xs text-slate-400 truncate">{domain()}</span>
        </div>
        <h3 class="text-sm font-medium text-slate-100 leading-snug line-clamp-2">
          {props.tab.ogTitle || props.tab.title}
        </h3>
        {description() && (
          <p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {description()}
          </p>
        )}
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            {props.tab.viewCount > 0 && (
              <span class="text-[10px] text-blue-400">
                👁 {props.tab.viewCount}
              </span>
            )}
            <span class="text-[10px] text-slate-500">
              {props.tab.sourceLabel}
            </span>
          </div>
          <button
            class={`text-[10px] ${props.tab.notes ? "text-slate-400" : "text-slate-600"} hover:text-slate-300`}
            onClick={(e) => {
              e.stopPropagation();
              props.onEditNotes(props.tab);
            }}
            title={props.tab.notes ? "Edit notes" : "Add notes"}
          >
            📝
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TabRow component**

Create `components/TabRow.tsx`:

```tsx
import type { Tab } from "@/lib/types";

interface TabRowProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function TabRow(props: TabRowProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  return (
    <div
      class="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 cursor-pointer rounded-md transition-colors"
      onClick={() => props.onOpen(props.tab)}
    >
      {props.tab.favicon ? (
        <img src={props.tab.favicon} alt="" class="w-4 h-4 rounded-sm flex-shrink-0" />
      ) : (
        <div class="w-4 h-4 bg-slate-700 rounded-sm flex-shrink-0" />
      )}
      <div class="flex-1 min-w-0">
        <div class="text-sm text-slate-200 truncate">{props.tab.title}</div>
        <div class="text-xs text-slate-500 truncate">{domain()}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        {props.tab.viewCount > 0 && (
          <span class="text-[10px] text-blue-400">👁 {props.tab.viewCount}</span>
        )}
        <button
          class={`text-[10px] ${props.tab.notes ? "text-slate-400" : "text-slate-600"} hover:text-slate-300`}
          onClick={(e) => {
            e.stopPropagation();
            props.onEditNotes(props.tab);
          }}
        >
          📝
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create EmptyState component**

Create `components/EmptyState.tsx`:

```tsx
export default function EmptyState() {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="text-4xl mb-4">🧘</div>
      <h2 class="text-lg font-semibold text-slate-200 mb-2">No tabs saved yet</h2>
      <p class="text-sm text-slate-400 max-w-xs">
        Click "Capture All Tabs" to save your open tabs, or right-click any tab
        to save it individually.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/TabCard.tsx components/TabRow.tsx components/EmptyState.tsx
git commit -m "feat: add TabCard, TabRow, and EmptyState components"
```

---

### Task 14: Shared UI Components — GroupSection, NotesEditor

**Files:**
- Create: `components/GroupSection.tsx`
- Create: `components/NotesEditor.tsx`

- [ ] **Step 1: Create GroupSection component**

Create `components/GroupSection.tsx`:

```tsx
import { createSignal, For, Show } from "solid-js";
import type { Tab, Group } from "@/lib/types";
import TabCard from "./TabCard";
import TabRow from "./TabRow";

interface GroupSectionProps {
  group: Group;
  tabs: Tab[];
  viewMode: "cards" | "rows";
  onOpenTab: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
  onRenameGroup: (group: Group, newName: string) => void;
}

export default function GroupSection(props: GroupSectionProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const captureDate = () => {
    const tab = props.tabs[0];
    if (!tab) return "";
    return new Date(tab.capturedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleRename = () => {
    if (inputRef && inputRef.value.trim()) {
      props.onRenameGroup(props.group, inputRef.value.trim());
    }
    setEditing(false);
  };

  return (
    <div class="mb-4">
      <div class="flex items-center justify-between px-4 py-2">
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setCollapsed(!collapsed())}
          >
            {collapsed() ? "▶" : "▼"}
          </button>
          <Show
            when={!editing()}
            fallback={
              <input
                ref={inputRef}
                class="bg-slate-800 text-sm font-semibold text-slate-100 px-2 py-0.5 rounded border border-slate-600 outline-none focus:border-blue-500"
                value={props.group.name}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            }
          >
            <h3
              class="text-sm font-semibold text-slate-100 cursor-pointer hover:text-blue-400"
              onDblClick={() => setEditing(true)}
            >
              {props.group.name}
            </h3>
          </Show>
          <span class="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
            {props.tabs.length}
          </span>
        </div>
        <span class="text-xs text-slate-500">{captureDate()}</span>
      </div>
      <Show when={!collapsed()}>
        <Show
          when={props.viewMode === "cards"}
          fallback={
            <div class="space-y-0.5">
              <For each={props.tabs}>
                {(tab) => (
                  <TabRow
                    tab={tab}
                    onOpen={props.onOpenTab}
                    onEditNotes={props.onEditNotes}
                  />
                )}
              </For>
            </div>
          }
        >
          <div class="grid gap-3 px-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <For each={props.tabs}>
              {(tab) => (
                <TabCard
                  tab={tab}
                  onOpen={props.onOpenTab}
                  onEditNotes={props.onEditNotes}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Create NotesEditor component**

Create `components/NotesEditor.tsx`:

```tsx
import { createSignal, Show } from "solid-js";
import type { Tab } from "@/lib/types";

interface NotesEditorProps {
  tab: Tab;
  onSave: (tabId: string, notes: string) => void;
  onClose: () => void;
}

export default function NotesEditor(props: NotesEditorProps) {
  const [notes, setNotes] = createSignal(props.tab.notes || "");

  const handleSave = () => {
    props.onSave(props.tab.id, notes());
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={props.onClose}>
      <div class="bg-slate-800 rounded-lg p-4 w-80 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 class="text-sm font-semibold text-slate-100 mb-1">Notes</h3>
        <p class="text-xs text-slate-400 mb-3 truncate">{props.tab.title}</p>
        <textarea
          class="w-full h-32 bg-slate-900 text-sm text-slate-200 rounded-md p-3 border border-slate-700 outline-none focus:border-blue-500 resize-none"
          value={notes()}
          onInput={(e) => setNotes(e.currentTarget.value)}
          placeholder="Add notes about this tab..."
        />
        <div class="flex justify-end gap-2 mt-3">
          <button
            class="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/GroupSection.tsx components/NotesEditor.tsx
git commit -m "feat: add GroupSection and NotesEditor components"
```

---

### Task 15: Shared UI Components — SearchBar, FilterPills, ViewToggle, CapturePreview

**Files:**
- Create: `components/SearchBar.tsx`
- Create: `components/FilterPills.tsx`
- Create: `components/ViewToggle.tsx`
- Create: `components/CapturePreview.tsx`

- [ ] **Step 1: Create SearchBar component**

Create `components/SearchBar.tsx`:

```tsx
import { createSignal } from "solid-js";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onAISearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar(props: SearchBarProps) {
  const [query, setQuery] = createSignal("");
  let debounceTimer: ReturnType<typeof setTimeout>;

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      props.onSearch(value);
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && query().trim()) {
      props.onAISearch(query().trim());
    }
  };

  return (
    <div class="px-4 pt-3 pb-2">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          🔍
        </span>
        <input
          type="text"
          class="w-full bg-slate-800 text-sm text-slate-200 rounded-lg pl-9 pr-3 py-2.5 border border-slate-700 outline-none focus:border-blue-500 placeholder:text-slate-500"
          placeholder={props.placeholder || "Search tabs, notes, descriptions..."}
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p class="text-[10px] text-slate-600 mt-1 px-1">
        Press Enter for AI search
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create FilterPills component**

Create `components/FilterPills.tsx`:

```tsx
import { For } from "solid-js";
import type { Settings } from "@/lib/types";

interface FilterPillsProps {
  active: Settings["activeFilter"];
  onChange: (filter: Settings["activeFilter"]) => void;
}

const FILTERS: { key: Settings["activeFilter"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "byDate", label: "By Date" },
  { key: "archived", label: "Archived" },
  { key: "duplicates", label: "Duplicates" },
];

export default function FilterPills(props: FilterPillsProps) {
  return (
    <div class="flex gap-1.5 px-4 pb-3">
      <For each={FILTERS}>
        {(filter) => (
          <button
            class={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              props.active === filter.key
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => props.onChange(filter.key)}
          >
            {filter.label}
          </button>
        )}
      </For>
    </div>
  );
}
```

- [ ] **Step 3: Create ViewToggle component**

Create `components/ViewToggle.tsx`:

```tsx
interface ViewToggleProps {
  mode: "cards" | "rows";
  onChange: (mode: "cards" | "rows") => void;
}

export default function ViewToggle(props: ViewToggleProps) {
  return (
    <div class="flex bg-slate-800 rounded-md p-0.5 text-xs">
      <button
        class={`px-2 py-1 rounded ${
          props.mode === "cards"
            ? "bg-slate-700 text-slate-100"
            : "text-slate-400 hover:text-slate-200"
        }`}
        onClick={() => props.onChange("cards")}
      >
        Cards
      </button>
      <button
        class={`px-2 py-1 rounded ${
          props.mode === "rows"
            ? "bg-slate-700 text-slate-100"
            : "text-slate-400 hover:text-slate-200"
        }`}
        onClick={() => props.onChange("rows")}
      >
        Rows
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create CapturePreview component**

Create `components/CapturePreview.tsx`:

```tsx
import { For } from "solid-js";
import type { CapturePreviewData } from "@/lib/types";

interface CapturePreviewProps {
  data: CapturePreviewData;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CapturePreview(props: CapturePreviewProps) {
  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-lg p-4 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
        <h2 class="text-base font-semibold text-slate-100 mb-1">
          Capture Preview
        </h2>
        <p class="text-xs text-slate-400 mb-4">
          {props.data.tabs.length} new tabs in {props.data.groups.length} groups
        </p>
        <div class="space-y-3 mb-4">
          <For each={props.data.groups}>
            {(group) => {
              const groupTabs = () =>
                props.data.tabs.filter((t) => group.tabIds.includes(t.id));
              return (
                <div class="bg-slate-900 rounded-md p-3">
                  <h3 class="text-sm font-medium text-slate-200 mb-2">
                    {group.groupName}
                    <span class="text-slate-500 ml-2 text-xs">
                      ({groupTabs().length})
                    </span>
                  </h3>
                  <ul class="space-y-1">
                    <For each={groupTabs()}>
                      {(tab) => (
                        <li class="text-xs text-slate-400 truncate flex items-center gap-2">
                          {tab.favicon && (
                            <img
                              src={tab.favicon}
                              alt=""
                              class="w-3 h-3 rounded-sm"
                            />
                          )}
                          {tab.title}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              );
            }}
          </For>
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={props.onConfirm}
          >
            Save {props.data.tabs.length} Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/SearchBar.tsx components/FilterPills.tsx components/ViewToggle.tsx components/CapturePreview.tsx
git commit -m "feat: add SearchBar, FilterPills, ViewToggle, and CapturePreview components"
```

---

### Task 16: TabCollection — Main Collection View

**Files:**
- Create: `components/TabCollection.tsx`

- [ ] **Step 1: Create TabCollection component**

Create `components/TabCollection.tsx`:

```tsx
import { createSignal, createResource, For, Show } from "solid-js";
import type { Tab, Group, Capture, Settings, CapturePreviewData } from "@/lib/types";
import { getAllTabs, getAllGroups, getAllCaptures, updateTab, updateGroup } from "@/lib/db";
import { sendMessage } from "@/lib/messages";
import GroupSection from "./GroupSection";
import SearchBar from "./SearchBar";
import FilterPills from "./FilterPills";
import ViewToggle from "./ViewToggle";
import NotesEditor from "./NotesEditor";
import CapturePreview from "./CapturePreview";
import EmptyState from "./EmptyState";

interface TabCollectionProps {
  viewMode: Settings["viewMode"];
  onViewModeChange: (mode: "cards" | "rows") => void;
  showExpandButton?: boolean;
}

export default function TabCollection(props: TabCollectionProps) {
  const [filter, setFilter] = createSignal<Settings["activeFilter"]>("all");
  const [searchResults, setSearchResults] = createSignal<Tab[] | null>(null);
  const [editingTab, setEditingTab] = createSignal<Tab | null>(null);
  const [capturePreview, setCapturePreview] = createSignal<CapturePreviewData | null>(null);
  const [refreshKey, setRefreshKey] = createSignal(0);

  const [allTabs] = createResource(refreshKey, async () => getAllTabs());
  const [allGroups] = createResource(refreshKey, async () => getAllGroups());
  const [allCaptures] = createResource(refreshKey, async () => getAllCaptures());

  const refresh = () => setRefreshKey((k) => k + 1);

  const filteredGroups = () => {
    const groups = allGroups() || [];
    const tabs = searchResults() || allTabs() || [];
    const f = filter();

    let filtered: Group[];
    if (f === "archived") {
      filtered = groups.filter((g) => g.archived);
    } else {
      filtered = groups.filter((g) => !g.archived);
    }

    // Sort by position
    filtered.sort((a, b) => a.position - b.position);

    // If in "byDate" mode, sort by capture date
    if (f === "byDate") {
      const captures = allCaptures() || [];
      const captureMap = new Map(captures.map((c) => [c.id, c]));
      filtered.sort((a, b) => {
        const ca = captureMap.get(a.captureId);
        const cb = captureMap.get(b.captureId);
        return (cb?.capturedAt || "").localeCompare(ca?.capturedAt || "");
      });
    }

    return filtered;
  };

  const tabsForGroup = (groupId: string) => {
    const tabs = searchResults() || allTabs() || [];
    return tabs.filter((t) => t.groupId === groupId);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const response = await sendMessage({ type: "SEARCH_TABS", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.tabs);
    }
  };

  const handleAISearch = async (query: string) => {
    const response = await sendMessage({ type: "AI_SEARCH", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.tabs);
    }
  };

  const handleOpenTab = async (tab: Tab) => {
    await sendMessage({ type: "OPEN_TAB", tabId: tab.id });
    refresh();
  };

  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    refresh();
  };

  const handleRenameGroup = async (group: Group, newName: string) => {
    await updateGroup(group.id, { name: newName });
    refresh();
  };

  const handleConfirmCapture = async () => {
    const preview = capturePreview();
    if (preview) {
      await sendMessage({ type: "CONFIRM_CAPTURE", captureData: preview });
      setCapturePreview(null);
      refresh();
    }
  };

  const openFullPage = () => {
    browser.tabs.create({ url: browser.runtime.getURL("/tabs.html") });
  };

  return (
    <div class="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Top Bar */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 class="text-base font-bold text-slate-50">Tab Zen</h1>
        <div class="flex items-center gap-2">
          <ViewToggle mode={props.viewMode} onChange={props.onViewModeChange} />
          <Show when={props.showExpandButton}>
            <button
              class="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center text-xs text-slate-400 hover:text-slate-200"
              onClick={openFullPage}
              title="Open full page"
            >
              ⛶
            </button>
          </Show>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} onAISearch={handleAISearch} />
      <FilterPills active={filter()} onChange={setFilter} />

      {/* Collection */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={(allTabs() || []).length > 0}
          fallback={<EmptyState />}
        >
          <For each={filteredGroups()}>
            {(group) => {
              const tabs = () => tabsForGroup(group.id);
              return (
                <Show when={tabs().length > 0}>
                  <GroupSection
                    group={group}
                    tabs={tabs()}
                    viewMode={props.viewMode}
                    onOpenTab={handleOpenTab}
                    onEditNotes={setEditingTab}
                    onRenameGroup={handleRenameGroup}
                  />
                </Show>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Notes Editor Modal */}
      <Show when={editingTab()}>
        {(tab) => (
          <NotesEditor
            tab={tab()}
            onSave={handleSaveNotes}
            onClose={() => setEditingTab(null)}
          />
        )}
      </Show>

      {/* Capture Preview Modal */}
      <Show when={capturePreview()}>
        {(preview) => (
          <CapturePreview
            data={preview()}
            onConfirm={handleConfirmCapture}
            onCancel={() => setCapturePreview(null)}
          />
        )}
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TabCollection.tsx
git commit -m "feat: add TabCollection main view component"
```

---

### Task 17: Settings Panel Component

**Files:**
- Create: `components/SettingsPanel.tsx`

- [ ] **Step 1: Create SettingsPanel component**

Create `components/SettingsPanel.tsx`:

```tsx
import { createSignal, createResource, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import { exportAsJson, exportAsHtmlBookmarks, importFromJson, downloadFile } from "@/lib/export";
import type { Settings } from "@/lib/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [settings] = createResource(async () => getSettings());
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);

  const save = async (updates: Partial<Settings>) => {
    setSaving(true);
    await updateSettings(updates);
    setSaving(false);
  };

  const handleExportJson = async () => {
    const json = await exportAsJson();
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `tab-zen-export-${date}.json`, "application/json");
  };

  const handleExportBookmarks = async () => {
    const html = await exportAsHtmlBookmarks();
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(html, `tab-zen-bookmarks-${date}.html`, "text/html");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const result = await importFromJson(text);
        setImportResult(
          `Imported ${result.imported} tabs, skipped ${result.skipped} duplicates`,
        );
      } catch (err) {
        setImportResult(`Import failed: ${err}`);
      }
    };
    input.click();
  };

  return (
    <div class="h-full bg-slate-900 text-slate-200 overflow-y-auto">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 class="text-base font-bold text-slate-50">Settings</h1>
        <button
          class="text-xs text-slate-400 hover:text-slate-200"
          onClick={props.onClose}
        >
          ← Back
        </button>
      </div>

      <Show when={settings()}>
        {(s) => (
          <div class="p-4 space-y-6">
            {/* Source Label */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Browser / Profile Name
              </label>
              <input
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                value={s().sourceLabel}
                onChange={(e) => save({ sourceLabel: e.currentTarget.value })}
              />
              <p class="text-[10px] text-slate-500 mt-1">
                Tags your captures so you know where they came from
              </p>
            </div>

            {/* OpenRouter API Key */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                OpenRouter API Key
              </label>
              <input
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                type="password"
                value={s().openRouterApiKey}
                onChange={(e) =>
                  save({ openRouterApiKey: e.currentTarget.value })
                }
                placeholder="sk-or-..."
              />
            </div>

            {/* AI Model */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                AI Model
              </label>
              <select
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                value={s().aiModel}
                onChange={(e) => save({ aiModel: e.currentTarget.value })}
              >
                <option value="openai/gpt-4o-mini">GPT-4o Mini (default)</option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="anthropic/claude-haiku-4-5-20251001">Claude Haiku</option>
                <option value="anthropic/claude-sonnet-4-6">Claude Sonnet</option>
                <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
              </select>
            </div>

            {/* Sync */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Sync
              </label>
              <div class="flex items-center gap-3 mb-2">
                <button
                  class={`px-3 py-1.5 text-xs rounded ${
                    s().syncEnabled
                      ? "bg-green-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => save({ syncEnabled: !s().syncEnabled })}
                >
                  {s().syncEnabled ? "Sync Enabled" : "Enable Sync"}
                </button>
              </div>
              <Show when={s().syncToken}>
                <div class="bg-slate-800 rounded-md p-3">
                  <p class="text-[10px] text-slate-500 mb-1">Sync Token</p>
                  <code class="text-xs text-slate-300 break-all">
                    {s().syncToken}
                  </code>
                </div>
              </Show>
              <div class="mt-2">
                <label class="block text-[10px] text-slate-500 mb-1">
                  Sync URL
                </label>
                <input
                  class="w-full bg-slate-800 text-xs text-slate-300 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                  value={s().syncUrl}
                  onChange={(e) => save({ syncUrl: e.currentTarget.value })}
                />
              </div>
            </div>

            {/* Export / Import */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Export / Import
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleExportJson}
                >
                  Export JSON
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleExportBookmarks}
                >
                  Export Bookmarks
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleImport}
                >
                  Import JSON
                </button>
              </div>
              <Show when={importResult()}>
                <p class="text-xs text-slate-400 mt-2">{importResult()}</p>
              </Show>
            </div>

            {/* Keyboard shortcuts */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Keyboard Shortcuts
              </label>
              <button
                class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                onClick={() =>
                  browser.tabs.create({
                    url: "chrome://extensions/shortcuts",
                  })
                }
              >
                Configure Shortcuts
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel component with all settings controls"
```

---

### Task 18: Side Panel Entry Point

**Files:**
- Create: `entrypoints/sidepanel/index.html`
- Create: `entrypoints/sidepanel/main.tsx`
- Create: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: Create side panel HTML**

Create `entrypoints/sidepanel/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tab Zen</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create side panel main.tsx**

Create `entrypoints/sidepanel/main.tsx`:

```tsx
import { render } from "solid-js/web";
import "@/assets/global.css";
import App from "./App";

render(() => <App />, document.getElementById("app")!);
```

- [ ] **Step 3: Create side panel App.tsx**

Create `entrypoints/sidepanel/App.tsx`:

```tsx
import { createSignal, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import TabCollection from "@/components/TabCollection";
import SettingsPanel from "@/components/SettingsPanel";
import type { Settings } from "@/lib/types";

export default function App() {
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");
  const [showSettings, setShowSettings] = createSignal(false);

  // Load saved view mode
  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full h-screen">
      <Show
        when={!showSettings()}
        fallback={<SettingsPanel onClose={() => setShowSettings(false)} />}
      >
        <TabCollection
          viewMode={viewMode()}
          onViewModeChange={handleViewModeChange}
          showExpandButton={true}
        />
      </Show>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidepanel/
git commit -m "feat: add side panel entry point"
```

---

### Task 19: Full Page Entry Point

**Files:**
- Create: `entrypoints/tabs/index.html`
- Create: `entrypoints/tabs/main.tsx`
- Create: `entrypoints/tabs/App.tsx`

- [ ] **Step 1: Create full page HTML**

Create `entrypoints/tabs/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tab Zen</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create full page main.tsx**

Create `entrypoints/tabs/main.tsx`:

```tsx
import { render } from "solid-js/web";
import "@/assets/global.css";
import App from "./App";

render(() => <App />, document.getElementById("app")!);
```

- [ ] **Step 3: Create full page App.tsx**

Create `entrypoints/tabs/App.tsx`:

```tsx
import { createSignal, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import TabCollection from "@/components/TabCollection";
import SettingsPanel from "@/components/SettingsPanel";
import type { Settings } from "@/lib/types";

export default function App() {
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");
  const [showSettings, setShowSettings] = createSignal(false);

  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full min-h-screen bg-slate-900">
      <div class="max-w-5xl mx-auto h-screen">
        <Show
          when={!showSettings()}
          fallback={<SettingsPanel onClose={() => setShowSettings(false)} />}
        >
          <TabCollection
            viewMode={viewMode()}
            onViewModeChange={handleViewModeChange}
            showExpandButton={false}
          />
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add entrypoints/tabs/
git commit -m "feat: add full page entry point"
```

---

### Task 20: Popup Entry Point

**Files:**
- Modify: `entrypoints/popup/index.html`
- Modify: `entrypoints/popup/main.tsx`
- Modify: `entrypoints/popup/App.tsx`
- Delete: `entrypoints/popup/App.css`
- Delete: `entrypoints/popup/style.css`

- [ ] **Step 1: Update popup HTML**

Replace `entrypoints/popup/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="manifest.default_icon" content="{ &quot;16&quot;: &quot;/icon/16.png&quot;, &quot;32&quot;: &quot;/icon/32.png&quot;, &quot;48&quot;: &quot;/icon/48.png&quot;, &quot;96&quot;: &quot;/icon/96.png&quot;, &quot;128&quot;: &quot;/icon/128.png&quot; }" />
    <title>Tab Zen</title>
  </head>
  <body style="width: 320px;">
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update popup main.tsx**

Replace `entrypoints/popup/main.tsx` with:

```tsx
import { render } from "solid-js/web";
import "@/assets/global.css";
import App from "./App";

render(() => <App />, document.getElementById("app")!);
```

- [ ] **Step 3: Update popup App.tsx**

Replace `entrypoints/popup/App.tsx` with:

```tsx
import { createSignal, createResource, Show } from "solid-js";
import { sendMessage } from "@/lib/messages";
import type { CapturePreviewData } from "@/lib/types";

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [capturePreview, setCapturePreview] = createSignal<CapturePreviewData | null>(null);

  const [uncapturedCount] = createResource(async () => {
    const response = await sendMessage({ type: "GET_UNCAPTURED_COUNT" });
    return response.type === "UNCAPTURED_COUNT" ? response.count : 0;
  });

  const handleCaptureAll = async () => {
    setCapturing(true);
    const response = await sendMessage({ type: "CAPTURE_ALL_TABS" });
    if (response.type === "CAPTURE_PREVIEW") {
      setCapturePreview(response.data);
    }
    setCapturing(false);
  };

  const handleConfirm = async () => {
    const preview = capturePreview();
    if (preview) {
      await sendMessage({ type: "CONFIRM_CAPTURE", captureData: preview });
      setCapturePreview(null);
      window.close();
    }
  };

  const handleSaveCurrentTab = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await sendMessage({ type: "CAPTURE_SINGLE_TAB", tabId: tab.id });
      window.close();
    }
  };

  const openSidePanel = () => {
    browser.sidePanel.open({ windowId: undefined as unknown as number });
  };

  const openFullPage = () => {
    browser.tabs.create({ url: browser.runtime.getURL("/tabs.html") });
    window.close();
  };

  return (
    <div class="bg-slate-900 text-slate-200 p-4">
      <h1 class="text-base font-bold text-slate-50 mb-4">Tab Zen</h1>

      <Show when={!capturePreview()}>
        <div class="space-y-2">
          <button
            class="w-full px-3 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCaptureAll}
            disabled={capturing() || uncapturedCount() === 0}
          >
            {capturing()
              ? "Analyzing..."
              : uncapturedCount() === 0
                ? "All tabs captured"
                : `Capture All Tabs (${uncapturedCount()} new)`}
          </button>
          <button
            class="w-full px-3 py-2 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
            onClick={handleSaveCurrentTab}
          >
            Save This Tab
          </button>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800 flex gap-2">
          <button
            class="flex-1 px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200"
            onClick={openSidePanel}
          >
            Side Panel
          </button>
          <button
            class="flex-1 px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200"
            onClick={openFullPage}
          >
            Full Page
          </button>
        </div>
      </Show>

      <Show when={capturePreview()}>
        {(preview) => (
          <div>
            <p class="text-sm text-slate-300 mb-3">
              {preview().tabs.length} new tabs in {preview().groups.length}{" "}
              groups
            </p>
            <div class="space-y-1 max-h-48 overflow-y-auto mb-3">
              {preview().groups.map((g) => (
                <div class="text-xs text-slate-400">
                  <span class="text-slate-200 font-medium">{g.groupName}</span>{" "}
                  ({g.tabIds.length})
                </div>
              ))}
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
                onClick={() => setCapturePreview(null)}
              >
                Cancel
              </button>
              <button
                class="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
```

- [ ] **Step 4: Delete old CSS files**

```bash
rm entrypoints/popup/App.css entrypoints/popup/style.css
```

- [ ] **Step 5: Commit**

```bash
git add -A entrypoints/popup/
git commit -m "feat: replace popup with Tab Zen quick actions UI"
```

---

### Task 21: Clean Up Starter Assets

**Files:**
- Delete: `assets/solid.svg`
- Delete: `public/wxt.svg`

- [ ] **Step 1: Remove starter template assets**

```bash
rm assets/solid.svg public/wxt.svg
```

- [ ] **Step 2: Commit**

```bash
git add -A assets/ public/
git commit -m "chore: remove starter template assets"
```

---

### Task 22: Cloudflare Sync Service

**Files:**
- Create: `sync-service/package.json`
- Create: `sync-service/tsconfig.json`
- Create: `sync-service/wrangler.toml`
- Create: `sync-service/schema.sql`
- Create: `sync-service/src/index.ts`

- [ ] **Step 1: Create sync-service package.json**

Create `sync-service/package.json`:

```json
{
  "name": "tab-zen-sync",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "hono": "^4.7.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250327.0",
    "wrangler": "^4.10.0"
  }
}
```

- [ ] **Step 2: Create sync-service tsconfig.json**

Create `sync-service/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create wrangler.toml**

Create `sync-service/wrangler.toml`:

```toml
name = "tab-zen-sync"
main = "src/index.ts"
compatibility_date = "2025-04-01"

[[d1_databases]]
binding = "DB"
database_name = "tab-zen-sync"
database_id = "placeholder-replace-after-create"

[[kv_namespaces]]
binding = "KV"
id = "placeholder-replace-after-create"
```

- [ ] **Step 4: Create D1 schema**

Create `sync-service/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS tabs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  favicon TEXT NOT NULL DEFAULT '',
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  meta_description TEXT,
  notes TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  captured_at TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capture_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT '',
  tab_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_token TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tabs_sync ON tabs(sync_token, updated_at);
CREATE INDEX IF NOT EXISTS idx_groups_sync ON groups(sync_token, updated_at);
CREATE INDEX IF NOT EXISTS idx_captures_sync ON captures(sync_token, updated_at);
```

- [ ] **Step 5: Create the Hono Worker**

Create `sync-service/src/index.ts`:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

// --- Auth middleware ---
async function getToken(c: any): Promise<string | null> {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

async function validateToken(
  kv: KVNamespace,
  token: string,
): Promise<boolean> {
  const value = await kv.get(`token:${token}`);
  return value !== null;
}

// --- Routes ---

app.post("/sync/init", async (c) => {
  const token = crypto.randomUUID();
  await c.env.KV.put(`token:${token}`, JSON.stringify({ createdAt: new Date().toISOString() }));

  // Run schema creation
  await c.env.DB.exec(`
    CREATE TABLE IF NOT EXISTS tabs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      favicon TEXT NOT NULL DEFAULT '',
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      meta_description TEXT,
      notes TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      last_viewed_at TEXT,
      captured_at TEXT NOT NULL,
      source_label TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      group_id TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_token TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capture_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_token TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      captured_at TEXT NOT NULL,
      source_label TEXT NOT NULL DEFAULT '',
      tab_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      sync_token TEXT NOT NULL
    );
  `);

  return c.json({ token });
});

app.post("/sync/verify", async (c) => {
  const token = await getToken(c);
  if (!token) return c.json({ valid: false }, 401);
  const valid = await validateToken(c.env.KV, token);
  return c.json({ valid });
});

app.post("/sync/push", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  // Upsert tabs
  if (body.tabs?.length) {
    for (const tab of body.tabs) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO tabs (id, url, title, favicon, og_title, og_description, og_image, meta_description, notes, view_count, last_viewed_at, captured_at, source_label, archived, group_id, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          tab.id, tab.url, tab.title, tab.favicon || "",
          tab.ogTitle, tab.ogDescription, tab.ogImage, tab.metaDescription,
          tab.notes, tab.viewCount || 0, tab.lastViewedAt,
          tab.capturedAt, tab.sourceLabel || "", tab.archived ? 1 : 0,
          tab.groupId, now, token,
        )
        .run();
    }
  }

  // Upsert groups
  if (body.groups?.length) {
    for (const group of body.groups) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO groups (id, name, capture_id, position, archived, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(group.id, group.name, group.captureId, group.position, group.archived ? 1 : 0, now, token)
        .run();
    }
  }

  // Upsert captures
  if (body.captures?.length) {
    for (const capture of body.captures) {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO captures (id, captured_at, source_label, tab_count, updated_at, sync_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(capture.id, capture.capturedAt, capture.sourceLabel || "", capture.tabCount || 0, now, token)
        .run();
    }
  }

  return c.json({ success: true });
});

app.post("/sync/pull", async (c) => {
  const token = await getToken(c);
  if (!token || !(await validateToken(c.env.KV, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const since = body.since || "1970-01-01T00:00:00Z";

  const tabs = await c.env.DB.prepare(
    "SELECT * FROM tabs WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  const groups = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  const captures = await c.env.DB.prepare(
    "SELECT * FROM captures WHERE sync_token = ? AND updated_at > ?",
  )
    .bind(token, since)
    .all();

  // Map D1 snake_case to camelCase
  const mapTab = (row: any) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    favicon: row.favicon,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImage: row.og_image,
    metaDescription: row.meta_description,
    notes: row.notes,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    capturedAt: row.captured_at,
    sourceLabel: row.source_label,
    archived: !!row.archived,
    groupId: row.group_id,
  });

  const mapGroup = (row: any) => ({
    id: row.id,
    name: row.name,
    captureId: row.capture_id,
    position: row.position,
    archived: !!row.archived,
  });

  const mapCapture = (row: any) => ({
    id: row.id,
    capturedAt: row.captured_at,
    sourceLabel: row.source_label,
    tabCount: row.tab_count,
  });

  return c.json({
    tabs: tabs.results.map(mapTab),
    groups: groups.results.map(mapGroup),
    captures: captures.results.map(mapCapture),
    lastSyncedAt: new Date().toISOString(),
  });
});

export default app;
```

- [ ] **Step 6: Install sync-service dependencies**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen/sync-service && npm install
```

- [ ] **Step 7: Commit**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen
git add sync-service/
git commit -m "feat: add Cloudflare Workers sync service with Hono, D1, and KV"
```

---

### Task 23: Install Extension Dependencies and Build Test

**Files:**
- None new — this is a verification task

- [ ] **Step 1: Install root dependencies**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && npm install
```

- [ ] **Step 2: Run WXT prepare (generates types)**

```bash
npm run postinstall
```

- [ ] **Step 3: Attempt build**

```bash
npm run build
```

Expected: Build completes. There may be minor type issues to fix — address them in the next step.

- [ ] **Step 4: Fix any build errors**

Review error output and fix issues. Common issues:
- Missing type imports (add explicit imports)
- Path alias resolution (ensure `@/` aliases work with WXT)
- Tailwind not processing (check postcss config)

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve build errors and verify extension compiles"
```

---

### Task 24: Final Verification and Extension Loading

- [ ] **Step 1: Build for Chrome**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen && npm run build
```

Expected: Successful build in `.output/chrome-mv3/`

- [ ] **Step 2: Verify output structure**

```bash
ls -la .output/chrome-mv3/
```

Expected: Contains `manifest.json`, `popup.html`, `sidepanel.html`, `tabs.html`, `background.js`, and `content-scripts/` directory.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: Tab Zen v0.1.0 - complete extension build ready for loading"
```
