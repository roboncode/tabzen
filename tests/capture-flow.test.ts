import { describe, it, expect } from "vitest";
import { normalizeUrl, buildUrlSet, isDuplicate } from "@/lib/duplicates";
import type { Tab, Group, Capture, CapturePreviewData } from "@/lib/types";

// Replicate the groupByDomain logic from background.ts for testing
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

// Replicate the group assignment logic from buildCapturePreview
function assignGroups(
  tabsWithMeta: Tab[],
  aiGroups: { groupName: string; tabIds: string[] }[],
): { groups: { groupName: string; tabIds: string[] }[]; tabs: Tab[] } {
  const validTabIds = new Set(tabsWithMeta.map((t) => t.id));
  const assignedTabIds = new Set<string>();
  const groupObjects: {
    groupName: string;
    groupId: string;
    tabIds: string[];
  }[] = [];

  let groupCounter = 0;
  for (const g of aiGroups) {
    const groupId = `group-${groupCounter++}`;
    const matchedTabIds: string[] = [];
    for (const tabId of g.tabIds) {
      if (validTabIds.has(tabId)) {
        const tab = tabsWithMeta.find((t) => t.id === tabId);
        if (tab) {
          tab.groupId = groupId;
          assignedTabIds.add(tabId);
          matchedTabIds.push(tabId);
        }
      }
    }
    if (matchedTabIds.length > 0) {
      groupObjects.push({
        groupName: g.groupName,
        groupId,
        tabIds: matchedTabIds,
      });
    }
  }

  const unassigned = tabsWithMeta.filter((t) => !assignedTabIds.has(t.id));
  if (unassigned.length > 0) {
    const otherGroupId = `group-${groupCounter++}`;
    for (const tab of unassigned) {
      tab.groupId = otherGroupId;
    }
    groupObjects.push({
      groupName: "Other",
      groupId: otherGroupId,
      tabIds: unassigned.map((t) => t.id),
    });
  }

  return {
    groups: groupObjects.map((g) => ({
      groupName: g.groupName,
      tabIds: g.tabIds,
    })),
    tabs: tabsWithMeta,
  };
}

// Replicate confirmCapture group derivation logic
function deriveGroupsFromPreview(
  preview: CapturePreviewData,
): Group[] {
  const groupIdToName = new Map<string, string>();
  for (const g of preview.groups) {
    for (const tabId of g.tabIds) {
      const tab = preview.tabs.find((t) => t.id === tabId);
      if (tab && tab.groupId) {
        groupIdToName.set(tab.groupId, g.groupName);
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

function makeTab(id: string, url: string, title: string): Tab {
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
    publishedAt: null,
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
  };
}

describe("groupByDomain", () => {
  it("groups tabs by domain", () => {
    const tabs = [
      makeTab("1", "https://youtube.com/watch?v=a", "Video A"),
      makeTab("2", "https://youtube.com/watch?v=b", "Video B"),
      makeTab("3", "https://github.com/repo", "Repo"),
    ];
    const groups = groupByDomain(tabs);
    expect(groups).toHaveLength(2);

    const youtube = groups.find((g) => g.groupName === "youtube.com");
    expect(youtube?.tabIds).toEqual(["1", "2"]);

    const github = groups.find((g) => g.groupName === "github.com");
    expect(github?.tabIds).toEqual(["3"]);
  });

  it("strips www from domain", () => {
    const tabs = [
      makeTab("1", "https://www.example.com/page", "Page"),
    ];
    const groups = groupByDomain(tabs);
    expect(groups[0].groupName).toBe("example.com");
  });
});

describe("assignGroups", () => {
  it("assigns all tabs to groups with valid IDs", () => {
    const tabs = [
      makeTab("1", "https://youtube.com/watch?v=a", "Video A"),
      makeTab("2", "https://youtube.com/watch?v=b", "Video B"),
      makeTab("3", "https://github.com/repo", "Repo"),
    ];
    const aiGroups = [
      { groupName: "Videos", tabIds: ["1", "2"] },
      { groupName: "Code", tabIds: ["3"] },
    ];

    const result = assignGroups(tabs, aiGroups);

    // Every tab should have a non-empty groupId
    for (const tab of result.tabs) {
      expect(tab.groupId).toBeTruthy();
      expect(tab.groupId).not.toBe("");
    }

    // Tabs in the same group should have the same groupId
    expect(result.tabs[0].groupId).toBe(result.tabs[1].groupId);
    expect(result.tabs[0].groupId).not.toBe(result.tabs[2].groupId);
  });

  it("puts unrecognized AI tab IDs into Other group", () => {
    const tabs = [
      makeTab("1", "https://example.com", "Example"),
      makeTab("2", "https://other.com", "Other"),
    ];
    // AI returns IDs that don't match any tab
    const aiGroups = [
      { groupName: "Stuff", tabIds: ["wrong-id-1", "wrong-id-2"] },
    ];

    const result = assignGroups(tabs, aiGroups);

    // All tabs should be in the "Other" group
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].groupName).toBe("Other");
    expect(result.groups[0].tabIds).toEqual(["1", "2"]);

    // All tabs should have groupId set
    for (const tab of result.tabs) {
      expect(tab.groupId).toBeTruthy();
    }
  });

  it("handles partial AI matches - some valid, some not", () => {
    const tabs = [
      makeTab("1", "https://example.com", "Example"),
      makeTab("2", "https://other.com", "Other Page"),
      makeTab("3", "https://third.com", "Third"),
    ];
    const aiGroups = [
      { groupName: "Found", tabIds: ["1", "bad-id"] },
      { groupName: "Also Found", tabIds: ["2"] },
      // tab "3" is not mentioned at all
    ];

    const result = assignGroups(tabs, aiGroups);

    // Tab 1 → "Found", Tab 2 → "Also Found", Tab 3 → "Other"
    expect(result.tabs[0].groupId).toBeTruthy();
    expect(result.tabs[1].groupId).toBeTruthy();
    expect(result.tabs[2].groupId).toBeTruthy();

    // Tab 3 should be in a different group than 1 and 2
    expect(result.tabs[2].groupId).not.toBe(result.tabs[0].groupId);
    expect(result.tabs[2].groupId).not.toBe(result.tabs[1].groupId);

    // Should have 3 groups: Found, Also Found, Other
    expect(result.groups).toHaveLength(3);
    expect(result.groups[2].groupName).toBe("Other");
  });

  it("handles empty AI response", () => {
    const tabs = [
      makeTab("1", "https://example.com", "Example"),
    ];
    const aiGroups: { groupName: string; tabIds: string[] }[] = [];

    const result = assignGroups(tabs, aiGroups);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].groupName).toBe("Other");
    expect(result.tabs[0].groupId).toBeTruthy();
  });
});

describe("deriveGroupsFromPreview (confirmCapture logic)", () => {
  it("creates Group objects from preview data", () => {
    const tabs = [
      makeTab("1", "https://youtube.com/watch?v=a", "Video A"),
      makeTab("2", "https://github.com/repo", "Repo"),
    ];
    // Simulate what assignGroups would do
    tabs[0].groupId = "group-0";
    tabs[1].groupId = "group-1";

    const preview: CapturePreviewData = {
      captureId: "capture-1",
      groups: [
        { groupName: "Videos", tabIds: ["1"] },
        { groupName: "Code", tabIds: ["2"] },
      ],
      tabs,
    };

    const groups = deriveGroupsFromPreview(preview);

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("group-0");
    expect(groups[0].name).toBe("Videos");
    expect(groups[1].id).toBe("group-1");
    expect(groups[1].name).toBe("Code");
  });

  it("every group id matches at least one tab groupId", () => {
    const tabs = [
      makeTab("1", "https://a.com", "A"),
      makeTab("2", "https://b.com", "B"),
      makeTab("3", "https://c.com", "C"),
    ];
    const aiGroups = groupByDomain(tabs);
    const { groups: assignedGroups, tabs: assignedTabs } = assignGroups(
      tabs,
      aiGroups,
    );

    const preview: CapturePreviewData = {
      captureId: "capture-1",
      groups: assignedGroups,
      tabs: assignedTabs,
    };

    const derivedGroups = deriveGroupsFromPreview(preview);

    // Every derived group should have at least one tab pointing to it
    for (const group of derivedGroups) {
      const tabsInGroup = assignedTabs.filter(
        (t) => t.groupId === group.id,
      );
      expect(tabsInGroup.length).toBeGreaterThan(0);
    }

    // Every tab should point to a valid group
    const groupIds = new Set(derivedGroups.map((g) => g.id));
    for (const tab of assignedTabs) {
      expect(groupIds.has(tab.groupId)).toBe(true);
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
