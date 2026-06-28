# AI Bookmark Organizer — Design

**Date:** 2026-06-28
**Status:** Draft (pending review)
**Area:** `apps/extension`

## Summary

Add an **"Organize tabs"** action to the popup that classifies every currently-open browser tab into named bookmark folders and writes them to the browser's native bookmarks via `browser.bookmarks`. The AI path (OpenRouter gpt-4o-mini, same key used by `groupPagesWithAI`) assigns tabs to semantically meaningful folder names; a deterministic fallback groups by `classifyMediaType` when no API key is present. All writes land under a single persistent **"Tab Zen"** root folder in "Other Bookmarks". On each run, the organizer reads existing Tab Zen sub-folders and places new tabs into the best-matching existing or new folder; it never reshuffles or deletes existing bookmarks.

A preview route (`#/organize`) in the SPA shows the proposed folder structure before any writes occur. The user confirms or cancels. The feature is Chrome + Firefox only; it is hidden on Safari via capability detection.

## Goals

- One-click popup action to organize all open tabs into named native bookmark folders.
- AI-driven grouping that respects existing Tab Zen bookmark folders on re-runs (incremental, stateful).
- Deterministic media-type fallback when no AI key is available.
- Preview-then-confirm flow; no writes without user consent.
- Idempotent execution: tabs already bookmarked under the Tab Zen root are skipped.
- Chrome + Firefox support; no impact on Safari users.

## Non-goals (v1)

- Inline editing of folder names or tab assignments in the preview (noted as v2).
- Closing duplicate tabs as part of this flow (independent popup "Close duplicates" action).
- Organizing the captured Tab Zen *collection* to bookmarks — the existing Settings "Export as Bookmarks" (HTML file) already covers that distinct use case.
- Sync of bookmark state across devices.
- Moving or deleting bookmarks that already exist under the Tab Zen root.
- Support for Safari (API absent; hidden via feature detection).

## Background / current state

- **Capture flow** (`background.ts` `buildCapturePreview()` + `CONFIRM_CAPTURE`) queries open tabs, deduplicates, groups by domain via `groupByDomain()`, and returns a `CapturePreviewData` payload. The confirmed pages are persisted to the extension's data layer. This is a distinct operation from bookmarking.
- **AI grouping** (`lib/ai.ts` `groupPagesWithAI`) calls OpenRouter directly, gated on `settings.openRouterApiKey`. The current `buildCapturePreview` no longer calls it (it uses `groupByDomain` as the fallback); `groupPagesWithAI` is used in the confirm-capture path for auto-tagging. The new feature defines a new, separate `groupTabsForBookmarks` export in the same module.
- **Media-type classification** (`lib/media-types.ts` `classifyMediaType(url, domainTypeOverrides)`) provides the deterministic fallback.
- **Message bus** (`lib/messages.ts`): typed `MessageRequest` / `MessageResponse` discriminated unions, sent via `browser.runtime.sendMessage`. All new cross-context actions extend these unions.
- **SPA routing** (`entrypoints/index/App.tsx`): `HashRouter` with routes `/, /page/:pageId, /chat, /settings`. A new `/organize` route is added.
- **Popup navigation** (`entrypoints/popup/App.tsx`): the `openOrFocusSPA(hash)` helper focuses an existing app tab or opens a new one. The "Organize tabs" button reuses this pattern.
- **Permissions** (`wxt.config.ts`): `"bookmarks"` is absent; it must be added.

## Data model

### `BookmarkPlan` — the central typed proposal

Produced by the pure plan-builder; consumed by the preview UI and the bookmark writer.

```ts
// lib/bookmark-plan.ts (new)

export interface TabEntry {
  title: string;
  url: string;
  alreadyBookmarked: boolean; // true → skip on write; shown as dimmed in preview
}

export interface BookmarkFolder {
  name: string;
  existingId: string | null; // id of an existing Tab Zen child folder, or null if new
  tabs: TabEntry[];
}

export interface BookmarkPlan {
  rootId: string | null;     // existing "Tab Zen" bookmark node id, null if root needs creation
  folders: BookmarkFolder[];
  totalTabs: number;         // all open tabs considered (including skipped)
  skippedCount: number;      // tabs where alreadyBookmarked === true
  mode: "ai" | "deterministic";
}
```

### AI assignment shape

Returned by `groupTabsForBookmarks` in `lib/ai.ts`; consumed only by the plan builder.

```ts
export interface TabFolderAssignment {
  url: string;
  folder: string; // folder name; may match an existing Tab Zen sub-folder name
}
```

### Session storage key

Background stores the latest plan in `browser.storage.session` under the key `"organize_plan"` (string, JSON-serialised `BookmarkPlan`). The SPA reads it when the `/organize` route mounts. Session storage is cleared on browser restart; no migration needed.

## Feature behavior

### Permission gating

`"bookmarks"` is added to the `permissions` array in `wxt.config.ts`. Chrome and Firefox show this permission during install/update. All UI (popup button, organize route) is rendered only when `typeof browser.bookmarks !== "undefined"` — evaluated at runtime so Safari users see no button and no error.

### Popup entry point

A new button "Organize tabs" appears in `entrypoints/popup/App.tsx` below the "Close captured" row, gated on the bookmarks capability check. Clicking it:

1. Sends `{ type: "ORGANIZE_TABS_PREVIEW" }` to background.
2. On success response `{ type: "ORGANIZE_PREVIEW_READY" }`, calls `openOrFocusSPA("organize")`.
3. On error response, shows an inline error message in the popup (no navigation).
4. Shows a brief loading state between click and navigation.

### Background: `handleOrganizeTabsPreview()`

Called when `ORGANIZE_TABS_PREVIEW` is received. Steps:

1. **Query open tabs:** `browser.tabs.query({})` → filter via `shouldSkipUrl(url, settings.blockedDomains)` to drop system URLs (chrome://, about:, extension pages).
2. **Read existing Tab Zen root:** `browser.bookmarks.search({ title: "Tab Zen" })` → find the first result where `url` is undefined (i.e., a folder). If multiple matches exist, pick the one whose parent is "Other Bookmarks" (id `"2"` on Chrome; use `getTree()` parent lookup if needed).
3. **Read existing sub-folders:** if root found, call `browser.bookmarks.getChildren(rootId)` → collect child nodes where `url` is undefined (folders). Collect all bookmark URLs under the root (recursive `getChildren` for each sub-folder) into a `Set<string>` of normalized URLs (via `normalizeUrl` from `lib/duplicates.ts`).
4. **Mark already-bookmarked tabs:** for each candidate tab, check `normalizeUrl(tab.url)` against the set. Flag as `alreadyBookmarked: true` if found.
5. **Build folder assignments:**
   - **AI path** (`settings.openRouterApiKey` non-empty): call `groupTabsForBookmarks(apiKey, model, tabs, existingFolderNames)`. Existing folder names are passed so the AI can reuse them by name.
   - **Deterministic path** (no API key): call `buildDeterministicAssignments(tabs, settings.domainTypeOverrides)` using `classifyMediaType` → folder name is the type's `label` (e.g., "Video", "Social", "Article", "Audio", "Shopping", "Other").
6. **Build `BookmarkPlan`** via `buildBookmarkPlan({ tabs, existingFolders, assignments, rootId | null })` (see pure plan builder below).
7. **Store plan:** `browser.storage.session.set({ organize_plan: JSON.stringify(plan) })`.
8. Return `{ type: "ORGANIZE_PREVIEW_READY" }`.
9. On any error, return `{ type: "ERROR", message: string }`.

### AI function: `groupTabsForBookmarks` (new export in `lib/ai.ts`)

```ts
export async function groupTabsForBookmarks(
  apiKey: string,
  model: string,
  tabs: { title: string; url: string }[],
  existingFolderNames: string[],
): Promise<TabFolderAssignment[]>
```

Calls `callOpenRouter` (the existing private helper in `lib/ai.ts`) with a system prompt that instructs the model to:
- Assign each tab to a folder by name.
- Prefer reusing an existing folder name (from `existingFolderNames`) if the tab clearly belongs there.
- Create a new descriptive name (2–4 words) otherwise.
- Return JSON: `{ "assignments": [{ "url": "...", "folder": "..." }] }`.

Model: `settings.aiModel` (default `openai/gpt-4o-mini`). Temperature: 0.2 (more deterministic than the 0.3 used by `groupPagesWithAI`). `response_format: { type: "json_object" }` enabled.

If the AI omits a tab or returns an invalid URL reference, the plan builder catches it and falls back to `classifyMediaType` for the missed tab (see edge cases).

### Pure plan builder: `buildBookmarkPlan` (in `lib/bookmark-plan.ts`)

```ts
export function buildBookmarkPlan(input: {
  tabs: { title: string; url: string; alreadyBookmarked: boolean }[];
  existingFolders: { id: string; name: string }[];
  assignments: TabFolderAssignment[];  // url → folder name
  rootId: string | null;
}): BookmarkPlan
```

Algorithm:
1. Build a map of `existingFolderName → id` (lowercase-normalised keys for case-insensitive matching).
2. For each tab, look up its assignment by URL. For each assigned folder name, fuzzy-match against existing folder map (exact case-insensitive). If matched: `existingId = folder.id`; else: `existingId = null` (new folder).
3. Group `TabEntry` objects into `BookmarkFolder[]`, preserving assignment order. Folders with no new (non-already-bookmarked) tabs are omitted from the plan.
4. Tabs without an assignment (AI missed them) fall back to `classifyMediaType` for folder name with `existingId = null`.
5. Return `BookmarkPlan` with computed counts.

This function has no I/O; it is fully unit-testable.

### Deterministic fallback: `buildDeterministicAssignments` (in `lib/bookmark-plan.ts`)

```ts
export function buildDeterministicAssignments(
  tabs: { title: string; url: string }[],
  domainTypeOverrides: Record<string, string>,
): TabFolderAssignment[]
```

Calls `classifyMediaType(url, domainTypeOverrides)` → resolves to a `MediaTypeDef` via `resolveMediaType` → uses `def.label` as the folder name. Returns `TabFolderAssignment[]` in the same shape as the AI output so `buildBookmarkPlan` is path-agnostic.

### Preview route: `pages/OrganizePage.tsx` (new)

Registered at `<Route path="/organize" component={OrganizePage} />` in `entrypoints/index/App.tsx`.

On mount:
1. Sends `{ type: "GET_ORGANIZE_PLAN" }` to background.
2. Background reads `browser.storage.session.get("organize_plan")` and returns `{ type: "ORGANIZE_PLAN", plan: BookmarkPlan }`.
3. Renders the `BookmarkPlan` as a folder tree: each `BookmarkFolder` as a collapsible section (folder icon, name, new vs existing badge), each `TabEntry` as a row with favicon, title, URL. Already-bookmarked rows are dimmed with a "already saved" label and not counted in the "N tabs to add" summary.
4. Header shows: "Organize [N] tabs into [M] folders" + mode badge ("AI" or "Type-based").
5. Footer: **Confirm** (primary) and **Cancel** (ghost) buttons. Confirm is disabled while writing.

On Confirm:
1. Sends `{ type: "CONFIRM_ORGANIZE", plan: BookmarkPlan }`.
2. Shows loading state.
3. On `{ type: "ORGANIZE_DONE", created: number }` response: shows success toast, then navigates to `/` after 1.5 s.
4. On `{ type: "ERROR" }` response: shows error toast; Confirm re-enables (partial-failure: user can retry).

On Cancel: navigates to `/`.

### Bookmark writer: `lib/bookmark-writer.ts` (new)

```ts
export async function executeBookmarkPlan(plan: BookmarkPlan): Promise<{ created: number }>
```

1. **Find or create root:** if `plan.rootId` is non-null, use it. Otherwise, `browser.bookmarks.create({ title: "Tab Zen", parentId: "2" })` (Chrome; `"2"` = "Other Bookmarks"). On Firefox, find the correct `parentId` by calling `browser.bookmarks.getTree()` and selecting the "unfiled" root node.
2. For each `BookmarkFolder` in `plan.folders`:
   a. If `folder.existingId` is non-null, use it as `parentId`.
   b. Else create: `browser.bookmarks.create({ title: folder.name, parentId: rootId })`.
3. For each `TabEntry` in `folder.tabs` where `alreadyBookmarked === false`:
   a. `browser.bookmarks.create({ title: tab.title, url: tab.url, parentId: folderId })`.
   b. Increment `created` counter.
4. Errors on individual bookmarks are caught and logged; processing continues (partial failure). The total `created` count reflects what actually succeeded.
5. Clears `browser.storage.session.remove("organize_plan")` on completion.

### Background: `handleConfirmOrganize(plan: BookmarkPlan)`

Calls `executeBookmarkPlan(plan)` and returns `{ type: "ORGANIZE_DONE", created: number }` or `{ type: "ERROR", message }`.

## Data flow

```
[popup] "Organize tabs" click
  → shouldSkipUrl(browser.tabs.query({}))  → filter system/blocked
  → browser.bookmarks.search("Tab Zen")    → rootId?, existingFolders[], existingUrls
  → mark alreadyBookmarked tabs
  → groupTabsForBookmarks() OR buildDeterministicAssignments()
  → buildBookmarkPlan()                    → BookmarkPlan
  → browser.storage.session.set("organize_plan")
  → ORGANIZE_PREVIEW_READY
  → openOrFocusSPA("organize")

[OrganizePage] mount
  → GET_ORGANIZE_PLAN
  → render BookmarkPlan preview (folder tree, tab rows, counts)
  → user clicks Confirm
  → CONFIRM_ORGANIZE(plan)
  → executeBookmarkPlan(plan)
      find/create "Tab Zen" root
      for each folder: find/create sub-folder
      for each non-skipped tab: browser.bookmarks.create(...)
  → ORGANIZE_DONE { created }
  → success toast → navigate /
```

## Edge cases

| Case | Handling |
|------|----------|
| No open tabs (all filtered out) | Background returns `{ type: "ERROR", message: "No organizable tabs found" }`; popup shows inline message, no navigation. |
| No API key (AI unavailable) | `buildDeterministicAssignments` runs; plan `mode = "deterministic"`; preview shows "Type-based" badge. |
| Tab already bookmarked under Tab Zen root | `alreadyBookmarked: true`; shown dimmed in preview; skipped by writer. |
| AI returns an unknown folder name not in existing folders | Treated as a new folder (`existingId = null`). |
| AI omits a tab from its response | Plan builder falls back to `classifyMediaType` for the missed URL. |
| AI response unparseable (JSON error) | Background catches exception, falls back to deterministic path for entire run; plan `mode = "deterministic"`. |
| AI returns a folder name matching an existing folder (case-insensitive) | Matched to `existingId`; tabs placed in existing folder. |
| Large tab count (> 100 tabs) | AI prompt is sent in full; no artificial cap. If OpenRouter returns a token error, background falls back to deterministic. Future v2: chunked AI calls. |
| Bookmarks API create fails on one tab | Error is caught per-tab; processing continues; final `created` count reflects successes only. `OrganizePage` shows "Added N of M tabs" if partial. |
| Re-run after prior organize run | `browser.bookmarks.search("Tab Zen")` finds the root; existing sub-folders are read. Existing URLs are collected and marked `alreadyBookmarked`. Tabs from the current session that are new since the last run get placed, existing ones are skipped. |
| "Tab Zen" root name conflict (user has a folder named "Tab Zen") | `search({ title: "Tab Zen" })` returns it; the first result whose parent is "Other Bookmarks" is used. This is the intended root. If none matches the expected parent, a new root is created under "Other Bookmarks". |
| Safari (no `browser.bookmarks`) | All UI gated on `typeof browser.bookmarks !== "undefined"`. No button, no route, no error. |
| Firefox root id | `browser.bookmarks.getTree()` returns the full tree; writer traverses to find the node with `id === "unfiled_____"` (Firefox unsorted bookmarks) for the root `parentId`, instead of hardcoding `"2"`. A helper `getOtherBookmarksFolderId()` in `lib/bookmark-writer.ts` abstracts this. |
| `browser.storage.session` absent (rare: older Firefox) | Writer receives the plan directly in `CONFIRM_ORGANIZE` payload (the SPA passes the plan it already holds in memory), bypassing session storage. |

## Components & files

**New**
- `lib/bookmark-plan.ts` — `BookmarkPlan` types, `buildBookmarkPlan`, `buildDeterministicAssignments`, `TabEntry`, `BookmarkFolder`, `TabFolderAssignment`.
- `lib/bookmark-writer.ts` — `executeBookmarkPlan`, `getOtherBookmarksFolderId`.
- `pages/OrganizePage.tsx` — preview UI, Confirm/Cancel handlers.

**Changed**
- `lib/ai.ts` — add `groupTabsForBookmarks` export.
- `lib/messages.ts` — add to `MessageRequest`: `ORGANIZE_TABS_PREVIEW`, `GET_ORGANIZE_PLAN`, `CONFIRM_ORGANIZE`; add to `MessageResponse`: `ORGANIZE_PREVIEW_READY`, `ORGANIZE_PLAN`, `ORGANIZE_DONE`.
- `entrypoints/background.ts` — add `handleOrganizeTabsPreview`, `handleGetOrganizePlan`, `handleConfirmOrganize`; wire into message switch.
- `entrypoints/popup/App.tsx` — add "Organize tabs" button (gated on bookmarks capability).
- `entrypoints/index/App.tsx` — add `<Route path="/organize" component={OrganizePage} />`.
- `wxt.config.ts` — add `"bookmarks"` to `permissions` array.

## Testing

Pure logic carries the coverage (Vitest, happy-dom):

- `buildBookmarkPlan`:
  - Assignment matched to existing folder by exact name → `existingId` populated.
  - Assignment matched to existing folder case-insensitively → `existingId` populated.
  - Assignment with unknown folder name → `existingId: null`.
  - AI-missed tab falls back to `classifyMediaType` → deterministic folder name, `existingId: null`.
  - Tab with `alreadyBookmarked: true` → included in plan, not counted in new-tab count; writer skips it.
  - Empty tabs input → plan with zero folders.
  - All tabs already bookmarked → plan with zero effective writes; `skippedCount === totalTabs`.
- `buildDeterministicAssignments`:
  - Video URL → folder name "Video".
  - Unknown domain → folder name "Other".
  - Custom `domainTypeOverrides` respected.
- `groupTabsForBookmarks` (mocked `callOpenRouter`):
  - Happy path: valid JSON returned → correct `TabFolderAssignment[]`.
  - Invalid JSON response → throws (caller falls back to deterministic).
  - Tabs omitted from AI response → missing from returned assignments.
- `getOtherBookmarksFolderId` (mocked `browser.bookmarks.getTree()`):
  - Chrome tree structure → returns `"2"`.
  - Firefox tree structure → returns `"unfiled_____"`.

UI wiring (`OrganizePage` Confirm/Cancel, popup button visibility) verified by type-check and manual in-browser review. No new Playwright tests in v1.

## Rollout / back-compat

- **Permission prompt on update:** adding `"bookmarks"` to `permissions` triggers a Chrome permission re-prompt during the extension update. Users must accept to keep the extension enabled. This is unavoidable; the update notes should mention the new feature so users understand the prompt.
- **Additive:** all new message types, files, and routes are additions. No existing behavior changes.
- **Safari / permission-absent:** the bookmarks capability check (`typeof browser.bookmarks !== "undefined"`) ensures zero impact on unsupported environments.
- **No data migration:** the `BookmarkPlan` lives only in session storage (ephemeral); no IndexedDB or sync schema changes.
- **Settings unchanged:** no new `Settings` fields. The feature reuses `settings.openRouterApiKey`, `settings.aiModel`, and `settings.domainTypeOverrides` from the existing structure.
