/**
 * Tests for lib/bookmark-writer.ts
 *
 * Focus: the pure helper `pickOtherBookmarksId`, which contains all the
 * browser-tree traversal logic.  `getOtherBookmarksFolderId` and
 * `executeBookmarkPlan` call live browser APIs and are not unit-exercised here
 * (as noted in the spec); they are covered by manual in-browser testing.
 */

import { describe, it, expect } from "vitest";
import { pickOtherBookmarksId } from "@/lib/bookmark-writer";

// ---------------------------------------------------------------------------
// Minimal tree-node shape for tests (mirrors bookmark-writer's internal type)
// ---------------------------------------------------------------------------

interface TestNode {
  id: string;
  url?: string;
  children?: TestNode[];
}

// ---------------------------------------------------------------------------
// Tree fixtures
// ---------------------------------------------------------------------------

/**
 * Chrome-shaped tree from browser.bookmarks.getTree():
 *   root (id "0") → children:
 *     id "1" = Bookmarks Bar
 *     id "2" = Other Bookmarks   ← the target
 *     id "3" = Mobile Bookmarks
 */
function chromeTree(): TestNode[] {
  return [
    {
      id: "0",
      children: [
        { id: "1", children: [] }, // Bookmarks Bar
        { id: "2", children: [] }, // Other Bookmarks
        { id: "3", children: [] }, // Mobile Bookmarks
      ],
    },
  ];
}

/**
 * Firefox-shaped tree from browser.bookmarks.getTree():
 *   root (id "root________") → children:
 *     id "menu________"  = Bookmarks Menu
 *     id "toolbar_____"  = Bookmarks Toolbar
 *     id "unfiled_____"  = Other Bookmarks  ← the target
 *     id "mobile______"  = Mobile Bookmarks
 */
function firefoxTree(): TestNode[] {
  return [
    {
      id: "root________",
      children: [
        { id: "menu________", children: [] }, // Bookmarks Menu
        { id: "toolbar_____", children: [] }, // Bookmarks Toolbar
        { id: "unfiled_____", children: [] }, // Other Bookmarks
        { id: "mobile______", children: [] }, // Mobile Bookmarks
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pickOtherBookmarksId", () => {
  it("Chrome tree → returns '2'", () => {
    expect(pickOtherBookmarksId(chromeTree())).toBe("2");
  });

  it("Firefox tree → returns 'unfiled_____'", () => {
    expect(pickOtherBookmarksId(firefoxTree())).toBe("unfiled_____");
  });

  it("unknown tree with no well-known ids → falls back to first folder root", () => {
    const unknownTree: TestNode[] = [
      {
        id: "root",
        children: [
          { id: "custom-root-1", children: [] },
          { id: "custom-root-2", children: [] },
        ],
      },
    ];
    expect(pickOtherBookmarksId(unknownTree)).toBe("custom-root-1");
  });

  it("unknown tree: node with url is skipped in fallback (url = bookmark, not folder)", () => {
    const mixedTree: TestNode[] = [
      {
        id: "root",
        children: [
          // This node has a url → it's a bookmark, not a writable root
          { id: "bm-1", url: "https://example.com" },
          // This one is a folder
          { id: "other-root", children: [] },
        ],
      },
    ];
    // Should skip the bookmark node and pick the first folder
    expect(pickOtherBookmarksId(mixedTree)).toBe("other-root");
  });

  it("tree with no root children → falls back to hardcoded '2'", () => {
    const emptyTree: TestNode[] = [{ id: "root", children: [] }];
    expect(pickOtherBookmarksId(emptyTree)).toBe("2");
  });

  it("empty tree array → falls back to hardcoded '2'", () => {
    expect(pickOtherBookmarksId([])).toBe("2");
  });

  it("Chrome id '2' is preferred over Firefox 'unfiled_____' when both present", () => {
    // Unlikely in practice, but tests the explicit priority ordering
    const hybridTree: TestNode[] = [
      {
        id: "root",
        children: [
          { id: "unfiled_____", children: [] },
          { id: "2", children: [] },
        ],
      },
    ];
    expect(pickOtherBookmarksId(hybridTree)).toBe("2");
  });
});
