import { describe, it, expect } from "vitest";
import {
  buildBookmarkPlan,
  buildDeterministicAssignments,
  type TabFolderAssignment,
} from "@/lib/bookmark-plan";

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
