import { describe, it, expect } from "vitest";
import type { Page, Group } from "@/lib/types";
import { buildFolderIndex } from "@/lib/domains";

function page(id: string, groupId: string, extra: Partial<Page> = {}): Page {
  return {
    id, url: `https://example.com/${id}`, title: id, favicon: "",
    ogTitle: null, ogDescription: null, ogImage: null, metaDescription: null,
    creator: null, creatorAvatar: null, creatorUrl: null, publishedAt: null,
    tags: [], notes: null, viewCount: 0, lastViewedAt: null,
    capturedAt: "", sourceLabel: "", deviceId: "",
    archived: false, starred: false, deletedAt: null, groupId,
    contentKey: null, contentType: null, contentFetchedAt: null,
    ...extra,
  };
}

function group(id: string, name: string, extra: Partial<Group> = {}): Group {
  return { id, name, captureId: "c1", position: 0, archived: false, ...extra };
}

describe("buildFolderIndex", () => {
  it("same-named groups across two captures fold into one folder with summed count and both groupIds", () => {
    const groups = [
      group("g1", "Research", { captureId: "c1" }),
      group("g2", "Research", { captureId: "c2" }),
    ];
    const pages = [
      page("p1", "g1"),
      page("p2", "g1"),
      page("p3", "g2"),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe("Research");
    expect(idx[0].count).toBe(3);
    expect(idx[0].groupIds.sort()).toEqual(["g1", "g2"].sort());
  });

  it("excludes archived groups", () => {
    const groups = [
      group("g1", "Active"),
      group("g2", "Old Folder", { archived: true }),
    ];
    const pages = [
      page("p1", "g1"),
      page("p2", "g2"),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe("Active");
  });

  it("excludes blank-named groups", () => {
    const groups = [
      group("g1", ""),
      group("g2", "  "),
      group("g3", "Named"),
    ];
    const pages = [
      page("p1", "g1"),
      page("p2", "g2"),
      page("p3", "g3"),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe("Named");
  });

  it("excludes soft-deleted pages", () => {
    const groups = [group("g1", "Work")];
    const pages = [
      page("p1", "g1"),
      page("p2", "g1", { deletedAt: "2024-01-01T00:00:00Z" }),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx[0].count).toBe(1);
  });

  it("excludes archived pages", () => {
    const groups = [group("g1", "Work")];
    const pages = [
      page("p1", "g1"),
      page("p2", "g1", { archived: true }),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx[0].count).toBe(1);
  });

  it("excludes folders with zero live pages", () => {
    const groups = [
      group("g1", "Empty"),
      group("g2", "HasPages"),
    ];
    const pages = [
      page("p1", "g1", { deletedAt: "2024-01-01T00:00:00Z" }),
      page("p2", "g2"),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe("HasPages");
  });

  it("sorts by count descending", () => {
    const groups = [
      group("g1", "Small"),
      group("g2", "Large"),
    ];
    const pages = [
      page("p1", "g1"),
      page("p2", "g2"),
      page("p3", "g2"),
      page("p4", "g2"),
    ];
    const idx = buildFolderIndex(pages, groups);
    expect(idx.map((f) => f.name)).toEqual(["Large", "Small"]);
    expect(idx.map((f) => f.count)).toEqual([3, 1]);
  });
});
