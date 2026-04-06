import { describe, it, expect } from "vitest";
import { normalizeUrl, isDuplicate, buildUrlSet } from "@/lib/duplicates";

describe("normalizeUrl", () => {
  it("strips UTM parameters", () => {
    const url =
      "https://example.com/page?utm_source=twitter&utm_medium=social&id=123";
    expect(normalizeUrl(url)).toBe("https://example.com/page?id=123");
  });

  it("strips fbclid and gclid", () => {
    const url = "https://example.com/page?fbclid=abc123&key=value";
    expect(normalizeUrl(url)).toBe("https://example.com/page?key=value");
  });

  it("sorts remaining query params", () => {
    const url = "https://example.com/page?z=1&a=2";
    expect(normalizeUrl(url)).toBe("https://example.com/page?a=2&z=1");
  });

  it("removes trailing slash", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page",
    );
  });

  it("keeps root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("preserves fragments", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page#section",
    );
  });

  it("returns invalid URLs unchanged", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });

  it("normalizes YouTube URLs consistently", () => {
    const url1 = "https://www.youtube.com/watch?v=abc123";
    const url2 = "https://www.youtube.com/watch?v=abc123&utm_source=share";
    expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
  });
});

describe("isDuplicate", () => {
  it("detects exact URL match", () => {
    const set = buildUrlSet(["https://example.com/page"]);
    expect(isDuplicate("https://example.com/page", set)).toBe(true);
  });

  it("detects match after UTM stripping", () => {
    const set = buildUrlSet(["https://example.com/page"]);
    expect(
      isDuplicate("https://example.com/page?utm_source=twitter", set),
    ).toBe(true);
  });

  it("does not match different URLs", () => {
    const set = buildUrlSet(["https://example.com/page1"]);
    expect(isDuplicate("https://example.com/page2", set)).toBe(false);
  });

  it("treats different fragments as different URLs", () => {
    const set = buildUrlSet(["https://example.com/page#section1"]);
    expect(isDuplicate("https://example.com/page#section2", set)).toBe(false);
  });

  it("matches trailing slash vs no trailing slash", () => {
    const set = buildUrlSet(["https://example.com/page/"]);
    expect(isDuplicate("https://example.com/page", set)).toBe(true);
  });
});

describe("buildUrlSet", () => {
  it("builds a set of normalized URLs", () => {
    const urls = [
      "https://example.com/a?utm_source=x",
      "https://example.com/b/",
      "https://example.com/c",
    ];
    const set = buildUrlSet(urls);
    expect(set.size).toBe(3);
    expect(set.has("https://example.com/a")).toBe(true);
    expect(set.has("https://example.com/b")).toBe(true);
    expect(set.has("https://example.com/c")).toBe(true);
  });

  it("deduplicates URLs that normalize to the same value", () => {
    const urls = [
      "https://example.com/page",
      "https://example.com/page?utm_source=x",
      "https://example.com/page/",
    ];
    const set = buildUrlSet(urls);
    expect(set.size).toBe(1);
  });
});
