import { describe, it, expect } from "vitest";
import { isInjectableTab, mapWithConcurrency, youtubeThumbnailUrl, isTranscriptPending } from "@/lib/capture-utils";

describe("isInjectableTab", () => {
  it("allows an awake, loaded tab", () => {
    expect(isInjectableTab({ id: 1, discarded: false, status: "complete" })).toBe(true);
  });

  it("rejects a discarded tab (would reload → autoplay)", () => {
    expect(isInjectableTab({ id: 1, discarded: true, status: "complete" })).toBe(false);
  });

  it("rejects a still-loading tab", () => {
    expect(isInjectableTab({ id: 1, discarded: false, status: "loading" })).toBe(false);
  });

  it("rejects a tab without an id", () => {
    expect(isInjectableTab({ discarded: false, status: "complete" })).toBe(false);
  });

  it("treats undefined status as injectable when not discarded", () => {
    expect(isInjectableTab({ id: 7 })).toBe(true);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves input order", async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // actually ran in parallel
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 3, async (n) => n)).toEqual([]);
  });
});

describe("isTranscriptPending", () => {
  const yt = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  it("is pending for a fresh YouTube page with no transcript", () => {
    expect(isTranscriptPending({ url: yt })).toBe(true);
  });

  it("is not pending once a transcript exists", () => {
    expect(isTranscriptPending({ url: yt, transcript: [{ text: "hi" }] })).toBe(false);
  });

  it("is not pending after the queue has checked it (no captions)", () => {
    expect(isTranscriptPending({ url: yt, transcriptCheckedAt: "2026-06-25T00:00:00Z" })).toBe(false);
  });

  it("is not pending for deleted pages", () => {
    expect(isTranscriptPending({ url: yt, deletedAt: "2026-06-25T00:00:00Z" })).toBe(false);
  });

  it("is not pending for non-YouTube pages", () => {
    expect(isTranscriptPending({ url: "https://example.com/article" })).toBe(false);
  });
});

describe("youtubeThumbnailUrl", () => {
  it("derives a thumbnail from a watch URL", () => {
    expect(youtubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
  });

  it("returns null for non-YouTube URLs", () => {
    expect(youtubeThumbnailUrl("https://example.com/page")).toBeNull();
  });
});
