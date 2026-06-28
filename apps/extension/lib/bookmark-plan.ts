/**
 * Pure plan builder for the AI bookmark organiser.
 * No I/O — fully unit-testable.
 */

import { classifyMediaType, resolveMediaType } from "@/lib/media-types";
import { isDuplicate } from "@/lib/duplicates";
import { youtubeThumbnailUrl } from "@/lib/capture-utils";
import type { Group, Page } from "@tab-zen/shared";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

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
  rootId: string | null; // existing "Tab Zen" bookmark node id, null if root needs creation
  folders: BookmarkFolder[];
  totalTabs: number; // all open tabs considered (including skipped)
  skippedCount: number; // tabs where alreadyBookmarked === true
  mode: "ai" | "deterministic";
}

/** Returned by groupTabsForBookmarks in lib/ai.ts; consumed by the plan builder. */
export interface TabFolderAssignment {
  url: string;
  folder: string; // folder name; may match an existing Tab Zen sub-folder name
}

// ---------------------------------------------------------------------------
// buildBookmarkPlan
// ---------------------------------------------------------------------------

/**
 * Build a `BookmarkPlan` from tabs, existing folder metadata, and AI (or
 * deterministic) assignments.  Pure — no browser APIs.
 *
 * Note: `mode` is added to the input so the caller (background.ts) can
 * propagate which path produced the assignments without requiring a separate
 * mutation step after the object is created.
 */
export function buildBookmarkPlan(input: {
  tabs: { title: string; url: string; alreadyBookmarked: boolean }[];
  existingFolders: { id: string; name: string }[];
  assignments: TabFolderAssignment[];
  rootId: string | null;
  mode: "ai" | "deterministic";
}): BookmarkPlan {
  const { tabs, existingFolders, assignments, rootId, mode } = input;

  // 1. Build case-insensitive existing folder map: lowercase(name) → id
  const existingFolderMap = new Map<string, string>();
  for (const folder of existingFolders) {
    existingFolderMap.set(folder.name.toLowerCase(), folder.id);
  }

  // 2. Build URL → assigned folder name map (last assignment for a URL wins)
  const assignmentByUrl = new Map<string, string>();
  for (const a of assignments) {
    assignmentByUrl.set(a.url, a.folder);
  }

  // 3. Accumulate tabs into ordered folder buckets
  //    - Assigned tabs: processed in assignment order (preserves assignment ordering)
  //    - AI-missed tabs: appended after, in original tabs array order

  const folderOrder: string[] = []; // first-occurrence ordering of folder names
  const folderBuckets = new Map<
    string,
    { existingId: string | null; tabs: TabEntry[] }
  >();

  const processedUrls = new Set<string>();

  // Helper: get-or-create bucket
  function bucket(
    folderName: string,
    existingId: string | null,
  ): { existingId: string | null; tabs: TabEntry[] } {
    if (!folderBuckets.has(folderName)) {
      folderOrder.push(folderName);
      folderBuckets.set(folderName, { existingId, tabs: [] });
    }
    return folderBuckets.get(folderName)!;
  }

  // Process in assignment order so folder ordering follows AI output
  for (const a of assignments) {
    if (processedUrls.has(a.url)) continue;

    const tab = tabs.find((t) => t.url === a.url);
    if (!tab) continue; // assignment references a URL not in tabs (stale)

    processedUrls.add(a.url);

    const folderName = a.folder;
    const existingId =
      existingFolderMap.get(folderName.toLowerCase()) ?? null;

    bucket(folderName, existingId).tabs.push({
      title: tab.title,
      url: tab.url,
      alreadyBookmarked: tab.alreadyBookmarked,
    });
  }

  // AI-missed tabs: tabs whose URL did not appear in assignments
  for (const tab of tabs) {
    if (assignmentByUrl.has(tab.url)) continue; // already processed above

    // Fallback: classifyMediaType → resolveMediaType → label
    const typeId = classifyMediaType(tab.url, {});
    const def = resolveMediaType(typeId, []);
    const folderName = def.label;
    // Per spec: AI-missed tabs always get existingId = null
    const existingId = null;

    bucket(folderName, existingId).tabs.push({
      title: tab.title,
      url: tab.url,
      alreadyBookmarked: tab.alreadyBookmarked,
    });
  }

  // 4. Build BookmarkFolder[] — omit folders with no new (non-alreadyBookmarked) tabs
  const folders: BookmarkFolder[] = [];
  for (const folderName of folderOrder) {
    const b = folderBuckets.get(folderName)!;
    if (b.tabs.some((t) => !t.alreadyBookmarked)) {
      folders.push({
        name: folderName,
        existingId: b.existingId,
        tabs: b.tabs,
      });
    }
  }

  // 5. Compute counts
  const totalTabs = tabs.length;
  const skippedCount = tabs.filter((t) => t.alreadyBookmarked).length;

  return { rootId, folders, totalTabs, skippedCount, mode };
}

// ---------------------------------------------------------------------------
// buildDeterministicAssignments
// ---------------------------------------------------------------------------

/**
 * Produce `TabFolderAssignment[]` using `classifyMediaType` so that
 * `buildBookmarkPlan` can remain path-agnostic.
 */
export function buildDeterministicAssignments(
  tabs: { title: string; url: string }[],
  domainTypeOverrides: Record<string, string>,
): TabFolderAssignment[] {
  return tabs.map((tab) => {
    const typeId = classifyMediaType(tab.url, domainTypeOverrides);
    const def = resolveMediaType(typeId, []);
    return { url: tab.url, folder: def.label };
  });
}

// ---------------------------------------------------------------------------
// planToCollectionSet
// ---------------------------------------------------------------------------

/**
 * Maps a `BookmarkPlan` to `Group[]` and `Page[]` ready to be persisted into
 * the Tab Zen in-app collection.
 *
 * - Each `BookmarkFolder` becomes a `Group` (unless every one of its tab URLs
 *   is already in `existingUrlSet`, in which case the folder is omitted).
 * - Each `TabEntry` whose URL is NOT in `existingUrlSet` becomes a `Page`.
 *   Dedup is against the COLLECTION (`existingUrlSet`), not the browser-bookmark
 *   `alreadyBookmarked` flag (that flag is bookmark-specific; ignore it here).
 * - `ogImage` is set to the YouTube thumbnail URL for YouTube watch URLs.
 *
 * Pure — no I/O.
 */
export function planToCollectionSet(input: {
  plan: BookmarkPlan;
  captureId: string;
  /** Called once per included folder; caller supplies id generator (e.g. uuidv4). */
  groupId: (folderIndex: number) => string;
  /** Called once per included page; folderIndex = index in plan.folders. */
  pageId: (folderIndex: number, tabIndex: number) => string;
  deviceId: string;
  sourceLabel: string;
  /** ISO string for capturedAt on every page/capture. */
  capturedAt: string;
  /** Normalised URL set of the existing collection for dedup. */
  existingUrlSet: Set<string>;
}): { groups: Group[]; pages: Page[] } {
  const { plan, captureId, groupId, pageId, deviceId, sourceLabel, capturedAt, existingUrlSet } = input;

  const groups: Group[] = [];
  const pages: Page[] = [];

  let groupPosition = 0;

  for (let fi = 0; fi < plan.folders.length; fi++) {
    const folder = plan.folders[fi];

    // Collect tabs that are not already in the collection
    const newTabs = folder.tabs.filter((t) => !isDuplicate(t.url, existingUrlSet));

    // Skip folder if every tab is already in the collection
    if (newTabs.length === 0) continue;

    const gId = groupId(fi);

    groups.push({
      id: gId,
      name: folder.name,
      captureId,
      position: groupPosition,
      archived: false,
    });
    groupPosition++;

    for (let ti = 0; ti < folder.tabs.length; ti++) {
      const tab = folder.tabs[ti];
      if (isDuplicate(tab.url, existingUrlSet)) continue;

      let domain: string;
      try {
        domain = new URL(tab.url).hostname.replace("www.", "");
      } catch {
        domain = "unknown";
      }

      const pId = pageId(fi, ti);

      pages.push({
        id: pId,
        url: tab.url,
        title: tab.title,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        ogTitle: null,
        ogDescription: null,
        ogImage: youtubeThumbnailUrl(tab.url),
        metaDescription: null,
        creator: null,
        creatorAvatar: null,
        creatorUrl: null,
        publishedAt: null,
        tags: [],
        notes: null,
        viewCount: 0,
        lastViewedAt: null,
        capturedAt,
        sourceLabel,
        deviceId,
        archived: false,
        starred: false,
        deletedAt: null,
        groupId: gId,
        contentKey: null,
        contentType: null,
        contentFetchedAt: null,
      });
    }
  }

  return { groups, pages };
}
