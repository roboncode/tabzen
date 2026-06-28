import { describe, it, expect } from "vitest";
import {
  buildBookmarkPlan,
  buildDeterministicAssignments,
  planToCollectionSet,
  type TabFolderAssignment,
  type BookmarkPlan,
} from "@/lib/bookmark-plan";
import { buildUrlSet } from "@/lib/duplicates";

// ---------------------------------------------------------------------------
// buildBookmarkPlan
// ---------------------------------------------------------------------------

describe("buildBookmarkPlan", () => {
  const existingFolders = [
    { id: "folder-vid", name: "Video" },
    { id: "folder-work", name: "Work Projects" },
  ];

  it("exact name match → existingId populated", () => {
    const tabs = [
      {
        title: "YouTube",
        url: "https://youtube.com/watch?v=abc",
        alreadyBookmarked: false,
      },
    ];
    const assignments: TabFolderAssignment[] = [
      { url: "https://youtube.com/watch?v=abc", folder: "Video" },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders,
      assignments,
      rootId: "root-1",
      mode: "ai",
    });

    expect(plan.folders).toHaveLength(1);
    expect(plan.folders[0].name).toBe("Video");
    expect(plan.folders[0].existingId).toBe("folder-vid");
  });

  it("case-insensitive match → existingId populated", () => {
    const tabs = [
      {
        title: "YouTube",
        url: "https://youtube.com/watch?v=abc",
        alreadyBookmarked: false,
      },
    ];
    // AI returns lowercase name
    const assignments: TabFolderAssignment[] = [
      { url: "https://youtube.com/watch?v=abc", folder: "video" },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders,
      assignments,
      rootId: "root-1",
      mode: "ai",
    });

    expect(plan.folders[0].existingId).toBe("folder-vid");
  });

  it("unknown folder name → existingId null", () => {
    const tabs = [
      {
        title: "Example",
        url: "https://example.com",
        alreadyBookmarked: false,
      },
    ];
    const assignments: TabFolderAssignment[] = [
      { url: "https://example.com", folder: "Random Stuff" },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders,
      assignments,
      rootId: null,
      mode: "ai",
    });

    expect(plan.folders[0].existingId).toBeNull();
    expect(plan.folders[0].name).toBe("Random Stuff");
  });

  it("AI-missed tab falls back to classifyMediaType, existingId null", () => {
    // No assignments: AI missed both tabs
    const tabs = [
      {
        title: "YouTube video",
        url: "https://youtube.com/watch?v=abc",
        alreadyBookmarked: false,
      },
      {
        title: "Unknown site",
        url: "https://unknownsite.xyz/page",
        alreadyBookmarked: false,
      },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders,
      assignments: [],
      rootId: null,
      mode: "ai",
    });

    // youtube.com → "video" type → label "Video"
    const videoFolder = plan.folders.find((f) => f.name === "Video");
    expect(videoFolder).toBeDefined();
    expect(videoFolder!.existingId).toBeNull();

    // unknownsite.xyz → "other" type → label "Other"
    const otherFolder = plan.folders.find((f) => f.name === "Other");
    expect(otherFolder).toBeDefined();
    expect(otherFolder!.existingId).toBeNull();
  });

  it("alreadyBookmarked tab → included in folder.tabs, counted in skippedCount", () => {
    // Folder has one already-bookmarked tab AND one new tab;
    // folder should appear in plan with both tabs in it.
    const tabs = [
      {
        title: "Already Saved",
        url: "https://youtube.com/watch?v=1",
        alreadyBookmarked: true,
      },
      {
        title: "New Video",
        url: "https://youtube.com/watch?v=2",
        alreadyBookmarked: false,
      },
    ];
    const assignments: TabFolderAssignment[] = [
      { url: "https://youtube.com/watch?v=1", folder: "Video" },
      { url: "https://youtube.com/watch?v=2", folder: "Video" },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders,
      assignments,
      rootId: "root-1",
      mode: "ai",
    });

    // Folder included (has at least one new tab)
    expect(plan.folders).toHaveLength(1);
    expect(plan.folders[0].name).toBe("Video");

    // Both tabs appear in the folder (alreadyBookmarked shown dimmed in preview)
    expect(plan.folders[0].tabs).toHaveLength(2);

    // Counts
    expect(plan.totalTabs).toBe(2);
    expect(plan.skippedCount).toBe(1);
  });

  it("empty tabs input → plan with zero folders", () => {
    const plan = buildBookmarkPlan({
      tabs: [],
      existingFolders: [],
      assignments: [],
      rootId: null,
      mode: "ai",
    });

    expect(plan.folders).toHaveLength(0);
    expect(plan.totalTabs).toBe(0);
    expect(plan.skippedCount).toBe(0);
  });

  it("all already bookmarked → skippedCount === totalTabs, zero effective folders", () => {
    const tabs = [
      {
        title: "Tab 1",
        url: "https://youtube.com/watch?v=1",
        alreadyBookmarked: true,
      },
      {
        title: "Tab 2",
        url: "https://example.com",
        alreadyBookmarked: true,
      },
    ];
    const assignments: TabFolderAssignment[] = [
      { url: "https://youtube.com/watch?v=1", folder: "Video" },
      { url: "https://example.com", folder: "Other" },
    ];

    const plan = buildBookmarkPlan({
      tabs,
      existingFolders: [],
      assignments,
      rootId: null,
      mode: "ai",
    });

    // All folders have only already-bookmarked tabs → all omitted
    expect(plan.folders).toHaveLength(0);
    expect(plan.skippedCount).toBe(2);
    expect(plan.totalTabs).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildDeterministicAssignments
// ---------------------------------------------------------------------------

describe("buildDeterministicAssignments", () => {
  it("video URL → folder name 'Video'", () => {
    const tabs = [{ title: "YT", url: "https://youtube.com/watch?v=abc" }];
    const assignments = buildDeterministicAssignments(tabs, {});

    expect(assignments).toHaveLength(1);
    expect(assignments[0].url).toBe("https://youtube.com/watch?v=abc");
    expect(assignments[0].folder).toBe("Video");
  });

  it("social URL → folder name 'Social'", () => {
    const tabs = [{ title: "Tweet", url: "https://twitter.com/status/123" }];
    const assignments = buildDeterministicAssignments(tabs, {});
    expect(assignments[0].folder).toBe("Social");
  });

  it("unknown domain → folder name 'Other'", () => {
    const tabs = [{ title: "Site", url: "https://unknownsite.xyz/page" }];
    const assignments = buildDeterministicAssignments(tabs, {});
    expect(assignments[0].folder).toBe("Other");
  });

  it("domainTypeOverrides map a domain to a different type", () => {
    const tabs = [{ title: "Custom", url: "https://example.com/page" }];
    // Override example.com to "video" type
    const assignments = buildDeterministicAssignments(tabs, {
      "example.com": "video",
    });
    expect(assignments[0].folder).toBe("Video");
  });

  it("empty tabs → empty assignments", () => {
    const assignments = buildDeterministicAssignments([], {});
    expect(assignments).toHaveLength(0);
  });

  it("returns one assignment per tab preserving order", () => {
    const tabs = [
      { title: "YT", url: "https://youtube.com/watch?v=1" },
      { title: "Reddit", url: "https://reddit.com/r/programming" },
      { title: "Blog", url: "https://unknownblog.example/post" },
    ];
    const assignments = buildDeterministicAssignments(tabs, {});
    expect(assignments).toHaveLength(3);
    expect(assignments[0].folder).toBe("Video");
    expect(assignments[1].folder).toBe("Social");
    expect(assignments[2].folder).toBe("Other");
  });
});

// ---------------------------------------------------------------------------
// planToCollectionSet
// ---------------------------------------------------------------------------

function makePlan(folders: Array<{ name: string; tabs: Array<{ title: string; url: string }> }>): BookmarkPlan {
  return {
    rootId: null,
    mode: "ai",
    totalTabs: folders.flatMap((f) => f.tabs).length,
    skippedCount: 0,
    folders: folders.map((f) => ({
      name: f.name,
      existingId: null,
      tabs: f.tabs.map((t) => ({ ...t, alreadyBookmarked: false })),
    })),
  };
}

describe("planToCollectionSet", () => {
  const baseInput = {
    captureId: "cap-1",
    groupId: (fi: number) => `group-${fi}`,
    pageId: (fi: number, ti: number) => `page-${fi}-${ti}`,
    deviceId: "dev-1",
    sourceLabel: "Chrome - Default",
    capturedAt: "2026-01-01T00:00:00.000Z",
    existingUrlSet: new Set<string>(),
  };

  it("produces one Group per folder, names and positions correct", () => {
    const plan = makePlan([
      { name: "Work", tabs: [{ title: "GitHub", url: "https://github.com" }] },
      { name: "Video", tabs: [{ title: "YouTube", url: "https://youtube.com/watch?v=abc" }] },
    ]);

    const { groups } = planToCollectionSet({ plan, ...baseInput });

    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("Work");
    expect(groups[0].position).toBe(0);
    expect(groups[0].captureId).toBe("cap-1");
    expect(groups[1].name).toBe("Video");
    expect(groups[1].position).toBe(1);
  });

  it("wires groupId into each page", () => {
    const plan = makePlan([
      { name: "Work", tabs: [{ title: "GitHub", url: "https://github.com" }] },
    ]);

    const { groups, pages } = planToCollectionSet({ plan, ...baseInput });

    expect(pages).toHaveLength(1);
    expect(pages[0].groupId).toBe(groups[0].id);
  });

  it("skips a tab whose url is in existingUrlSet", () => {
    const plan = makePlan([
      {
        name: "Work",
        tabs: [
          { title: "GitHub", url: "https://github.com" },
          { title: "Existing", url: "https://existing.com/page" },
        ],
      },
    ]);
    const existingUrlSet = buildUrlSet(["https://existing.com/page"]);

    const { pages } = planToCollectionSet({ plan, ...baseInput, existingUrlSet });

    expect(pages).toHaveLength(1);
    expect(pages[0].url).toBe("https://github.com");
  });

  it("omits a folder whose every tab is in existingUrlSet", () => {
    const plan = makePlan([
      { name: "Empty", tabs: [{ title: "Already", url: "https://already.com" }] },
      { name: "Work",  tabs: [{ title: "GitHub", url: "https://github.com" }] },
    ]);
    const existingUrlSet = buildUrlSet(["https://already.com"]);

    const { groups, pages } = planToCollectionSet({ plan, ...baseInput, existingUrlSet });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Work");
    expect(pages).toHaveLength(1);
  });

  it("page count and group count match the non-deduped content", () => {
    const plan = makePlan([
      {
        name: "Mix",
        tabs: [
          { title: "A", url: "https://a.com" },
          { title: "B", url: "https://b.com" },
          { title: "C", url: "https://c.com" },
        ],
      },
      { name: "Solo", tabs: [{ title: "D", url: "https://d.com" }] },
    ]);
    const existingUrlSet = buildUrlSet(["https://b.com"]);

    const { groups, pages } = planToCollectionSet({ plan, ...baseInput, existingUrlSet });

    expect(groups).toHaveLength(2);
    expect(pages).toHaveLength(3); // A, C, D — B is deduped
  });

  it("YouTube tab gets ogImage set to thumbnail URL", () => {
    const plan = makePlan([
      { name: "Video", tabs: [{ title: "YT", url: "https://youtube.com/watch?v=testId" }] },
    ]);

    const { pages } = planToCollectionSet({ plan, ...baseInput });

    expect(pages[0].ogImage).toMatch(/testId/);
  });

  it("non-YouTube tab has ogImage null", () => {
    const plan = makePlan([
      { name: "Work", tabs: [{ title: "GitHub", url: "https://github.com" }] },
    ]);

    const { pages } = planToCollectionSet({ plan, ...baseInput });

    expect(pages[0].ogImage).toBeNull();
  });

  it("empty plan produces empty groups and pages", () => {
    const plan = makePlan([]);
    const { groups, pages } = planToCollectionSet({ plan, ...baseInput });
    expect(groups).toHaveLength(0);
    expect(pages).toHaveLength(0);
  });
});
