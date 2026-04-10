import { describe, it, expect } from "vitest";
import { normalizeUrl, buildUrlSet, isDuplicate } from "@/lib/duplicates";
import type { Page, Group, Capture, CapturePreviewData } from "@/lib/types";

// Replicate the groupByDomain logic from background.ts for testing
function groupByDomain(
  pages: Page[],
): { groupName: string; pageIds: string[] }[] {
  const byDomain = new Map<string, string[]>();
  for (const page of pages) {
    try {
      const domain = new URL(page.url).hostname.replace("www.", "");
      const list = byDomain.get(domain) || [];
      list.push(page.id);
      byDomain.set(domain, list);
    } catch {
      const list = byDomain.get("Other") || [];
      list.push(page.id);
      byDomain.set("Other", list);
    }
  }
  return Array.from(byDomain.entries()).map(([domain, pageIds]) => ({
    groupName: domain,
    pageIds,
  }));
}

// Replicate the group assignment logic from buildCapturePreview
function assignGroups(
  pagesWithMeta: Page[],
  aiGroups: { groupName: string; pageIds: string[] }[],
): { groups: { groupName: string; pageIds: string[] }[]; pages: Page[] } {
  const validPageIds = new Set(pagesWithMeta.map((t) => t.id));
  const assignedPageIds = new Set<string>();
  const groupObjects: {
    groupName: string;
    groupId: string;
    pageIds: string[];
  }[] = [];

  let groupCounter = 0;
  for (const g of aiGroups) {
    const groupId = `group-${groupCounter++}`;
    const matchedPageIds: string[] = [];
    for (const pageId of g.pageIds) {
      if (validPageIds.has(pageId)) {
        const page = pagesWithMeta.find((t) => t.id === pageId);
        if (page) {
          page.groupId = groupId;
          assignedPageIds.add(pageId);
          matchedPageIds.push(pageId);
        }
      }
    }
    if (matchedPageIds.length > 0) {
      groupObjects.push({
        groupName: g.groupName,
        groupId,
        pageIds: matchedPageIds,
      });
    }
  }

  const unassigned = pagesWithMeta.filter((t) => !assignedPageIds.has(t.id));
  if (unassigned.length > 0) {
    const otherGroupId = `group-${groupCounter++}`;
    for (const page of unassigned) {
      page.groupId = otherGroupId;
    }
    groupObjects.push({
      groupName: "Other",
      groupId: otherGroupId,
      pageIds: unassigned.map((t) => t.id),
    });
  }

  return {
    groups: groupObjects.map((g) => ({
      groupName: g.groupName,
      pageIds: g.pageIds,
    })),
    pages: pagesWithMeta,
  };
}

// Replicate confirmCapture group derivation logic
function deriveGroupsFromPreview(
  preview: CapturePreviewData,
): Group[] {
  const groupIdToName = new Map<string, string>();
  for (const g of preview.groups) {
    for (const pageId of g.pageIds) {
      const page = preview.pages.find((t) => t.id === pageId);
      if (page && page.groupId) {
        groupIdToName.set(page.groupId, g.groupName);
        break;
      }
    }
  }

  return Array.from(groupIdToName.entries()).map(([groupId, name], i) => ({
    id: groupId,
    name,
    captureId: "capture-1",
    position: i,
    archived: false,
  }));
}

function makePage(id: string, url: string, title: string): Page {
  return {
    id,
    url,
    title,
    favicon: "",
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    metaDescription: null,
    creator: null,
    creatorAvatar: null,
    creatorUrl: null,
    publishedAt: null,
    tags: [],
    notes: null,
    viewCount: 0,
    lastViewedAt: null,
    capturedAt: new Date().toISOString(),
    sourceLabel: "Test",
    deviceId: "test-device",
    archived: false,
    starred: false,
    deletedAt: null,
    groupId: "",
    contentKey: null,
    contentType: null,
    contentFetchedAt: null,
  };
}

describe("groupByDomain", () => {
  it("groups pages by domain", () => {
    const pages = [
      makePage("1", "https://youtube.com/watch?v=a", "Video A"),
      makePage("2", "https://youtube.com/watch?v=b", "Video B"),
      makePage("3", "https://github.com/repo", "Repo"),
    ];
    const groups = groupByDomain(pages);
    expect(groups).toHaveLength(2);

    const youtube = groups.find((g) => g.groupName === "youtube.com");
    expect(youtube?.pageIds).toEqual(["1", "2"]);

    const github = groups.find((g) => g.groupName === "github.com");
    expect(github?.pageIds).toEqual(["3"]);
  });

  it("strips www from domain", () => {
    const pages = [
      makePage("1", "https://www.example.com/page", "Page"),
    ];
    const groups = groupByDomain(pages);
    expect(groups[0].groupName).toBe("example.com");
  });
});

describe("assignGroups", () => {
  it("assigns all pages to groups with valid IDs", () => {
    const pages = [
      makePage("1", "https://youtube.com/watch?v=a", "Video A"),
      makePage("2", "https://youtube.com/watch?v=b", "Video B"),
      makePage("3", "https://github.com/repo", "Repo"),
    ];
    const aiGroups = [
      { groupName: "Videos", pageIds: ["1", "2"] },
      { groupName: "Code", pageIds: ["3"] },
    ];

    const result = assignGroups(pages, aiGroups);

    // Every page should have a non-empty groupId
    for (const page of result.pages) {
      expect(page.groupId).toBeTruthy();
      expect(page.groupId).not.toBe("");
    }

    // Pages in the same group should have the same groupId
    expect(result.pages[0].groupId).toBe(result.pages[1].groupId);
    expect(result.pages[0].groupId).not.toBe(result.pages[2].groupId);
  });

  it("puts unrecognized AI page IDs into Other group", () => {
    const pages = [
      makePage("1", "https://example.com", "Example"),
      makePage("2", "https://other.com", "Other"),
    ];
    // AI returns IDs that don't match any page
    const aiGroups = [
      { groupName: "Stuff", pageIds: ["wrong-id-1", "wrong-id-2"] },
    ];

    const result = assignGroups(pages, aiGroups);

    // All pages should be in the "Other" group
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].groupName).toBe("Other");
    expect(result.groups[0].pageIds).toEqual(["1", "2"]);

    // All pages should have groupId set
    for (const page of result.pages) {
      expect(page.groupId).toBeTruthy();
    }
  });

  it("handles partial AI matches - some valid, some not", () => {
    const pages = [
      makePage("1", "https://example.com", "Example"),
      makePage("2", "https://other.com", "Other Page"),
      makePage("3", "https://third.com", "Third"),
    ];
    const aiGroups = [
      { groupName: "Found", pageIds: ["1", "bad-id"] },
      { groupName: "Also Found", pageIds: ["2"] },
      // page "3" is not mentioned at all
    ];

    const result = assignGroups(pages, aiGroups);

    // Page 1 → "Found", Page 2 → "Also Found", Page 3 → "Other"
    expect(result.pages[0].groupId).toBeTruthy();
    expect(result.pages[1].groupId).toBeTruthy();
    expect(result.pages[2].groupId).toBeTruthy();

    // Page 3 should be in a different group than 1 and 2
    expect(result.pages[2].groupId).not.toBe(result.pages[0].groupId);
    expect(result.pages[2].groupId).not.toBe(result.pages[1].groupId);

    // Should have 3 groups: Found, Also Found, Other
    expect(result.groups).toHaveLength(3);
    expect(result.groups[2].groupName).toBe("Other");
  });

  it("handles empty AI response", () => {
    const pages = [
      makePage("1", "https://example.com", "Example"),
    ];
    const aiGroups: { groupName: string; pageIds: string[] }[] = [];

    const result = assignGroups(pages, aiGroups);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].groupName).toBe("Other");
    expect(result.pages[0].groupId).toBeTruthy();
  });
});

describe("deriveGroupsFromPreview (confirmCapture logic)", () => {
  it("creates Group objects from preview data", () => {
    const pages = [
      makePage("1", "https://youtube.com/watch?v=a", "Video A"),
      makePage("2", "https://github.com/repo", "Repo"),
    ];
    // Simulate what assignGroups would do
    pages[0].groupId = "group-0";
    pages[1].groupId = "group-1";

    const preview: CapturePreviewData = {
      captureId: "capture-1",
      groups: [
        { groupName: "Videos", pageIds: ["1"] },
        { groupName: "Code", pageIds: ["2"] },
      ],
      pages,
    };

    const groups = deriveGroupsFromPreview(preview);

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("group-0");
    expect(groups[0].name).toBe("Videos");
    expect(groups[1].id).toBe("group-1");
    expect(groups[1].name).toBe("Code");
  });

  it("every group id matches at least one page groupId", () => {
    const pages = [
      makePage("1", "https://a.com", "A"),
      makePage("2", "https://b.com", "B"),
      makePage("3", "https://c.com", "C"),
    ];
    const aiGroups = groupByDomain(pages);
    const { groups: assignedGroups, pages: assignedPages } = assignGroups(
      pages,
      aiGroups,
    );

    const preview: CapturePreviewData = {
      captureId: "capture-1",
      groups: assignedGroups,
      pages: assignedPages,
    };

    const derivedGroups = deriveGroupsFromPreview(preview);

    // Every derived group should have at least one page pointing to it
    for (const group of derivedGroups) {
      const pagesInGroup = assignedPages.filter(
        (t) => t.groupId === group.id,
      );
      expect(pagesInGroup.length).toBeGreaterThan(0);
    }

    // Every page should point to a valid group
    const groupIds = new Set(derivedGroups.map((g) => g.id));
    for (const page of assignedPages) {
      expect(groupIds.has(page.groupId)).toBe(true);
    }
  });
});

describe("batch deduplication", () => {
  it("deduplicates within a batch of URLs", () => {
    const urls = [
      "https://youtube.com/watch?v=abc",
      "https://youtube.com/watch?v=abc",
      "https://youtube.com/watch?v=abc&utm_source=share",
      "https://youtube.com/watch?v=def",
    ];

    const seen = new Set<string>();
    const deduped = urls.filter((url) => {
      const normalized = normalizeUrl(url);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });

    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toBe("https://youtube.com/watch?v=abc");
    expect(deduped[1]).toBe("https://youtube.com/watch?v=def");
  });
});
