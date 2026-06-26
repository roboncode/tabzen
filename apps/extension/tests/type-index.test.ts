import { describe, it, expect } from "vitest";
import type { Page } from "@/lib/types";
import { buildTypeIndex } from "@/lib/domains";
import type { MediaTypeDef } from "@/lib/media-types";

function page(id: string, url: string): Page {
  return {
    id, url, title: id, favicon: "", ogTitle: null, ogDescription: null,
    ogImage: null, metaDescription: null, creator: null, creatorAvatar: null,
    creatorUrl: null, publishedAt: null, tags: [], notes: null, viewCount: 0,
    lastViewedAt: null, capturedAt: "", sourceLabel: "", deviceId: "",
    archived: false, starred: false, deletedAt: null, groupId: "g",
    contentKey: null, contentType: null, contentFetchedAt: null,
  };
}

// 3 youtube (video), 1 medium (article, one-off), 1 example.com (other, one-off)
const pages: Page[] = [
  page("1", "https://youtube.com/watch?v=a"),
  page("2", "https://youtube.com/watch?v=b"),
  page("3", "https://youtube.com/watch?v=c"),
  page("4", "https://medium.com/post"),
  page("5", "https://example.com/x"),
];
const custom: MediaTypeDef[] = [];

describe("buildTypeIndex", () => {
  it("buckets domains by type with summed counts", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    const video = idx.find((g) => g.type.id === "video")!;
    expect(video.count).toBe(3);
    expect(video.domains.map((d) => d.domain)).toEqual(["youtube.com"]);
  });

  it("collapses one-off domains (<=2 pages) into otherSites", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    const article = idx.find((g) => g.type.id === "article")!;
    // medium.com has 1 page -> it goes to otherSites, primary list empty
    expect(article.domains).toHaveLength(0);
    expect(article.otherSites?.count).toBe(1);
    expect(article.otherSites?.domains.map((d) => d.domain)).toEqual(["medium.com"]);
  });

  it("omits types with no pages and routes unknown domains to 'other'", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    expect(idx.find((g) => g.type.id === "shopping")).toBeUndefined();
    const other = idx.find((g) => g.type.id === "other")!;
    expect(other.otherSites?.domains.map((d) => d.domain)).toEqual(["example.com"]);
  });

  it("routes a domain via overrides into a custom type", () => {
    const customTypes: MediaTypeDef[] = [
      { id: "work", label: "Work", builtIn: false },
    ];
    const idx = buildTypeIndex(pages, { "youtube.com": "work" }, customTypes);
    const work = idx.find((g) => g.type.id === "work")!;
    expect(work.count).toBe(3);
    expect(idx.find((g) => g.type.id === "video")).toBeUndefined();
  });
});
