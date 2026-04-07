import { describe, it, expect } from "vitest";
import { htmlToMarkdown, shouldExtractContent, getPendingMigrations, CURRENT_CONTENT_VERSION } from "@/lib/page-extract";

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

  it("returns true for any http/https URL that isn't YouTube", () => {
    expect(shouldExtractContent("https://example.com/image.png")).toBe(true);
    expect(shouldExtractContent("http://localhost:3000/page")).toBe(true);
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

  // --- URL resolution ---

  it("resolves relative links when sourceUrl is provided", () => {
    const html = '<p><a href="/docs/guide.html">Guide</a></p>';
    const md = htmlToMarkdown(html, "https://example.com/page");
    expect(md).toContain("https://example.com/docs/guide.html");
    expect(md).not.toContain('"/docs/guide.html"');
  });

  it("resolves relative image srcs when sourceUrl is provided", () => {
    const html = '<img src="/images/photo.png" alt="Photo">';
    const md = htmlToMarkdown(html, "https://example.com/page");
    expect(md).toContain("https://example.com/images/photo.png");
  });

  it("leaves absolute links unchanged", () => {
    const html = '<p><a href="https://other.com/page">Other</a></p>';
    const md = htmlToMarkdown(html, "https://example.com/page");
    expect(md).toContain("https://other.com/page");
  });

  it("leaves anchor-only links unchanged", () => {
    const html = '<p><a href="#section">Jump</a></p>';
    const md = htmlToMarkdown(html, "https://example.com/page");
    expect(md).toContain("#section");
    expect(md).not.toContain("https://example.com");
  });

  it("resolves relative path with anchor", () => {
    const html = '<p><a href="/play#example/foo">Playground</a></p>';
    const md = htmlToMarkdown(html, "https://www.typescriptlang.org/docs/page.html");
    expect(md).toContain("https://www.typescriptlang.org/play#example/foo");
  });

  it("resolves parent-relative paths", () => {
    const html = '<p><a href="../other/page.html">Other</a></p>';
    const md = htmlToMarkdown(html, "https://example.com/docs/current/page.html");
    expect(md).toContain("https://example.com/docs/other/page.html");
  });

  it("leaves mailto links unchanged", () => {
    const html = '<p><a href="mailto:user@example.com">Email</a></p>';
    const md = htmlToMarkdown(html, "https://example.com/page");
    expect(md).toContain("mailto:user@example.com");
  });

  it("works without sourceUrl (no resolution)", () => {
    const html = '<p><a href="/relative">Link</a></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("/relative");
  });

  // --- Code block language detection ---

  it("detects language from code class attribute", () => {
    const html = '<pre><code class="language-typescript">const x: string = "hello";</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```typescript");
  });

  it("detects language from lang- class prefix", () => {
    const html = '<pre><code class="lang-python">def hello(): pass</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```python");
  });

  it("detects language label in <p> before <code> (TypeScript docs pattern)", () => {
    const html = '<pre><p>ts</p><p><code><span>const x = 1;</span></code></p></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```ts");
    expect(md).toContain("const x = 1;");
    // Language label should not appear as content
    const lines = md.split("\n");
    const tsLine = lines.find((l) => l.trim() === "ts");
    expect(tsLine).toBeUndefined();
  });

  it("auto-detects JSON from content", () => {
    const html = '<pre><code>{\n  "name": "test",\n  "version": "1.0"\n}</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```json");
  });

  it("auto-detects YAML from content", () => {
    const html = '<pre><code>name: test\nversion: 1.0\ndescription: A test</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```yaml");
  });

  it("auto-detects bash from content", () => {
    const html = '<pre><code>npm install express\ncd my-project</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```bash");
  });

  it("auto-detects TypeScript interface", () => {
    const html = '<pre><code>interface User {\n  name: string;\n  id: number;\n}</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```typescript");
  });

  it("auto-detects JavaScript imports", () => {
    const html = '<pre><code>import React from "react";\nconst App = () => {};</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```javascript");
  });

  it("auto-detects HTML content", () => {
    const html = '<pre><code>&lt;div class="container"&gt;\n  &lt;h1&gt;Hello&lt;/h1&gt;\n&lt;/div&gt;</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```html");
  });

  it("auto-detects CSS content", () => {
    const html = '<pre><code>.container {\n  display: flex;\n  color: red;\n}</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```css");
  });

  it("auto-detects SQL content", () => {
    const html = '<pre><code>SELECT * FROM users WHERE id = 1;</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```sql");
  });

  it("auto-detects Python content", () => {
    const html = '<pre><code>def hello():\n    print("world")\n\nimport os</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("```python");
  });

  it("preserves line breaks when code lines are wrapped in <p> tags", () => {
    const html = '<pre><code><p>line one</p><p>line two</p><p>line three</p></code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain("line one\nline two\nline three");
  });

  it("strips trailing Try links from code blocks", () => {
    const html = '<pre><code>const x = 1;</code><a href="https://playground.example.com">Try</a></pre>';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain("Try");
    expect(md).toContain("const x = 1;");
  });
});

describe("getPendingMigrations", () => {
  it("returns all migrations for tabs with no version", () => {
    const pending = getPendingMigrations(undefined);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].version).toBe(2);
  });

  it("returns all migrations for version 0", () => {
    const pending = getPendingMigrations(0);
    expect(pending.length).toBeGreaterThan(0);
  });

  it("returns empty for current version", () => {
    const pending = getPendingMigrations(CURRENT_CONTENT_VERSION);
    expect(pending.length).toBe(0);
  });

  it("returns only newer migrations", () => {
    const pending = getPendingMigrations(1);
    expect(pending.every((m) => m.version > 1)).toBe(true);
  });

  it("migrations have required fields", () => {
    const pending = getPendingMigrations(undefined);
    for (const migration of pending) {
      expect(migration.version).toBeTypeOf("number");
      expect(migration.actions.length).toBeGreaterThan(0);
      for (const action of migration.actions) {
        expect(action.type).toBeTypeOf("string");
        expect(action.behavior).toMatch(/^(silent|prompted|destructive)$/);
        expect(action.reason).toBeTypeOf("string");
      }
    }
  });
});
