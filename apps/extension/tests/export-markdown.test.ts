import { describe, it, expect } from "vitest";
import { sanitizeFilename, buildPageMarkdown } from "@/lib/export-markdown";
import type { Page } from "@/lib/types";

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "p1",
    url: "https://www.youtube.com/watch?v=abc",
    title: "My Video",
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

describe("sanitizeFilename", () => {
  it("removes characters illegal in file names", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a b c d e f g h i j");
  });

  it("keeps hyphens and normal punctuation", () => {
    expect(sanitizeFilename("How-To: Build (v2)")).toBe("How-To Build (v2)");
  });

  it("falls back when the name is empty after cleaning", () => {
    expect(sanitizeFilename("///")).toBe("untitled");
    expect(sanitizeFilename("", "Ungrouped")).toBe("Ungrouped");
  });

  it("strips trailing dots and trims", () => {
    expect(sanitizeFilename("  notes...  ")).toBe("notes");
  });
});

describe("buildPageMarkdown", () => {
  it("includes YAML frontmatter with title and url", () => {
    const md = buildPageMarkdown(makePage({ title: "Hello", url: "https://x.com" }));
    expect(md).toContain("---");
    expect(md).toContain('title: "Hello"');
    expect(md).toContain('url: "https://x.com"');
  });

  it("prefers ogTitle and includes tags + creator", () => {
    const md = buildPageMarkdown(
      makePage({ ogTitle: "OG Title", creator: "Fireship", tags: ["dev", "yt"] }),
    );
    expect(md).toContain('title: "OG Title"');
    expect(md).toContain('creator: "Fireship"');
    expect(md).toContain('tags: ["dev", "yt"]');
  });

  it("includes BOTH transcript and content when present", () => {
    const md = buildPageMarkdown(
      makePage({
        notes: "my note",
        transcript: [
          { text: "first line", startMs: 0, durationMs: 1000 },
          { text: "later", startMs: 65000, durationMs: 1000 },
        ],
        content: "# Article\n\nBody text.",
      }),
    );
    expect(md).toContain("## Notes");
    expect(md).toContain("## Transcript");
    expect(md).toContain("`[0:00]` first line");
    expect(md).toContain("`[1:05]` later");
    expect(md).toContain("## Content");
    expect(md).toContain("Body text.");
  });

  it("omits sections that are absent", () => {
    const md = buildPageMarkdown(makePage());
    expect(md).not.toContain("## Transcript");
    expect(md).not.toContain("## Content");
    expect(md).not.toContain("## Notes");
  });
});
