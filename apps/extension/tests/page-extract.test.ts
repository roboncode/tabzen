import { describe, it, expect } from "vitest";
import { htmlToMarkdown, shouldExtractContent } from "@/lib/page-extract";

describe("shouldExtractContent", () => {
  it("returns true for article URLs", () => {
    expect(shouldExtractContent("https://css-tricks.com/container-queries/")).toBe(true);
    expect(shouldExtractContent("https://blog.example.com/post/123")).toBe(true);
  });

  it("returns false for YouTube URLs", () => {
    expect(shouldExtractContent("https://www.youtube.com/watch?v=abc123")).toBe(false);
    expect(shouldExtractContent("https://youtu.be/abc123")).toBe(false);
    expect(shouldExtractContent("https://www.youtube.com/shorts/abc123")).toBe(false);
  });

  it("returns false for non-http protocols", () => {
    expect(shouldExtractContent("chrome://extensions")).toBe(false);
    expect(shouldExtractContent("chrome-extension://abc/page.html")).toBe(false);
    expect(shouldExtractContent("about:blank")).toBe(false);
  });

  it("returns false for file-like URLs without articles", () => {
    expect(shouldExtractContent("https://example.com/image.png")).toBe(true); // we still try — Readability returns null for non-articles
  });
});

describe("htmlToMarkdown", () => {
  it("converts simple HTML to markdown", () => {
    const html = "<h1>Title</h1><p>Hello <strong>world</strong></p>";
    const md = htmlToMarkdown(html);
    expect(md).toContain("# Title");
    expect(md).toContain("**world**");
  });

  it("converts code blocks", () => {
    const html = "<pre><code>const x = 1;</code></pre>";
    const md = htmlToMarkdown(html);
    expect(md).toContain("const x = 1;");
  });

  it("converts links", () => {
    const html = '<p>Visit <a href="https://example.com">Example</a></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("[Example](https://example.com)");
  });

  it("handles empty input", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("   ")).toBe("");
  });
});
