import { describe, it, expect } from "vitest";
import {
  contentHashForPage,
  embeddablePages,
  pendingEmbedPages,
  countPendingEmbeds,
} from "@/lib/chat/embed-queue";
import type { Page } from "@/lib/types";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "p1",
    url: "https://example.com/article",
    title: "My Page",
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
    capturedAt: "2026-06-25T00:00:00Z",
    sourceLabel: "Test",
    deviceId: "d1",
    archived: false,
    starred: false,
    deletedAt: null,
    groupId: "g1",
    contentKey: null,
    contentType: null,
    contentFetchedAt: null,
    ...overrides,
  };
}

describe("contentHashForPage", () => {
  it("is stable for the same markdown content", () => {
    const a = makePage({ content: "# Hello\n\nWorld" });
    const b = makePage({ id: "p2", content: "# Hello\n\nWorld" });
    expect(contentHashForPage(a)).toBe(contentHashForPage(b));
  });

  it("changes when markdown content changes", () => {
    const before = makePage({ content: "# Hello\n\nWorld" });
    const after = makePage({ content: "# Hello\n\nWorld, updated" });
    expect(contentHashForPage(before)).not.toBe(contentHashForPage(after));
  });

  it("is stable for the same transcript text", () => {
    const segs = [
      { text: "first", startMs: 0, durationMs: 1000 },
      { text: "second", startMs: 1000, durationMs: 1000 },
    ];
    const a = makePage({ transcript: segs });
    const b = makePage({ id: "p2", transcript: segs.map((s) => ({ ...s })) });
    expect(contentHashForPage(a)).toBe(contentHashForPage(b));
  });

  it("changes when transcript text changes", () => {
    const before = makePage({
      transcript: [{ text: "first", startMs: 0, durationMs: 1000 }],
    });
    const after = makePage({
      transcript: [{ text: "changed", startMs: 0, durationMs: 1000 }],
    });
    expect(contentHashForPage(before)).not.toBe(contentHashForPage(after));
  });

  it("hashes a transcript differently from markdown of identical text", () => {
    const text = "the same words here";
    const transcript = makePage({
      transcript: [{ text, startMs: 0, durationMs: 1000 }],
    });
    const markdown = makePage({ content: text });
    expect(contentHashForPage(transcript)).not.toBe(contentHashForPage(markdown));
  });
});

describe("embeddablePages", () => {
  it("includes pages with markdown content or a transcript", () => {
    const md = makePage({ id: "md", content: "body" });
    const tr = makePage({
      id: "tr",
      transcript: [{ text: "hi", startMs: 0, durationMs: 1 }],
    });
    expect(embeddablePages([md, tr]).map((p) => p.id)).toEqual(["md", "tr"]);
  });

  it("excludes content-less and deleted pages", () => {
    const empty = makePage({ id: "empty" });
    const emptyTranscript = makePage({ id: "emptyTr", transcript: [] });
    const deleted = makePage({
      id: "del",
      content: "body",
      deletedAt: "2026-06-25T00:00:00Z",
    });
    expect(embeddablePages([empty, emptyTranscript, deleted])).toEqual([]);
  });
});

describe("pendingEmbedPages", () => {
  it("selects un-embedded content pages", () => {
    const page = makePage({ content: "body" });
    expect(pendingEmbedPages([page]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("skips a page already embedded with a matching hash", () => {
    const content = "body text";
    const base = makePage({ content });
    const page = makePage({
      content,
      embeddedAt: "2026-06-25T00:00:00Z",
      embedHash: contentHashForPage(base),
    });
    expect(pendingEmbedPages([page])).toEqual([]);
  });

  it("re-selects a page whose content changed (hash mismatch)", () => {
    const oldHash = contentHashForPage(makePage({ content: "old body" }));
    const page = makePage({
      content: "new body",
      embeddedAt: "2026-06-25T00:00:00Z",
      embedHash: oldHash,
    });
    expect(pendingEmbedPages([page]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("skips deleted and content-less pages", () => {
    const deleted = makePage({
      id: "del",
      content: "body",
      deletedAt: "2026-06-25T00:00:00Z",
    });
    const empty = makePage({ id: "empty" });
    expect(pendingEmbedPages([deleted, empty])).toEqual([]);
  });
});

describe("countPendingEmbeds", () => {
  it("matches the number of pending pages", () => {
    const pendingMd = makePage({ id: "a", content: "body" });
    const pendingTr = makePage({
      id: "b",
      transcript: [{ text: "hi", startMs: 0, durationMs: 1 }],
    });
    const done = makePage({
      id: "c",
      content: "done",
      embeddedAt: "2026-06-25T00:00:00Z",
      embedHash: contentHashForPage(makePage({ content: "done" })),
    });
    const deleted = makePage({
      id: "d",
      content: "body",
      deletedAt: "2026-06-25T00:00:00Z",
    });
    const pages = [pendingMd, pendingTr, done, deleted];
    expect(countPendingEmbeds(pages)).toBe(2);
    expect(countPendingEmbeds(pages)).toBe(pendingEmbedPages(pages).length);
  });
});
