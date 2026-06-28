import { describe, it, expect } from "vitest";
import { buildUrlSet } from "@/lib/duplicates";
import { closeableCapturedTabIds, duplicateTabIdsToClose, selectUncapturedTabs } from "@/lib/tab-status";
import type { DupTabInfo, OpenTabFull } from "@/lib/tab-status";

describe("closeableCapturedTabIds", () => {
  const capturedUrls = [
    "https://example.com/article",
    "https://news.ycombinator.com/",
    "https://github.com/user/repo",
  ];

  const capturedUrlSet = buildUrlSet(capturedUrls);

  it("includes a captured non-pinned http tab", () => {
    const tabs = [{ id: 1, url: "https://example.com/article", pinned: false }];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([1]);
  });

  it("excludes a pinned captured tab", () => {
    const tabs = [{ id: 2, url: "https://example.com/article", pinned: true }];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([]);
  });

  it("excludes an uncaptured tab", () => {
    const tabs = [{ id: 3, url: "https://uncaptured.com/page", pinned: false }];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([]);
  });

  it("excludes a non-http (chrome://) tab", () => {
    const tabs = [{ id: 4, url: "chrome://newtab/", pinned: false }];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([]);
  });

  it("excludes a tab with no numeric id", () => {
    const tabs = [{ url: "https://example.com/article", pinned: false }];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([]);
  });

  it("returns only correct ids from mixed tabs", () => {
    const tabs = [
      { id: 10, url: "https://example.com/article", pinned: false },      // captured, not pinned → include
      { id: 11, url: "https://news.ycombinator.com/", pinned: true },      // captured, pinned → exclude
      { id: 12, url: "https://github.com/user/repo", pinned: false },      // captured, not pinned → include
      { id: 13, url: "https://uncaptured.com/", pinned: false },           // not captured → exclude
      { id: 14, url: "chrome://extensions/", pinned: false },              // non-http → exclude
      { url: "https://example.com/article", pinned: false },               // no id → exclude
    ];
    expect(closeableCapturedTabIds(tabs, capturedUrlSet)).toEqual([10, 12]);
  });
});

describe("duplicateTabIdsToClose", () => {
  it("3 unpinned tabs with same URL → keeps first, returns the other 2 ids", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "https://example.com/article", pinned: false },
      { id: 2, url: "https://example.com/article", pinned: false },
      { id: 3, url: "https://example.com/article", pinned: false },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([2, 3]);
  });

  it("1 pinned + 2 unpinned same URL → returns the 2 unpinned ids, never the pinned id", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "https://example.com/", pinned: true },
      { id: 2, url: "https://example.com/", pinned: false },
      { id: 3, url: "https://example.com/", pinned: false },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([2, 3]);
  });

  it("all unique URLs → returns []", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "https://example.com/", pinned: false },
      { id: 2, url: "https://github.com/", pinned: false },
      { id: 3, url: "https://news.ycombinator.com/", pinned: false },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([]);
  });

  it("non-http duplicates (chrome://newtab) → excluded, returns []", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "chrome://newtab/", pinned: false },
      { id: 2, url: "chrome://newtab/", pinned: false },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([]);
  });

  it("tab without numeric id → excluded", () => {
    const tabs: DupTabInfo[] = [
      { url: "https://example.com/", pinned: false },
      { url: "https://example.com/", pinned: false },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([]);
  });

  it("two pinned tabs with same URL → returns [] (never close pinned)", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "https://example.com/", pinned: true },
      { id: 2, url: "https://example.com/", pinned: true },
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([]);
  });

  it("mixed list with multiple groups → returns exactly the right ids", () => {
    const tabs: DupTabInfo[] = [
      { id: 1, url: "https://example.com/article", pinned: false },   // group A, first → keep
      { id: 2, url: "https://example.com/article", pinned: false },   // group A, second → close
      { id: 3, url: "https://news.ycombinator.com/", pinned: true },  // group B, pinned → keep
      { id: 4, url: "https://news.ycombinator.com/", pinned: false }, // group B, unpinned → close
      { id: 5, url: "https://github.com/", pinned: false },           // unique → keep
      { id: 6, url: "chrome://newtab/", pinned: false },              // non-http → skip
    ];
    expect(duplicateTabIdsToClose(tabs)).toEqual([2, 4]);
  });
});

describe("selectUncapturedTabs", () => {
  const capturedUrlSet = buildUrlSet([
    "https://example.com/captured",
    "https://news.ycombinator.com/",
  ]);
  const blockedDomains = ["ads.example.com", "tracker.io"];

  it("includes an uncaptured http tab and maps to UncapturedTab shape", () => {
    const tabs: OpenTabFull[] = [
      { id: 1, url: "https://github.com/user/repo", title: "User/Repo - GitHub", favIconUrl: "https://github.com/favicon.ico" },
    ];
    const result = selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains);
    expect(result).toEqual([
      { id: 1, url: "https://github.com/user/repo", title: "User/Repo - GitHub", favIconUrl: "https://github.com/favicon.ico" },
    ]);
  });

  it("excludes a tab whose url is already captured", () => {
    const tabs: OpenTabFull[] = [
      { id: 2, url: "https://example.com/captured", title: "Captured Page", favIconUrl: "" },
    ];
    expect(selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains)).toEqual([]);
  });

  it("excludes a tab on a blocked domain", () => {
    const tabs: OpenTabFull[] = [
      { id: 3, url: "https://ads.example.com/banner", title: "Ad", favIconUrl: "" },
    ];
    expect(selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains)).toEqual([]);
  });

  it("excludes a non-http tab (chrome://newtab/)", () => {
    const tabs: OpenTabFull[] = [
      { id: 4, url: "chrome://newtab/", title: "New Tab", favIconUrl: "" },
    ];
    expect(selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains)).toEqual([]);
  });

  it("excludes a tab without a numeric id", () => {
    const tabs: OpenTabFull[] = [
      { url: "https://github.com/no-id", title: "No ID", favIconUrl: "" },
    ];
    expect(selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains)).toEqual([]);
  });

  it("uses url as title fallback when title is undefined", () => {
    const tabs: OpenTabFull[] = [
      { id: 5, url: "https://github.com/no-title" },
    ];
    const result = selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains);
    expect(result).toEqual([
      { id: 5, url: "https://github.com/no-title", title: "https://github.com/no-title", favIconUrl: "" },
    ]);
  });

  it("uses url as title fallback when title is empty string", () => {
    const tabs: OpenTabFull[] = [
      { id: 6, url: "https://github.com/empty-title", title: "" },
    ];
    const result = selectUncapturedTabs(tabs, capturedUrlSet, blockedDomains);
    expect(result).toEqual([
      { id: 6, url: "https://github.com/empty-title", title: "https://github.com/empty-title", favIconUrl: "" },
    ]);
  });
});
