import { describe, it, expect } from "vitest";
import { buildUrlSet } from "@/lib/duplicates";
import { closeableCapturedTabIds } from "@/lib/tab-status";

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
