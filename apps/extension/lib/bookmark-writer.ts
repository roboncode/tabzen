/**
 * Bookmark writer for the AI bookmark organiser.
 *
 * Exports:
 *  - pickOtherBookmarksId  — pure helper; unit-tested in tests/bookmark-writer.test.ts
 *  - getOtherBookmarksFolderId — wraps pickOtherBookmarksId with the live browser API
 *  - executeBookmarkPlan   — writes a BookmarkPlan to the browser bookmarks API
 */

import type { BookmarkPlan } from "@/lib/bookmark-plan";

// ---------------------------------------------------------------------------
// Minimal tree-node interface
// ---------------------------------------------------------------------------

/** Minimal subset of the browser Bookmarks.BookmarkTreeNode for traversal. */
interface BookmarkTreeNode {
  id: string;
  url?: string;
  children?: BookmarkTreeNode[];
}

// ---------------------------------------------------------------------------
// pickOtherBookmarksId — pure, unit-testable
// ---------------------------------------------------------------------------

/**
 * Given the array returned by `browser.bookmarks.getTree()`, returns the id
 * of the "Other Bookmarks" root for the current browser.
 *
 * Priority:
 *   1. Chrome  — id `"2"` (Other Bookmarks)
 *   2. Firefox — id `"unfiled_____"` (Unfiled / Other Bookmarks)
 *   3. Fallback — first top-level folder child (covers hypothetical future roots)
 *   4. Ultimate fallback — `"2"` (should never be reached in a real browser)
 */
export function pickOtherBookmarksId(tree: BookmarkTreeNode[]): string {
  // getTree() returns a single-element array; its children are the
  // browser-managed roots (Bookmarks Bar, Other Bookmarks, etc.)
  const roots = tree[0]?.children ?? [];

  // 1. Chrome well-known id
  if (roots.some((n) => n.id === "2")) return "2";

  // 2. Firefox well-known id
  if (roots.some((n) => n.id === "unfiled_____")) return "unfiled_____";

  // 3. First folder root (no url property means it's a folder, not a bookmark)
  const firstFolder = roots.find((n) => !n.url);
  if (firstFolder) return firstFolder.id;

  // 4. Ultimate fallback — should never be reached in any shipping browser
  return "2";
}

// ---------------------------------------------------------------------------
// getOtherBookmarksFolderId — live browser API wrapper
// ---------------------------------------------------------------------------

/**
 * Returns the id of the "Other Bookmarks" folder for the current browser.
 * Calls `browser.bookmarks.getTree()` and delegates to `pickOtherBookmarksId`.
 */
export async function getOtherBookmarksFolderId(): Promise<string> {
  const tree = await browser.bookmarks.getTree();
  return pickOtherBookmarksId(tree as BookmarkTreeNode[]);
}

// ---------------------------------------------------------------------------
// executeBookmarkPlan — writes bookmarks
// ---------------------------------------------------------------------------

/**
 * Executes a `BookmarkPlan` by writing bookmarks to the native browser store.
 *
 * Steps:
 *  1. Find or create the "Tab Zen" root under Other Bookmarks.
 *  2. For each folder: use `existingId` as-is, or create a new sub-folder.
 *  3. For each `TabEntry` where `alreadyBookmarked === false`: create a bookmark.
 *     Per-tab errors are caught, logged, and skipped (partial-failure tolerance).
 *  4. Clear `browser.storage.session` key `"organize_plan"` on completion
 *     (errors silently swallowed — older Firefox may lack session storage).
 *
 * Returns `{ created }` — the count of bookmarks successfully written.
 */
export async function executeBookmarkPlan(
  plan: BookmarkPlan,
): Promise<{ created: number }> {
  // ── 1. Find or create root ──────────────────────────────────────────────
  let rootId: string;

  if (plan.rootId) {
    rootId = plan.rootId;
  } else {
    const parentId = await getOtherBookmarksFolderId();
    const root = await browser.bookmarks.create({
      title: "Tab Zen",
      parentId,
    });
    rootId = root.id;
  }

  // ── 2 + 3. Iterate folders and tabs ────────────────────────────────────
  let created = 0;

  for (const folder of plan.folders) {
    let folderId: string;

    if (folder.existingId) {
      folderId = folder.existingId;
    } else {
      const newFolder = await browser.bookmarks.create({
        title: folder.name,
        parentId: rootId,
      });
      folderId = newFolder.id;
    }

    for (const tab of folder.tabs) {
      if (tab.alreadyBookmarked) continue;

      try {
        await browser.bookmarks.create({
          title: tab.title,
          url: tab.url,
          parentId: folderId,
        });
        created++;
      } catch (err) {
        console.error(
          `[bookmark-writer] Failed to bookmark "${tab.title}" (${tab.url}):`,
          err,
        );
      }
    }
  }

  // ── 4. Clear session plan ───────────────────────────────────────────────
  try {
    await browser.storage.session.remove("organize_plan");
  } catch {
    // browser.storage.session absent (older Firefox); plan was passed directly
    // via CONFIRM_ORGANIZE payload, so this is safe to ignore.
  }

  return { created };
}
