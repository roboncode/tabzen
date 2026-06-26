import { describe, it, expect } from "vitest";
import type { CapturePreviewData, Page } from "@/lib/types";
import { filterPreviewByTypes, presentTypeIds } from "@/lib/capture-filter";

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

const preview: CapturePreviewData = {
  captureId: "c1",
  pages: [
    page("a", "https://youtube.com/watch?v=1"),
    page("b", "https://medium.com/post"),
    page("c", "https://tiktok.com/@x/video/2"),
  ],
  groups: [
    { groupName: "youtube.com", pageIds: ["a", "c"] },
    { groupName: "medium.com", pageIds: ["b"] },
  ],
};

describe("presentTypeIds", () => {
  it("returns the distinct types present", () => {
    expect(presentTypeIds(preview, {}).sort()).toEqual(["article", "video"]);
  });
});

describe("filterPreviewByTypes", () => {
  it("keeps only pages of selected types and drops empty groups", () => {
    const out = filterPreviewByTypes(preview, ["video"], {});
    expect(out.pages.map((p) => p.id).sort()).toEqual(["a", "c"]);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].groupName).toBe("youtube.com");
    expect(out.groups[0].pageIds.sort()).toEqual(["a", "c"]);
  });

  it("keeps everything when all present types are selected", () => {
    const out = filterPreviewByTypes(preview, ["video", "article"], {});
    expect(out.pages).toHaveLength(3);
    expect(out.groups).toHaveLength(2);
  });
});
