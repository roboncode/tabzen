import { describe, it, expect } from "vitest";
import { isYouTubeWatchUrl, extractVideoId, parseTimedTextXml } from "@/lib/youtube";

describe("isYouTubeWatchUrl", () => {
  it("detects standard watch URLs", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeWatchUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("detects short URLs", () => {
    expect(isYouTubeWatchUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    expect(isYouTubeWatchUrl("https://www.google.com")).toBe(false);
    expect(isYouTubeWatchUrl("https://www.youtube.com/channel/UC123")).toBe(false);
    expect(isYouTubeWatchUrl("https://www.youtube.com/")).toBe(false);
  });

  it("detects shorts URLs", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/shorts/abc123")).toBe(true);
  });
});

describe("extractVideoId", () => {
  it("extracts from standard watch URLs", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from short URLs", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractVideoId("https://www.google.com")).toBeNull();
  });

  it("extracts from shorts URLs", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });
});

describe("parseTimedTextXml", () => {
  it("parses timedtext XML into segments", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="0.0" dur="2.5">Hello world</text>
  <text start="2.5" dur="3.0">This is a test</text>
</transcript>`;
    const segments = parseTimedTextXml(xml);
    expect(segments).toEqual([
      { text: "Hello world", startMs: 0, durationMs: 2500 },
      { text: "This is a test", startMs: 2500, durationMs: 3000 },
    ]);
  });

  it("decodes XML entities", () => {
    const xml = `<transcript><text start="0" dur="1">It&apos;s &amp; it&lt;works&gt;</text></transcript>`;
    const segments = parseTimedTextXml(xml);
    expect(segments[0].text).toBe("It's & it<works>");
  });

  it("returns empty array for empty input", () => {
    expect(parseTimedTextXml("")).toEqual([]);
  });
});
