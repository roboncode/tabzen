import { describe, it, expect } from "vitest";
import { isMetadataIncomplete, needsMetadataBackfill, parseOgFromHtml } from "@/lib/metadata";

const YT_WATCH_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const NON_YT_URL = "https://www.example.com/article";

describe("isMetadataIncomplete", () => {
  it("returns true for YouTube watch URL with null ogTitle and null creator", () => {
    expect(isMetadataIncomplete({ url: YT_WATCH_URL, ogTitle: null, creator: null })).toBe(true);
  });

  it("returns false for YouTube watch URL with non-null ogTitle", () => {
    expect(isMetadataIncomplete({ url: YT_WATCH_URL, ogTitle: "Some Title", creator: null })).toBe(false);
  });

  it("returns false for YouTube watch URL with non-null creator", () => {
    expect(isMetadataIncomplete({ url: YT_WATCH_URL, ogTitle: null, creator: "Some Creator" })).toBe(false);
  });

  it("returns false for non-YouTube URL even with null ogTitle and null creator", () => {
    expect(isMetadataIncomplete({ url: NON_YT_URL, ogTitle: null, creator: null })).toBe(false);
  });
});

describe("parseOgFromHtml", () => {
  it("parses og:title, og:image, and meta description from YouTube-style HTML", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Real Video Title">
          <meta property="og:image" content="https://img.youtube.com/vi/abc123/hqdefault.jpg">
          <meta name="description" content="A description">
        </head>
      </html>
    `;
    const result = parseOgFromHtml(html);
    expect(result.ogTitle).toBe("Real Video Title");
    expect(result.ogImage).toContain("abc123");
    expect(result.metaDescription).toBe("A description");
  });

  it("parses correctly when content= attribute appears before property= (reversed order)", () => {
    const html = `
      <html>
        <head>
          <meta content="Reversed Title" property="og:title">
          <meta content="https://img.example.com/image.jpg" property="og:image">
          <meta content="Reversed description" name="description">
        </head>
      </html>
    `;
    const result = parseOgFromHtml(html);
    expect(result.ogTitle).toBe("Reversed Title");
    expect(result.ogImage).toBe("https://img.example.com/image.jpg");
    expect(result.metaDescription).toBe("Reversed description");
  });

  it("decodes HTML entities in content values", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Rock &amp; Roll">
          <meta property="og:description" content="It&apos;s &quot;great&quot;">
        </head>
      </html>
    `;
    const result = parseOgFromHtml(html);
    expect(result.ogTitle).toBe("Rock & Roll");
  });

  it("returns all null fields for empty / no-OG HTML", () => {
    const result = parseOgFromHtml("<html><head></head><body></body></html>");
    expect(result.ogTitle).toBeNull();
    expect(result.ogDescription).toBeNull();
    expect(result.ogImage).toBeNull();
    expect(result.metaDescription).toBeNull();
  });
});

describe("needsMetadataBackfill", () => {
  it("returns true when metadata is incomplete and no marker set", () => {
    expect(needsMetadataBackfill({ url: YT_WATCH_URL, ogTitle: null, creator: null })).toBe(true);
  });

  it("returns false when metadata is incomplete but marker is set", () => {
    expect(
      needsMetadataBackfill({ url: YT_WATCH_URL, ogTitle: null, creator: null, metadataCheckedAt: "2024-01-01T00:00:00Z" })
    ).toBe(false);
  });

  it("returns false when ogTitle is present (metadata complete)", () => {
    expect(needsMetadataBackfill({ url: YT_WATCH_URL, ogTitle: "Some Title", creator: null })).toBe(false);
  });

  it("returns false for non-YouTube URL", () => {
    expect(needsMetadataBackfill({ url: "https://www.example.com/article", ogTitle: null, creator: null })).toBe(false);
  });
});
