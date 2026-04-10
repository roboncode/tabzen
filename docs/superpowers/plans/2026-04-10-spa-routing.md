# M5: SPA Routing & Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge separate entrypoints into a unified SPA with hash-based routing, rename the domain model from Tab→Page, and enable proper back/forward navigation with deep linking.

**Architecture:** Single `entrypoints/app/` serves both full-page and sidepanel contexts. `@solidjs/router` HashRouter handles `#/`, `#/page/:pageId`, `#/page/:pageId/:section`, and `#/settings`. Popup remains separate, with tab-reuse logic to focus existing SPA tabs.

**Tech Stack:** SolidJS, @solidjs/router, WXT, TypeScript, IndexedDB (idb), Chrome Extension APIs

**Spec:** `docs/superpowers/specs/2026-04-10-spa-routing-design.md`

---

## File Structure

### New Files
- `apps/extension/entrypoints/app/index.html` — SPA HTML shell
- `apps/extension/entrypoints/app/main.tsx` — SPA mount point
- `apps/extension/entrypoints/app/App.tsx` — Router root with route definitions
- `apps/extension/lib/routes.ts` — Section slug↔ID mapping, route helpers
- `apps/extension/components/PageCard.tsx` — Renamed from TabCard.tsx
- `apps/extension/components/PageCollection.tsx` — Renamed from TabCollection.tsx
- `apps/extension/components/PageRow.tsx` — Renamed from TabRow.tsx

### Modified Files
- `packages/shared/src/types.ts` — `Tab`→`Page`, `SyncPayload.tabs`→`SyncPayload.pages`, `AIDocument.tabId`→`AIDocument.pageId`
- `apps/extension/lib/types.ts` — Re-export `Page`, rename `CapturePreviewData.tabs`→`pages`, `AIGroupSuggestion.tabIds`→`pageIds`
- `apps/extension/lib/db.ts` — All Tab functions renamed to Page equivalents
- `apps/extension/lib/messages.ts` — Message type renames per spec
- `apps/extension/wxt.config.ts` — Add sidepanel default_path pointing to `app.html`
- `apps/extension/package.json` — Add `@solidjs/router` dependency
- `apps/extension/entrypoints/popup/App.tsx` — Tab-reuse logic, update URLs to `app.html#/page/:pageId`
- `apps/extension/entrypoints/background.ts` — Update all Tab→Page references, message handlers, URL references
- `apps/extension/components/detail/DetailPage.tsx` — Read route params, sync section to URL
- `apps/extension/components/detail/DetailHeader.tsx` — `Tab`→`Page` prop type, back uses navigate
- `apps/extension/components/detail/DocumentNav.tsx` — `activeTab`→`activeSection` prop
- `apps/extension/components/detail/DetailSidebar.tsx` — `tabId`→`pageId` in callback
- `apps/extension/components/detail/SocialPostsView.tsx` — `tabId`→`pageId` prop
- `apps/extension/components/GroupSection.tsx` — Import PageCard/PageRow instead of TabCard/TabRow
- `apps/extension/components/NotesEditor.tsx` — `tabId`→`pageId` param
- `apps/extension/components/CapturePreview.tsx` — `tabs`→`pages` field reference
- `apps/extension/components/SettingsPanel.tsx` — Remove onClose, use navigate
- `apps/extension/components/AppSidebar.tsx` — If references Tab type
- `apps/extension/tests/capture-flow.test.ts` — Update type imports and variable names
- `apps/api/src/routes/content.ts` — `tabId`→`pageId` in params and body
- `apps/api/src/services/sync-service.ts` — `mapTab`→`mapPage`, `body.tabs`→`body.pages`

### Deleted Files
- `apps/extension/entrypoints/detail/` — Entire directory (merged into SPA)
- `apps/extension/entrypoints/sidepanel/` — Entire directory (sidepanel uses app.html)
- `apps/extension/entrypoints/tabs/` — Entire directory (replaced by app/)
- `apps/extension/components/TabCard.tsx` — Replaced by PageCard.tsx
- `apps/extension/components/TabCollection.tsx` — Replaced by PageCollection.tsx
- `apps/extension/components/TabRow.tsx` — Replaced by PageRow.tsx

---

## Task 1: Domain Rename — Shared Types

**Parallel group: A** (can run simultaneously with Task 2, 3)

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Rename Tab→Page and update SyncPayload and AIDocument**

In `packages/shared/src/types.ts`, make these changes:

1. Rename `interface Tab` → `interface Page`
2. In `SyncPayload`, rename `tabs: Tab[]` → `pages: Page[]`
3. In `AIDocument`, rename `tabId: string` → `pageId: string`

```typescript
// Line 1: Tab → Page
export interface Page {
  id: string;
  url: string;
  title: string;
  // ... all fields stay the same
}

// Line 59: SyncPayload
export interface SyncPayload {
  pages: Page[];  // was tabs: Tab[]
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

// Line 89: AIDocument
export interface AIDocument {
  id: string;
  pageId: string;  // was tabId
  templateId: string;
  content: string;
  generatedAt: string;
  promptUsed: string;
  sourceHash?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "refactor: rename Tab→Page in shared types, SyncPayload.tabs→pages, AIDocument.tabId→pageId"
```

---

## Task 2: Domain Rename — Extension Types & DB

**Parallel group: A**

**Files:**
- Modify: `apps/extension/lib/types.ts`
- Modify: `apps/extension/lib/db.ts`

- [ ] **Step 1: Update extension type re-exports and interfaces**

In `apps/extension/lib/types.ts`:

```typescript
// Line 1-3: Update re-exports
import type { Page, Group, Capture, SyncPayload, AITemplate, AIDocument } from "@tab-zen/shared";
export type { Page, Group, Capture, SyncPayload, AITemplate, AIDocument };

// Line 74-77: Rename tabIds → pageIds
export interface AIGroupSuggestion {
  groupName: string;
  pageIds: string[];  // was tabIds
}

// Line 79-83: Rename tabs → pages
export interface CapturePreviewData {
  captureId: string;
  groups: AIGroupSuggestion[];
  pages: Page[];  // was tabs: Tab[]
}
```

- [ ] **Step 2: Rename all DB functions from Tab→Page**

In `apps/extension/lib/db.ts`:

1. Update import: `import type { Page, Group, Capture, AITemplate, AIDocument } from "./types";`
2. In the `TabZenDB` schema interface, update the `tabs` store value type to `Page` (store name stays `"tabs"`)
3. In the `aiDocuments` store, the index `"by-tabId"` stays as-is (IndexedDB key name matches the old field — but now the field is `pageId`). Update the index to `"by-pageId"` and update the keyPath. **Wait** — changing an index name requires a DB version bump and migration. To avoid data loss, keep the index name `"by-tabId"` but note the field is now `pageId`. Actually, the index keyPath must match the field name. Since we're renaming `tabId` to `pageId` in `AIDocument`, we need a DB migration (version 3) that recreates the index.

Add version 3 upgrade:

```typescript
if (oldVersion < 3) {
  // Recreate aiDocuments index for renamed field pageId (was tabId)
  const docStore = db.transaction.objectStore("aiDocuments");
  docStore.deleteIndex("by-tabId");
  docStore.createIndex("by-pageId", "pageId");
}
```

Update the `TabZenDB` schema:

```typescript
aiDocuments: {
  key: string;
  value: AIDocument;
  indexes: {
    "by-pageId": string;  // was "by-tabId"
    "by-templateId": string;
  };
};
```

Update DB version from 2 to 3:

```typescript
dbInstance = await openDB<TabZenDB>("tab-zen", 3, {
```

4. Rename all function names and parameter types. Full list of renames:

| Old | New |
|---|---|
| `addTab(tab: Tab)` | `addPage(page: Page)` |
| `addTabs(tabs: Tab[])` | `addPages(pages: Page[])` |
| `getTab(id)` | `getPage(id)` |
| `getAllTabs()` | `getAllPages()` |
| `getTabsByGroup(groupId)` | `getPagesByGroup(groupId)` |
| `getTabByUrl(url)` | `getPageByUrl(url)` |
| `updateTab(id, updates)` | `updatePage(id, updates)` |
| `hardDeleteTab(id)` | `hardDeletePage(id)` |
| `softDeleteTab(id)` | `softDeletePage(id)` |
| `restoreTab(id)` | `restorePage(id)` |
| `purgeDeletedTabs(days)` | `purgeDeletedPages(days)` |
| `searchTabs(query)` | `searchPages(query)` |
| `getDocumentsForTab(tabId)` | `getDocumentsForPage(pageId)` |
| `deleteDocumentsForTab(tabId)` | `deleteDocumentsForPage(pageId)` |
| `getDocument(tabId, templateId)` | `getDocument(pageId, templateId)` |
| `getAllData()` returns `{ tabs }` | returns `{ pages }` |
| `importData({ tabs })` | `importData({ pages })` |
| `clearProfileData` internal vars | rename `tab`→`page` in loops |

For `getDocumentsForPage` and `getDocument`, update the index name from `"by-tabId"` to `"by-pageId"`:

```typescript
export async function getDocumentsForPage(pageId: string): Promise<AIDocument[]> {
  const db = await getDB();
  return db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
}

export async function getDocument(pageId: string, templateId: string): Promise<AIDocument | undefined> {
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
  return docs.find((d) => d.templateId === templateId);
}
```

Also update `putDocument` which references `doc.tabId` → `doc.pageId`:

```typescript
export async function putDocument(doc: AIDocument): Promise<void> {
  const db = await getDB();
  const existing = await getDocument(doc.pageId, doc.templateId);
  if (existing) {
    await db.delete("aiDocuments", existing.id);
  }
  await db.put("aiDocuments", doc);
}
```

And `deleteDocumentsForPage`:

```typescript
export async function deleteDocumentsForPage(pageId: string): Promise<void> {
  const db = await getDB();
  const docs = await db.getAllFromIndex("aiDocuments", "by-pageId", pageId);
  const tx = db.transaction("aiDocuments", "readwrite");
  for (const doc of docs) {
    tx.store.delete(doc.id);
  }
  await tx.done;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/types.ts apps/extension/lib/db.ts
git commit -m "refactor: rename Tab→Page in extension types and DB functions, add v3 migration for pageId index"
```

---

## Task 3: Domain Rename — Messages

**Parallel group: A**

**Files:**
- Modify: `apps/extension/lib/messages.ts`

- [ ] **Step 1: Rename message types**

```typescript
import type { CapturePreviewData, Page } from "./types";

export type MessageRequest =
  | { type: "CAPTURE_ALL_TABS" }  // keeps "TABS" — refers to browser tabs
  | { type: "CAPTURE_PAGE"; tabId: number }  // was CAPTURE_SINGLE_TAB; tabId here is browser tab ID, keep as tabId
  | { type: "CONFIRM_CAPTURE"; captureData: CapturePreviewData }
  | { type: "GET_UNCAPTURED_COUNT" }
  | { type: "SEARCH_PAGES"; query: string }  // was SEARCH_TABS
  | { type: "AI_SEARCH"; query: string }
  | { type: "OPEN_PAGE"; pageId: string }  // was OPEN_TAB with tabId
  | { type: "GET_METADATA"; url: string }
  | { type: "GET_TRANSCRIPT"; pageId: string }  // was tabId
  | { type: "GET_CONTENT"; pageId: string }  // was tabId
  | { type: "RE_EXTRACT_CONTENT"; pageId: string }  // was tabId
  | { type: "SYNC_NOW" }
  | { type: "QUICK_CAPTURE" }
  | { type: "IS_URL_SAVED"; url: string }
  | { type: "LOOKUP_PRODUCT"; name: string }
  | { type: "LOOKUP_WIKI_IMAGE"; title: string };

export type MessageResponse =
  | { type: "CAPTURE_PREVIEW"; data: CapturePreviewData }
  | { type: "UNCAPTURED_COUNT"; count: number }
  | { type: "SEARCH_RESULTS"; pages: Page[] }  // was tabs: Tab[]
  | { type: "PAGE_OPENED"; page: Page }  // was TAB_OPENED with tab: Tab
  | { type: "METADATA"; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; metaDescription: string | null }
  | { type: "TRANSCRIPT"; transcript: { text: string; startMs: number; durationMs: number }[] | null }
  | { type: "CONTENT"; content: string | null }
  | { type: "ERROR"; message: string }
  | { type: "SUCCESS" }
  | { type: "SYNC_COMPLETE"; pushed: number; pulled: number }
  | { type: "QUICK_CAPTURE_DONE"; saved: number; skipped: number }
  | { type: "URL_SAVED"; saved: boolean; pageId?: string }  // was tabId
  | { type: "PRODUCT_LOOKUP"; url: string | null; image: string | null; description: string | null }
  | { type: "WIKI_IMAGE"; url: string | null };

export function sendMessage(message: MessageRequest): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/lib/messages.ts
git commit -m "refactor: rename Tab→Page in message types"
```

---

## Task 4: Domain Rename — Background Script

**Depends on:** Tasks 1, 2, 3

**Files:**
- Modify: `apps/extension/entrypoints/background.ts`

This is the largest file (~1500 lines). The rename touches imports, function calls, variable names, message handler cases, and URL references.

- [ ] **Step 1: Update imports**

Change all imports from `@/lib/db` to use new function names (`addPage`, `getPage`, `getAllPages`, `updatePage`, `softDeletePage`, `hardDeletePage`, `restorePage`, `getPageByUrl`, `searchPages`, `getDocumentsForPage`, `deleteDocumentsForPage`, etc.).

Change type imports from `Tab` to `Page`.

- [ ] **Step 2: Update message router cases**

In the main message handler (around line 304-350), update:

```typescript
case "CAPTURE_PAGE":        // was CAPTURE_SINGLE_TAB
  return handleCapturePage(message.tabId);  // browser tab ID stays as tabId
case "SEARCH_PAGES":        // was SEARCH_TABS  
  return handleSearchPages(message.query);
case "OPEN_PAGE":           // was OPEN_TAB
  return handleOpenPage(message.pageId);
case "GET_TRANSCRIPT":
  return handleGetTranscript(message.pageId);  // was message.tabId
case "GET_CONTENT":
  return handleGetContent(message.pageId);
case "RE_EXTRACT_CONTENT":
  return handleReExtractContent(message.pageId);
```

- [ ] **Step 3: Rename handler functions and internal variables**

Rename all handler functions:
- `handleCaptureSingleTab` → `handleCapturePage`
- `handleCaptureAllTabs` → `handleCaptureAllTabs` (stays — captures browser tabs)
- `handleOpenTab` → `handleOpenPage`
- `handleGetTranscript(tabId)` → `handleGetTranscript(pageId)`
- `handleGetContent(tabId)` → `handleGetContent(pageId)`
- `handleReExtractContent(tabId)` → `handleReExtractContent(pageId)`
- `handleSearchTabs` → `handleSearchPages`

Inside each function, rename local variables: `tab` → `page`, `tabs` → `pages`, `savedTab` → `savedPage`, `existingTab` → `existingPage`, etc.

Update all DB calls: `getTab()` → `getPage()`, `addTab()` → `addPage()`, `updateTab()` → `updatePage()`, etc.

Update all `notifyDataChanged()` calls remain unchanged.

- [ ] **Step 4: Update URL references**

Change all references to `detail.html` and `tabs.html` to `app.html`:
- `browser.runtime.getURL('/detail.html?tabId=...')` → `browser.runtime.getURL('/app.html#/page/...')`
- `browser.runtime.getURL('/tabs.html')` → `browser.runtime.getURL('/app.html')`

- [ ] **Step 5: Update response types**

Where handler functions return responses, update:
- `{ type: "TAB_OPENED", tab }` → `{ type: "PAGE_OPENED", page }`
- `{ type: "SEARCH_RESULTS", tabs }` → `{ type: "SEARCH_RESULTS", pages }`
- `{ type: "URL_SAVED", saved: true, tabId }` → `{ type: "URL_SAVED", saved: true, pageId }`

- [ ] **Step 6: Update SyncPayload references**

In sync push/pull functions, change `data.tabs` → `data.pages`, and ensure the payload structure matches the updated `SyncPayload` type.

- [ ] **Step 7: Update CapturePreviewData references**

In `buildCapturePreview` and `confirmCapture`, update:
- `preview.tabs` → `preview.pages`
- `group.tabIds` → `group.pageIds`
- Local variable `tab` → `page` where it refers to the domain object (not `browser.tabs` API)

- [ ] **Step 8: Commit**

```bash
git add apps/extension/entrypoints/background.ts
git commit -m "refactor: rename Tab→Page throughout background script"
```

---

## Task 5: Domain Rename — UI Components

**Depends on:** Tasks 1, 2, 3

**Files:**
- Rename: `apps/extension/components/TabCard.tsx` → `PageCard.tsx`
- Rename: `apps/extension/components/TabCollection.tsx` → `PageCollection.tsx`
- Rename: `apps/extension/components/TabRow.tsx` → `PageRow.tsx`
- Modify: `apps/extension/components/GroupSection.tsx`
- Modify: `apps/extension/components/NotesEditor.tsx`
- Modify: `apps/extension/components/CapturePreview.tsx`
- Modify: `apps/extension/components/detail/DetailPage.tsx`
- Modify: `apps/extension/components/detail/DetailHeader.tsx`
- Modify: `apps/extension/components/detail/DetailSidebar.tsx`
- Modify: `apps/extension/components/detail/SocialPostsView.tsx`
- Modify: `apps/extension/components/detail/DocumentNav.tsx`
- Modify: `apps/extension/components/NotesDisplay.tsx`

- [ ] **Step 1: Create PageCard.tsx (rename from TabCard)**

Copy `TabCard.tsx` to `PageCard.tsx`. Apply renames:
- `interface TabCardProps` → `interface PageCardProps`
- `tab: Tab` → `page: Page`
- `export default function TabCard` → `export default function PageCard`
- All `props.tab.xxx` → `props.page.xxx`
- Callback signatures: `onOpen: (tab: Tab) => void` → `onOpen: (page: Page) => void`, etc.
- `onExpand?: (tab: Tab) => void` → `onExpand?: (page: Page) => void`
- Import `Page` instead of `Tab`
- All internal `tab` → `page` references in callbacks like `props.onOpen(props.page)`

Delete `TabCard.tsx` after.

- [ ] **Step 2: Create PageRow.tsx (rename from TabRow)**

Same pattern as Step 1:
- `TabRowProps` → `PageRowProps`
- `tab: Tab` → `page: Page`
- `TabRow` → `PageRow`
- All prop references updated

Delete `TabRow.tsx` after.

- [ ] **Step 3: Create PageCollection.tsx (rename from TabCollection)**

This is the largest component. Key renames:
- `TabCollectionProps` → `PageCollectionProps`
- `TabCollection` → `PageCollection`
- Import `Page` instead of `Tab` from `@/lib/types`
- Import new DB functions: `getAllPages`, `updatePage`, `softDeletePage`, `hardDeletePage`, `restorePage`
- Import `PageCard`, `PageRow` from renamed files
- Signal names: `allTabs`→`allPages`, `setAllTabs`→`setAllPages`, `editingTab`→`editingPage`, `setEditingTab`→`setEditingPage`, `deletingTab`→`deletingPage`, `setDeletingTab`→`setDeletingPage`
- `searchResults` type: `Tab[] | null` → `Page[] | null`
- `patchTab` → `patchPage`
- All message type references: `SEARCH_TABS`→`SEARCH_PAGES`, response `tabs`→`pages`
- URL references: `detail.html?tabId=` → will be updated to use router in Task 8

Delete `TabCollection.tsx` after.

- [ ] **Step 4: Update GroupSection.tsx**

Update imports to use `PageCard` and `PageRow` instead of `TabCard` and `TabRow`. Update any `Tab` type references to `Page`.

- [ ] **Step 5: Update detail components**

**DetailPage.tsx:**
- `import { Tab }` → `import { Page }`
- `tab: Tab` prop → `page: Page` prop  
- `currentTab`/`setCurrentTab` → `currentPage`/`setCurrentPage`
- `activeDocTab`/`setActiveDocTab` → `activeSection`/`setActiveSection`
- All DB calls: `updateTab`→`updatePage`, `getTab`→`getPage`, `softDeleteTab`→`softDeletePage`, `getDocumentsForTab`→`getDocumentsForPage`
- `tabId` references that mean domain page ID → `pageId`
- `doc.tabId` → `doc.pageId` when creating AIDocument objects

**DetailHeader.tsx:**
- `tab: Tab` → `page: Page` in `DetailHeaderProps`
- All `props.tab.xxx` → `props.page.xxx`

**DocumentNav.tsx:**
- `activeTab` prop → `activeSection`
- `onTabChange` → `onSectionChange`
- All internal references: `props.activeTab` → `props.activeSection`, `props.onTabChange` → `props.onSectionChange`

**DetailSidebar.tsx:**
- `onSaveNotes: (tabId, notes)` → `onSaveNotes: (pageId, notes)`

**SocialPostsView.tsx:**
- `tabId` prop → `pageId`
- DB calls: `getDocumentsForTab` → `getDocumentsForPage`
- AIDocument creation: `tabId` → `pageId`

- [ ] **Step 6: Update remaining components**

**NotesEditor.tsx:** `tabId` → `pageId` in callback signature
**NotesDisplay.tsx:** Any `Tab` type references → `Page`
**CapturePreview.tsx:** `tabs` → `pages` field on `CapturePreviewData`, `tabIds` → `pageIds` on groups

- [ ] **Step 7: Commit**

```bash
git add -A apps/extension/components/
git commit -m "refactor: rename Tab→Page across all UI components"
```

---

## Task 6: Domain Rename — API & Sync Service

**Parallel group: A** (can run with Tasks 4, 5)

**Files:**
- Modify: `apps/api/src/routes/content.ts`
- Modify: `apps/api/src/services/sync-service.ts`
- Modify: `apps/api/src/routes/sync.ts` (if it references SyncPayload.tabs)

- [ ] **Step 1: Update content routes**

In `apps/api/src/routes/content.ts`:

```typescript
content.post("/transcript", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const body = await c.req.json();
  const { pageId, segments } = body;  // was tabId

  if (!pageId || !segments) {
    return c.json({ error: "pageId and segments are required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const contentKey = await service.storeTranscript(token, pageId, segments);
  return c.json({ contentKey });
});

content.get("/transcript/:pageId", requireAuth, async (c) => {
  const token = c.get("token" as never) as string;
  const pageId = c.req.param("pageId");
  if (!pageId) {
    return c.json({ error: "pageId is required" }, 400);
  }

  const service = new ContentService(c.env.CONTENT);
  const segments = await service.getTranscript(token, pageId);

  if (!segments) {
    return c.json({ error: "Transcript not found" }, 404);
  }

  return c.json({ segments });
});
```

- [ ] **Step 2: Update sync service**

In `apps/api/src/services/sync-service.ts`:

- `mapTab` → `mapPage`
- In `push()`: `body.tabs` → `body.pages`, loop variable `tab` → `page`
- In `pull()`: `tabs.results.map(this.mapTab)` → `tabs.results.map(this.mapPage)`, return `pages:` instead of `tabs:`
- The SQL still queries the `tabs` table — that's fine, table name doesn't change
- In `mapPage()`, the return type is now `Page` (was `Tab`)

- [ ] **Step 3: Update sync routes if needed**

Check `apps/api/src/routes/sync.ts` for any references to `SyncPayload.tabs` and update to `.pages`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/
git commit -m "refactor: rename Tab→Page in API routes and sync service"
```

---

## Task 7: Domain Rename — Tests & Remaining Files

**Depends on:** Tasks 1, 2, 3

**Files:**
- Modify: `apps/extension/tests/capture-flow.test.ts`
- Modify: Any other test files
- Modify: `apps/extension/lib/ai.ts` (if it has Tab references)

- [ ] **Step 1: Update test files**

In `apps/extension/tests/capture-flow.test.ts`:
- `import type { Tab }` → `import type { Page }`
- `tabsWithMeta: Tab[]` → `pagesWithMeta: Page[]`
- `validTabIds` → `validPageIds`
- `assignedTabIds` → `assignedPageIds`
- `matchedTabIds` → `matchedPageIds`
- `tabIds` in group objects → `pageIds`
- Variable names `tab` → `page` in test bodies

- [ ] **Step 2: Search for any remaining Tab references**

Run: `grep -rn "Tab\b" apps/extension/lib/ apps/extension/components/ --include="*.ts" --include="*.tsx" | grep -v "browser\.tabs" | grep -v "TabZen" | grep -v "activeFilter" | grep -v "DocumentTabs" | grep -v "node_modules"`

Fix any remaining domain-concept `Tab` references.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename Tab→Page in tests and remaining files"
```

---

## Task 8: Install Router & Create Route Helpers

**Depends on:** Tasks 1-7 (domain rename complete)

**Files:**
- Modify: `apps/extension/package.json`
- Create: `apps/extension/lib/routes.ts`

- [ ] **Step 1: Install @solidjs/router**

```bash
cd apps/extension && pnpm add @solidjs/router
```

- [ ] **Step 2: Create route helpers**

Create `apps/extension/lib/routes.ts`:

```typescript
/** Bidirectional mapping between URL slugs and internal section IDs */

const SLUG_TO_ID: Record<string, string> = {
  "content": "content",
  "custom": "custom",
  "key-points": "builtin-key-points",
  "action-items": "builtin-action-items",
  "eli5": "builtin-eli5",
  "products-mentions": "builtin-products-mentions",
  "sponsors": "builtin-sponsors",
  "social-posts": "builtin-social-posts",
};

const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_ID).map(([slug, id]) => [id, slug]),
);

/** Convert a URL slug to an internal section ID. Custom templates use `tmpl-<uuid>` format. */
export function slugToSectionId(slug: string | undefined): string {
  if (!slug) return "content";
  if (SLUG_TO_ID[slug]) return SLUG_TO_ID[slug];
  if (slug.startsWith("tmpl-")) return slug.slice(5); // strip "tmpl-" prefix → UUID
  return "content"; // unknown slug defaults to content
}

/** Convert an internal section ID to a URL slug. */
export function sectionIdToSlug(id: string): string {
  if (ID_TO_SLUG[id]) return ID_TO_SLUG[id];
  // Custom template — use tmpl-<uuid> format
  return `tmpl-${id}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/package.json apps/extension/lib/routes.ts pnpm-lock.yaml
git commit -m "feat: install @solidjs/router and create section slug mapping helpers"
```

---

## Task 9: Create SPA Entrypoint

**Depends on:** Task 8

**Files:**
- Create: `apps/extension/entrypoints/app/index.html`
- Create: `apps/extension/entrypoints/app/main.tsx`
- Create: `apps/extension/entrypoints/app/App.tsx`
- Delete: `apps/extension/entrypoints/tabs/`
- Delete: `apps/extension/entrypoints/detail/`
- Delete: `apps/extension/entrypoints/sidepanel/`

- [ ] **Step 1: Create app/index.html**

Copy from `entrypoints/tabs/index.html` (should be a standard HTML shell with a div#app). Verify its content first, then create:

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

- [ ] **Step 2: Create app/main.tsx**

```tsx
import { render } from "solid-js/web";
import App from "./App";
import "@/assets/main.css";

render(() => <App />, document.getElementById("app")!);
```

Check the existing `entrypoints/tabs/main.tsx` and `entrypoints/detail/main.tsx` for the exact CSS import path — match it.

- [ ] **Step 3: Create app/App.tsx**

```tsx
import { HashRouter, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import { Toaster } from "solid-sonner";

const PageList = lazy(() => import("@/pages/PageList"));
const PageDetail = lazy(() => import("@/pages/PageDetail"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

export default function App() {
  return (
    <>
      <HashRouter>
        <Route path="/" component={PageList} />
        <Route path="/page/:pageId" component={PageDetail} />
        <Route path="/page/:pageId/:section" component={PageDetail} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="*" component={PageList} />
      </HashRouter>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1e1e22",
            border: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      />
      <style>{`
        [data-sonner-toast] [data-title] {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #dfdfd6 !important;
          margin-bottom: 4px !important;
        }
        [data-sonner-toast] [data-description] {
          font-size: 14px !important;
          font-weight: 400 !important;
          color: rgba(223,223,214,0.35) !important;
        }
        [data-sonner-toast] [data-button] {
          margin-left: 6px !important;
        }
      `}</style>
    </>
  );
}
```

- [ ] **Step 4: Delete old entrypoints**

```bash
rm -rf apps/extension/entrypoints/tabs
rm -rf apps/extension/entrypoints/detail
rm -rf apps/extension/entrypoints/sidepanel
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: create unified app/ entrypoint with HashRouter, remove old entrypoints"
```

---

## Task 10: Create Page Components (Route Pages)

**Depends on:** Task 9

**Files:**
- Create: `apps/extension/pages/PageList.tsx`
- Create: `apps/extension/pages/PageDetail.tsx`
- Create: `apps/extension/pages/SettingsPage.tsx`

- [ ] **Step 1: Create PageList.tsx**

This wraps the existing `PageCollection` component (formerly TabCollection) with the view mode and settings navigation logic from the old `tabs/App.tsx`:

```tsx
import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getSettings, updateSettings } from "@/lib/settings";
import PageCollection from "@/components/PageCollection";
import type { Settings } from "@/lib/types";

export default function PageList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");

  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full min-h-screen bg-background flex">
      <div class="flex-1 h-screen min-w-0">
        <PageCollection
          viewMode={viewMode()}
          onViewModeChange={handleViewModeChange}
          showExpandButton={false}
          onOpenSettings={() => navigate("/settings")}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PageDetail.tsx**

This replaces the old `detail/App.tsx` — reads route params and renders `DetailPage`:

```tsx
import { createResource, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { getPage } from "@/lib/db";
import DetailPage from "@/components/detail/DetailPage";

export default function PageDetail() {
  const params = useParams<{ pageId: string; section?: string }>();
  const navigate = useNavigate();

  const [page] = createResource(
    () => params.pageId,
    async (id) => (id ? getPage(id) : undefined),
  );

  return (
    <Show
      when={page()}
      fallback={
        <div class="flex flex-col items-center justify-center h-screen bg-background gap-3">
          <p class="text-muted-foreground text-sm">
            {page.loading ? "Loading..." : "Page not found"}
          </p>
          <Show when={!page.loading}>
            <button
              class="text-sm text-sky-400 hover:text-sky-300 transition-colors"
              onClick={() => navigate("/")}
            >
              Back to pages
            </button>
          </Show>
        </div>
      }
    >
      {(p) => <DetailPage page={p()} initialSection={params.section} />}
    </Show>
  );
}
```

- [ ] **Step 3: Create SettingsPage.tsx**

```tsx
import { useNavigate } from "@solidjs/router";
import SettingsPanel from "@/components/SettingsPanel";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div class="w-full min-h-screen bg-background">
      <SettingsPanel onClose={() => navigate("/")} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/extension/pages/
git commit -m "feat: create PageList, PageDetail, and SettingsPage route components"
```

---

## Task 11: Wire DetailPage to Router

**Depends on:** Tasks 5, 8, 10

**Files:**
- Modify: `apps/extension/components/detail/DetailPage.tsx`

This is the critical integration — DetailPage needs to read the section from route params and sync section changes back to the URL.

- [ ] **Step 1: Add router integration to DetailPage**

Add `initialSection` prop and router navigation:

```tsx
import { useNavigate, useParams } from "@solidjs/router";
import { slugToSectionId, sectionIdToSlug } from "@/lib/routes";
```

Update the component interface to accept `initialSection`:

```tsx
interface DetailPageProps {
  page: Page;
  initialSection?: string;
}
```

Initialize `activeSection` from route param:

```tsx
const params = useParams<{ pageId: string; section?: string }>();
const navigate = useNavigate();

// Initialize from URL param
const initialSectionId = slugToSectionId(props.initialSection || params.section);
const [activeSection, setActiveSection] = createSignal<string>(initialSectionId);
```

Add an effect to sync section changes to URL:

```tsx
import { createEffect, on } from "solid-js";

// Sync section changes to URL (skip initial render)
createEffect(on(activeSection, (section) => {
  const slug = sectionIdToSlug(section);
  const basePath = `/page/${props.page.id}`;
  const targetPath = slug === "content" ? basePath : `${basePath}/${slug}`;
  // Only navigate if URL doesn't match (avoid infinite loops)
  const currentSection = params.section;
  const currentSlug = currentSection || "content";
  const newSlug = slug === "content" ? "content" : slug;
  if (currentSlug !== newSlug) {
    navigate(targetPath, { replace: true });
  }
}, { defer: true }));
```

- [ ] **Step 2: Update back button handler**

Replace `window.close()` with router navigation:

```typescript
const handleBack = () => {
  navigate("/");
};
```

- [ ] **Step 3: Update DocumentNav callback**

Where `onTabChange` was used (now `onSectionChange`), ensure it updates `activeSection` which triggers the URL sync effect.

- [ ] **Step 4: Update PageCollection navigation**

In `PageCollection.tsx`, update the card click handler to use router navigation instead of `window.open`:

```typescript
import { useNavigate } from "@solidjs/router";

// Inside component:
const navigate = useNavigate();

// Where tabs were opened:
const handleOpen = (page: Page) => {
  navigate(`/page/${page.id}`);
};
```

Remove the `window.open(detailUrl, "_blank")` call and any expand button logic.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/detail/DetailPage.tsx apps/extension/components/PageCollection.tsx
git commit -m "feat: wire DetailPage and PageCollection to router for URL-synced navigation"
```

---

## Task 12: Update Popup with Tab-Reuse Logic

**Depends on:** Tasks 4, 8

**Files:**
- Modify: `apps/extension/entrypoints/popup/App.tsx`

- [ ] **Step 1: Add tab-reuse helper and update navigation**

Add a helper function to find and focus an existing SPA tab:

```typescript
async function openOrFocusSPA(hash: string = "") {
  const appUrl = browser.runtime.getURL("/app.html");
  const existing = await browser.tabs.query({ url: `${appUrl}*` });
  if (existing.length > 0 && existing[0].id) {
    await browser.tabs.update(existing[0].id, { url: `${appUrl}#${hash}`, active: true });
    if (existing[0].windowId) {
      await browser.windows.update(existing[0].windowId, { focused: true });
    }
  } else {
    await browser.tabs.create({ url: `${appUrl}#${hash}` });
  }
  window.close();
}
```

- [ ] **Step 2: Update handleCardClick**

```typescript
const handleCardClick = async () => {
  if (saved()) {
    const pageId = savedPageId();
    if (pageId) {
      await openOrFocusSPA(`/page/${pageId}`);
    }
  } else {
    const tab = activeTab();
    if (tab?.id) {
      const saveResponse = await sendMessage({ type: "CAPTURE_PAGE", tabId: tab.id });
      if (saveResponse.type === "ERROR") return;
      const response = await sendMessage({ type: "IS_URL_SAVED", url: tab.url });
      if (response.type === "URL_SAVED" && response.saved) {
        mutateSavedStatus({ saved: true, pageId: response.pageId });
      }
      setJustSaved(true);
      refetchCount();
    }
  };
};
```

Note: `savedTabId()` → `savedPageId()`, and the `savedStatus` resource references `response.pageId`.

- [ ] **Step 3: Update navigation buttons**

```typescript
const openFullPage = () => openOrFocusSPA("/");

// Settings links:
// The sync error "Fix" button:
onClick={() => openOrFocusSPA("/settings")}

// The blocked domains "Manage" button:
onClick={() => openOrFocusSPA("/settings")}
```

- [ ] **Step 4: Update UI text**

Change `"Save Tab"` → `"Save Page"` in the action footer (around line 331).

- [ ] **Step 5: Update message type references**

- `CAPTURE_SINGLE_TAB` → `CAPTURE_PAGE`
- `response.tabId` → `response.pageId`
- `savedTabId` → `savedPageId`

- [ ] **Step 6: Commit**

```bash
git add apps/extension/entrypoints/popup/App.tsx
git commit -m "feat: popup uses tab-reuse to open/focus existing SPA tab"
```

---

## Task 13: Configure WXT for Sidepanel

**Depends on:** Task 9

**Files:**
- Modify: `apps/extension/wxt.config.ts`

- [ ] **Step 1: Add sidepanel default_path**

```typescript
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
      "identity.email",
      "scripting",
    ],
    host_permissions: [
      "*://*.youtube.com/*",
      "<all_urls>",
    ],
    side_panel: {
      default_path: "app.html",
    },
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

- [ ] **Step 2: Commit**

```bash
git add apps/extension/wxt.config.ts
git commit -m "feat: configure sidepanel to use app.html"
```

---

## Task 14: Build Verification & Fix

**Depends on:** All previous tasks

**Files:** Various (fix any compilation errors)

- [ ] **Step 1: Run TypeScript compilation**

```bash
cd apps/extension && pnpm run compile
```

Fix any type errors found. Common issues:
- Missed `Tab` → `Page` renames
- Import paths for renamed/moved files
- Props mismatches after interface renames

- [ ] **Step 2: Run the build**

```bash
cd apps/extension && pnpm run build
```

Fix any build errors.

- [ ] **Step 3: Run tests**

```bash
cd apps/extension && pnpm test
```

Fix any test failures.

- [ ] **Step 4: Verify no remaining Tab domain references**

```bash
grep -rn "\bTab\b" apps/extension/lib/ apps/extension/components/ apps/extension/pages/ apps/extension/entrypoints/ --include="*.ts" --include="*.tsx" | grep -v "browser\.tabs" | grep -v "TabZen" | grep -v "node_modules" | grep -v "DocumentTabs" | grep -v "\.d\.ts"
```

Any remaining domain-concept `Tab` references should be fixed.

- [ ] **Step 5: Commit all fixes**

```bash
git add -A
git commit -m "fix: resolve compilation and build errors from Tab→Page rename and SPA routing"
```

---

## Task 15: Smoke Test & Final Polish

**Depends on:** Task 14

- [ ] **Step 1: Start dev server**

```bash
cd apps/extension && pnpm dev
```

- [ ] **Step 2: Manual testing checklist**

Load the extension in Chrome and verify:

1. `app.html#/` shows the page list
2. Click a page card → navigates to `#/page/:pageId` → detail page renders
3. Click Key Points in sidebar → URL updates to `#/page/:pageId/key-points`
4. Reload the page → still on Key Points section
5. Click Back → returns to `#/` (page list)
6. Browser back button → goes back to detail page
7. Browser forward button → goes forward
8. Navigate to `#/settings` → settings page renders
9. Settings back button → returns to list
10. Open popup → click saved page → existing SPA tab focuses with detail view
11. Open popup → click saved page when no SPA tab exists → new tab created
12. Sidepanel shows page list → click card → navigates to detail inline
13. Invalid page ID → shows "Page not found" with back link
14. Copy a detail URL → paste in new tab → opens correctly

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: M5 SPA routing & navigation complete"
```
