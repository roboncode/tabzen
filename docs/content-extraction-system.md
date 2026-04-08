# Tab Zen Content Extraction System

Complete technical reference for the web page content extraction, processing, and rendering pipeline. This document is sufficient to reconstruct the entire system from scratch.

---

## 1. System Overview

Tab Zen is a Chrome extension (Manifest V3) that captures browser tabs for later reading. When a tab is captured, the system:

1. **Extracts** the page's raw HTML from the browser tab via `chrome.scripting.executeScript`
2. **Resolves** all relative URLs in the raw HTML string (critical -- must happen before any DOM parsing)
3. **Parses** the resolved HTML with linkedom (a lightweight DOM implementation for service workers)
4. **Extracts** the article content using Mozilla's Readability algorithm
5. **Converts** the article HTML to Markdown using Turndown with custom rules for code blocks, heading anchors, and language detection
6. **Stores** the markdown in IndexedDB with a content version number
7. **Renders** the markdown as styled HTML using marked with a custom renderer
8. **Highlights** code blocks with Shiki (bundled, lazy-loaded, using JS regex engine)
9. **Displays** in a VitePress-inspired layout with a fixed sidebar containing a table of contents

### Tech Stack

- **SolidJS** -- reactive UI framework (not React)
- **WXT** -- Chrome extension framework (provides `browser` global, `defineBackground()`, etc.)
- **Tailwind CSS v4** -- utility-first CSS
- **Vite** -- bundler (via WXT)
- **Vitest** -- test runner

### Where Code Runs

| Module | Environment | Notes |
|--------|-------------|-------|
| `page-extract.ts` | MV3 service worker | No `document`, no `DOMParser`, no `window` |
| `MarkdownView.tsx` | Detail page (normal web page) | Has full DOM access |
| `DetailSidebar.tsx` | Detail page | Has full DOM access |
| `DetailPage.tsx` | Detail page | Orchestrates layout |
| `background.ts` | MV3 service worker | Message handler, orchestrates extraction |

---

## 2. Libraries & Dependencies

### `@mozilla/readability`

- **What it does**: Extracts the main article content from a full HTML page, stripping navigation, ads, sidebars, etc. This is the same engine Firefox uses for Reader View.
- **Why we chose it**: Industry-standard article extraction. Well-maintained by Mozilla.
- **Where it runs**: Service worker (background.ts imports page-extract.ts)
- **Gotchas**:
  - Requires a DOM document object -- we provide one via linkedom
  - **Strips language classes from `<code>` elements** -- this means `class="language-typescript"` is often lost by the time we get to Turndown. We compensate with auto-detection.
  - Sometimes strips code blocks entirely when they follow a `$` prompt pattern
  - Must cast linkedom's document as `any` because types don't perfectly match

### `turndown`

- **What it does**: Converts HTML to Markdown.
- **Why we chose it**: Most popular HTML-to-Markdown converter. Extensible rule system.
- **Where it runs**: Service worker
- **Gotchas**:
  - **Uses `document` internally** to parse HTML strings. `document` does not exist in MV3 service workers. Solution: parse HTML with linkedom first, wrap in `<html><body>`, and pass `doc.body` as a DOM node instead of an HTML string.
  - Custom rules are needed for code blocks because the default handler doesn't extract language info reliably after Readability processing.

### `linkedom`

- **What it does**: Lightweight DOM implementation. Provides `parseHTML()` which returns a `document` object with querySelector, textContent, etc.
- **Why we chose it**: Works in service workers (unlike happy-dom which has Node.js dependencies). Much lighter than jsdom.
- **Where it runs**: Service worker
- **Gotchas**:
  - **Resolves `getAttribute("href")` against the chrome-extension:// origin.** If you parse `<a href="/about">` with linkedom in a service worker, `getAttribute("href")` returns `chrome-extension://abcdef/about`. This is the single most critical gotcha in the entire system. Solution: `resolveRelativeUrls()` must run on the raw HTML string BEFORE linkedom parses it.

### `marked`

- **What it does**: Converts Markdown to HTML. Used at render time in the detail page.
- **Why we chose it**: Fast, well-maintained, supports custom renderers.
- **Where it runs**: Detail page (browser context)
- **Gotchas**:
  - **v18 renderer receives raw token objects, not pre-rendered text.** The `heading({ tokens, depth })` callback gets raw tokens. You MUST call `this.parser.parseInline(tokens)` to render inline markdown (backticks, bold, italic, links) within headings, paragraphs, and links. Without this, you get raw markdown syntax in the HTML output.
  - **`listitem` tokens contain block-level elements.** Must use `this.parser.parse(tokens)` (not `parseInline`) for list items, otherwise nested paragraphs and code blocks inside list items break.

### `shiki`

- **What it does**: Syntax highlighting for code blocks. Produces HTML with inline styles for each token.
- **Why we chose it**: Beautiful output, supports many languages, themeable. Same engine as VS Code.
- **Where it runs**: Detail page (browser context)
- **Gotchas**:
  - **CSP blocks dynamic imports from CDN.** Chrome extensions have strict Content Security Policy. Shiki cannot load themes/languages from unpkg or CDN at runtime. Everything must be bundled.
  - Uses `createHighlighterCore` with `createJavaScriptRegexEngine()` (not the default Oniguruma WASM engine, which has CSP/loading issues in extensions).
  - Languages are selectively bundled via static imports to keep bundle size manageable: JavaScript, TypeScript, JSON, CSS, HTML, Bash, YAML, Python, XML, SQL.
  - Lazy-loaded: the highlighter is created on first use and cached in a module-level promise.
  - Post-render: highlighting runs after marked produces HTML, via `createEffect` + `requestAnimationFrame`. Code blocks are rendered first as plain `<pre data-lang="..."><code>` and then Shiki replaces the innerHTML.

---

## 3. Content Extraction Pipeline

### 3a. Capture Flow (during tab capture)

When the user captures tabs (bulk or single), extraction happens in `background.ts`:

```typescript
// In confirmCapture() or captureSingleTab():
if (!isYouTubeWatchUrl(tab.url)) {
  const { extractPageContent } = await import("@/lib/page-extract");
  const result = await extractPageContent(browserTab.id, tab.url);
  if (result) {
    markdownContent = result.content;
  }
}
```

The tab is saved with the markdown content, content type, and current version:

```typescript
const tab: Tab = {
  // ...other fields...
  content: hasContent ? markdownContent : undefined,
  contentKey: hasContent ? `content/${tabId}` : null,
  contentType: hasContent ? "markdown" : null,
  contentFetchedAt: hasContent ? new Date().toISOString() : null,
  contentVersion: hasContent ? CURRENT_CONTENT_VERSION : undefined,
};
```

### 3b. On-Demand Extraction (GET_CONTENT)

When the user opens a detail page for a tab that has no content:

```typescript
async function handleGetContent(tabId: string): Promise<MessageResponse> {
  const tab = await getTab(tabId);
  if (!tab) return { type: "ERROR", message: "Tab not found" };

  // 1. Return cached content if available
  if (tab.content) {
    return { type: "CONTENT", content: tab.content };
  }

  // 2. Try extracting from an open browser tab with matching URL
  const openTabs = await browser.tabs.query({ url: tab.url });
  if (openTabs.length > 0 && openTabs[0].id) {
    const { extractPageContent } = await import("@/lib/page-extract");
    const result = await extractPageContent(openTabs[0].id, tab.url);
    if (result) {
      await addTab({ ...tab, content: result.content, /* ... */ });
      return { type: "CONTENT", content: result.content };
    }
  }

  return { type: "CONTENT", content: null };
}
```

### 3c. Re-Extraction via Fetch (RE_EXTRACT_CONTENT)

Used for content version upgrades. Tries open tab first, falls back to fetch:

```typescript
async function handleReExtractContent(tabId: string): Promise<MessageResponse> {
  const tab = await getTab(tabId);

  let result = null;

  // 1. Try open browser tab first (best quality -- gets JS-rendered content)
  const openTabs = await browser.tabs.query({ url: tab.url });
  if (openTabs.length > 0 && openTabs[0].id) {
    result = await extractPageContent(openTabs[0].id, tab.url);
  }

  // 2. Fall back to fetch (works without tab open, but no JS rendering)
  if (!result) {
    result = await extractPageContentViaFetch(tab.url);
  }

  if (!result) {
    return { type: "ERROR", message: "Could not extract content from this page" };
  }

  // Update tab with new content AND bump contentVersion
  await addTab({
    ...tab,
    content: result.content,
    contentVersion: CURRENT_CONTENT_VERSION,
  });

  return { type: "CONTENT", content: result.content };
}
```

`extractPageContentViaFetch` uses `fetch()` with a desktop User-Agent header. It works for server-rendered pages but fails for SPAs that require JavaScript execution.

### 3d. URL Resolution -- `resolveRelativeUrls()`

This is the most critical pre-processing step. It MUST run on the raw HTML string BEFORE linkedom or Readability parse it.

**Why**: linkedom, running in a service worker, resolves `getAttribute("href")` against the extension's origin (`chrome-extension://...`). If we parse `<a href="/about">` with linkedom, the href becomes `chrome-extension://extensionid/about` and is permanently corrupted.

```typescript
function resolveRelativeUrls(html: string, sourceUrl: string): string {
  const origin = new URL(sourceUrl).origin;
  const baseUrl = sourceUrl.replace(/\/[^/]*$/, "/");

  // 1. Root-relative: href="/path" -> href="https://example.com/path"
  let result = html.replace(
    /(href|src)="(\/[^"]*?)"/g,
    (_match, attr, path) => `${attr}="${origin}${path}"`,
  );

  // 2. Relative: href="path" -> href="https://example.com/current/path"
  //    Excludes: https://, mailto:, #, data:, //, /path (already handled)
  result = result.replace(
    /(href|src)="(?!https?:\/\/|mailto:|#|data:|\/\/|\/[^/])([^"]*?)"/g,
    (_match, attr, path) => {
      return `${attr}="${new URL(path, baseUrl).href}"`;
    },
  );

  return result;
}
```

This function is called in two places:
1. In `extractPageContent()` -- on the raw HTML from `executeScript` before Readability
2. In `htmlToMarkdown()` -- as a safety net on the article HTML after Readability (in case Readability introduced new relative URLs)

### 3e. Readability Processing

```typescript
// Resolve relative URLs BEFORE parsing
const resolvedHtml = resolveRelativeUrls(rawHtml, url);

// Parse with linkedom
const { document } = parseHTML(resolvedHtml);

// Extract article
const article = new Readability(document as any).parse();
// article.content = HTML string of the article body
// article.title, article.byline, article.excerpt, article.siteName
```

### 3f. Turndown Conversion (Custom Rules)

Turndown is configured with:
```typescript
const td = new TurndownService({
  headingStyle: "atx",        // # style headings
  codeBlockStyle: "fenced",   // ``` style code blocks
  bulletListMarker: "-",      // - for unordered lists
});
```

#### Rule 1: Heading Anchor Stripping (`headingAnchorStrip`)

Many blogs wrap headings in anchor tags: `<a href="#id"><h2>Section</h2></a>`. Without this rule, Turndown produces `[## Section](#id)` which is broken markdown.

```typescript
td.addRule("headingAnchorStrip", {
  filter: (node) => {
    if (node.nodeName !== "A") return false;
    const hasHeading = node.querySelector?.("h1, h2, h3, h4, h5, h6");
    return !!hasHeading;
  },
  replacement: (_content, node) => {
    const el = node as Element;
    const heading = el.querySelector?.("h1, h2, h3, h4, h5, h6");
    if (heading) {
      const level = parseInt(heading.nodeName[1]);
      const prefix = "#".repeat(level);
      return `\n\n${prefix} ${heading.textContent?.trim() || ""}\n\n`;
    }
    return _content;
  },
});
```

#### Rule 2: Fenced Code with Language Detection (`fencedCodeWithLang`)

Matches `<pre>` elements containing a `<code>` child. Language detection uses three strategies in order:

**Strategy 1: Class attribute**
```typescript
const className = codeEl?.getAttribute?.("class") || "";
const langMatch = className.match(/(?:language-|lang-)(\w+)/);
```

**Strategy 2: Language label in sibling element**
TypeScript docs use `<pre><p>ts</p><code>...</code></pre>`. The rule scans children of `<pre>` before the `<code>` element looking for short text (1-15 chars, alphanumeric) that looks like a language name.

```typescript
const preChildren = Array.from(node.childNodes || []);
for (const child of preChildren) {
  if (child === codeEl || (child as Element).querySelector?.("code")) break;
  const childText = (child.textContent || "").trim();
  if (childText && childText.length <= 15 && /^[a-zA-Z][\w+-]*$/.test(childText)) {
    lang = childText.toLowerCase();
    // Remove the label from code text if it leaked in
    break;
  }
}
```

**Strategy 3: Auto-detect from content** (see 3g below)

The rule also:
- Uses `extractCodeText()` to preserve line breaks (see 3f-extractCodeText)
- Strips trailing "Try" links (TypeScript playground links): `text.replace(/\s*Try\s*$/, "")`
- Outputs fenced code blocks: `` ```lang\ncode\n``` ``

#### `extractCodeText()` Function

Some sites (e.g., typescriptlang.org) wrap each line of code in `<p>`, `<div>`, or use `<br>` tags. `textContent` collapses these into a single line. This function walks the DOM tree and inserts newlines at block-element boundaries.

```typescript
function extractCodeText(node: Node): string {
  const blockTags = new Set(["P", "DIV", "BR", "LI", "TR"]);
  const lines: string[] = [];
  let currentLine = "";

  function walk(n: Node) {
    if (n.nodeType === 3) {
      // Text node
      currentLine += n.textContent || "";
    } else if (n.nodeType === 1) {
      const el = n as Element;
      // Skip anchor tags (e.g. "Try" playground links)
      if (el.nodeName === "A") return;
      if (blockTags.has(el.nodeName)) {
        if (currentLine) { lines.push(currentLine); currentLine = ""; }
      }
      for (const child of Array.from(n.childNodes)) { walk(child); }
      if (blockTags.has(el.nodeName) && currentLine) {
        lines.push(currentLine); currentLine = "";
      }
    }
  }

  walk(node);
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}
```

### 3g. Language Auto-Detection -- `detectLanguage()`

Best-effort detection from code content. Checks patterns in this order (first match wins):

| Language | Detection Pattern |
|----------|-------------------|
| JSON | Starts with `{` or `[`, ends with `}` or `]` |
| HTML/XML | Starts with `<` tag |
| YAML | `key: value` pattern, no braces |
| CSS | Selectors with `{}` and properties with `:` |
| SQL | Starts with SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/DROP |
| Python | `def`/`import`/`from`/`class` with colon, no semicolons |
| Rust | `fn`/`let mut`/`impl`/`pub fn`/`use std::` |
| Go | `func`/`package`/`import (` |
| Bash | Shebang, `export`/`echo`/`npm`/`pnpm`/`yarn`/`git`/`cd`/`mkdir`/`curl` |
| TypeScript | `interface`/`type X =`/`export interface`/`export type` |
| JavaScript | `import`/`export`/`const`/`let`/`function`/`=>`/`require(` |

Returns empty string if no pattern matches.

### 3h. Post-Processing -- Shell Prompt Stripping

After Turndown produces markdown, two regex passes clean up shell prompts:

```typescript
// Convert: a line with just "$" followed by a command -> bash code block
markdown = markdown.replace(
  /^[ \t]*\$[ \t]*\n+(.+)$/gm,
  "```bash\n$1\n```",
);

// Strip any remaining lone $ lines
markdown = markdown.replace(/^[ \t]*\$[ \t]*$/gm, "");
```

This handles the pattern where Readability outputs a `$` prompt as a standalone paragraph followed by the command as another paragraph. The first regex wraps the command in a bash code fence; the second strips orphaned `$` lines.

### 3i. Content Versioning & Migration System

Each tab stores a `contentVersion` number. When extraction logic improves, we bump `CURRENT_CONTENT_VERSION` (currently `9`) and add migration entries.

```typescript
export const CURRENT_CONTENT_VERSION = 9;

export const MIGRATIONS: Migration[] = [
  {
    version: 2,
    actions: [
      {
        type: "re-extract-content",
        behavior: "silent",
        reason: "Improved content extraction with syntax highlighting, code blocks, and URL resolution",
      },
    ],
  },
];
```

`getPendingMigrations(tabContentVersion)` returns migrations newer than the tab's version. If the tab is behind current version but no specific migration entry exists for the gap, it returns a default "prompted" re-extract action:

```typescript
export function getPendingMigrations(tabContentVersion?: number): Migration[] {
  const currentVersion = tabContentVersion || 0;
  if (currentVersion >= CURRENT_CONTENT_VERSION) return [];
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0 && currentVersion < CURRENT_CONTENT_VERSION) {
    return [{
      version: CURRENT_CONTENT_VERSION,
      actions: [{ type: "re-extract-content", behavior: "prompted", reason: "Content extraction improvements available" }],
    }];
  }
  return pending;
}
```

On `DetailPage` mount:
- **Silent** actions auto-run immediately (no user interaction)
- **Prompted** actions show a toast: "Content update available" with an "Update" button
- **Destructive** actions (not currently used) would require explicit confirmation

---

## 4. Markdown Rendering (MarkdownView)

### Component Structure

`MarkdownView` is a SolidJS component that takes `content` (markdown string) and `sourceUrl` and renders styled HTML.

### marked Configuration

A single global `marked.use()` call configures the custom renderer. Key renderers:

#### Headings
```typescript
heading({ tokens, depth, raw }) {
  const text = this.parser.parseInline(tokens);  // CRITICAL: renders inline markdown
  const id = raw.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `<${tag} id="${id}" class="..." style="scroll-margin-top:1rem">${text}</${tag}>`;
}
```

- `this.parser.parseInline(tokens)` is required in marked v18 to render backticks, bold, italic, links inside headings
- `id` is generated from `raw` text for TOC anchor linking
- `scroll-margin-top: 1rem` offsets the scroll position when clicking a TOC link so the heading isn't hidden behind fixed elements

#### Paragraphs and Links
Both use `this.parser.parseInline(tokens)` for inline markdown rendering.

Links call `resolveUrl(href)` to fix any chrome-extension:// URLs that slipped through.

#### Code Blocks
```typescript
code({ text, lang }) {
  const langAttr = lang ? ` data-lang="${lang}"` : "";
  return `<pre class="..." ${langAttr}><code>${text}</code></pre>`;
}
```

The `data-lang` attribute is used by the Shiki post-render highlighting pass.

#### Lists and List Items
```typescript
listitem({ tokens }) {
  const text = this.parser.parse(tokens);  // NOTE: parse(), not parseInline()
  return `<li class="...">${text}</li>`;
}
```

List items use `this.parser.parse()` because they can contain block elements (paragraphs, code blocks, nested lists).

#### Blockquotes
```typescript
blockquote({ tokens }) {
  const body = this.parser.parse(tokens);  // Block content
  return `<blockquote class="...">${body}</blockquote>`;
}
```

### `resolveUrl()` -- Render-Time URL Resolution

Even after pre-processing, some URLs may still be relative or resolved against the extension origin. This function catches them at render time:

```typescript
const EXT_ORIGIN = browser.runtime.getURL("").replace(/\/$/, "");

function resolveUrl(href: string): string {
  if (!currentSourceUrl || !href) return href;
  if (href.startsWith("mailto:") || href.startsWith("data:")) return href;

  // Detect chrome-extension:// URLs and recover original path
  if (EXT_ORIGIN && href.startsWith(EXT_ORIGIN)) {
    const path = href.slice(EXT_ORIGIN.length);
    // background.js#anchor -> was originally a #anchor link
    if (path.startsWith("/background.js#") || path === "/background.js") {
      const anchor = path.replace("/background.js", "");
      if (!anchor || anchor === "#") return "#";
      return new URL(currentSourceUrl).origin + new URL(currentSourceUrl).pathname + anchor;
    }
    // Other extension-resolved paths
    return new URL(path, currentSourceUrl).href;
  }

  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("#")) return href;

  return new URL(href, currentSourceUrl).href;
}
```

The `background.js#anchor` pattern occurs because the service worker's URL is `chrome-extension://id/background.js`, so a `#section` anchor gets resolved to `chrome-extension://id/background.js#section`.

### Shiki Syntax Highlighting

#### Setup
```typescript
const highlighter = await createHighlighterCore({
  themes: [import("shiki/themes/github-dark-dimmed.mjs")],
  langs: [
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/css.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/bash.mjs"),
    import("shiki/langs/yaml.mjs"),
    import("shiki/langs/python.mjs"),
    import("shiki/langs/xml.mjs"),
    import("shiki/langs/sql.mjs"),
  ],
  engine: createJavaScriptRegexEngine(),  // NOT Oniguruma WASM
});
```

#### Language Mapping
A `LANG_MAP` normalizes language aliases: `js` -> `javascript`, `ts` -> `typescript`, `sh`/`shell` -> `bash`, `py` -> `python`, `yml` -> `yaml`.

#### Post-Render Highlighting
```typescript
createEffect(() => {
  const html = htmlContent();
  if (!html || !contentRef) return;
  requestAnimationFrame(() => {
    if (contentRef) highlightCodeBlocks(contentRef);
  });
});
```

`highlightCodeBlocks()` finds all `<pre data-lang="...">` elements, runs Shiki's `codeToHtml()`, replaces the innerHTML with Shiki's output, copies the background color, and removes `data-lang` to prevent re-processing.

### Shell Prompt Cleanup at Render Time

The same shell prompt cleanup from extraction is repeated at render time as a safety net:

```typescript
let cleaned = props.content.replace(
  /^[ \t]*\$[ \t]*\n+(.+)$/gm,
  "```bash\n$1\n```",
);
cleaned = cleaned.replace(/^[ \t]*\$[ \t]*$/gm, "");
```

### Heading Styles

```typescript
const HEADING_STYLES: Record<number, string> = {
  1: "text-3xl font-bold text-foreground mt-10 mb-4",
  2: "text-2xl font-semibold text-foreground mt-10 mb-3",
  3: "text-lg font-semibold text-foreground mt-8 mb-3",
  4: "text-base font-semibold text-foreground mt-6 mb-2",
};
```

---

## 5. Detail Page Layout

### VitePress-Inspired Layout

The layout mimics VitePress documentation pages:

```
+------------------------------------------------------+
| Fixed Action Bar (DetailHeader, compact mode)        |
+------------------------------------------------------+
| [TOC dropdown - narrow only]                         |
+------------------------------------------------------+
|                                    |                  |
|  Content Column (max 768px)        | Fixed Sidebar    |
|                                    | (256px)          |
|  - Hero Card (DetailHeader hero)   |                  |
|  - Markdown/Transcript content     | - On This Page   |
|                                    | - Notes          |
|                                    | - Tags           |
|                                    | - Links          |
|                                    |                  |
+------------------------------------------------------+
| [Chat FAB]                                           |
+------------------------------------------------------+
```

### Flex Container Structure

```tsx
<div class="@container flex h-screen bg-background relative">
  <div class="flex-1 min-w-0 flex flex-col">
    {/* Fixed action bar */}
    <DetailHeader compact={heroScrolledPast()} />

    {/* Narrow: TOC dropdown */}

    {/* Scrollable area */}
    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div class="flex gap-16 mx-auto"
           style={{ "max-width": "calc(768px + 256px + 64px + 32px)" }}>

        {/* Content column */}
        <div class="flex-1 min-w-0 max-w-[768px] px-4">
          {/* Hero card */}
          {/* Content */}
        </div>

        {/* Sidebar placeholder -- reserves space in flex layout */}
        <div class="relative flex-shrink-0 w-[256px]">
          {/* Fixed sidebar -- positioned inside placeholder */}
          <div class="fixed top-14 max-w-96 h-[calc(100vh-42px)] overflow-y-auto">
            <DetailSidebar />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Sidebar Placeholder Pattern

The sidebar uses a two-element pattern:
1. A `<div class="w-[256px]">` in the flex flow that reserves horizontal space
2. Inside it, a `<div class="fixed">` that stays visible during scroll

This ensures the content column doesn't expand to fill the sidebar's space when scrolling.

### Container Queries for Narrow Viewports

A `ResizeObserver` on the container element detects `width < 768px`:

```typescript
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    setIsNarrow(entry.contentRect.width < 768);
  }
});
```

When narrow:
- Sidebar is hidden
- "On this page" dropdown appears above content
- Notes are shown inline

### Scroll-Reveal Compact Header

The action bar shows a compact title + thumbnail when the hero card scrolls out of view:

```typescript
const handleScroll = () => {
  if (!heroRef || !scrollRef) return;
  const heroBottom = heroRef.offsetTop + heroRef.offsetHeight;
  setHeroScrolledPast(scrollRef.scrollTop > heroBottom - 10);
};
```

`heroScrolledPast()` is passed as `compact` prop to `DetailHeader`.

### Chat FAB

A floating action button for AI chat replaces a dedicated chat panel. Rendered as `<ChatFab />` in the bottom corner.

---

## 6. Sidebar (DetailSidebar)

### TOC Generation

TOC entries are extracted from rendered headings in a `createEffect`:

```typescript
createEffect(() => {
  markdownContent();  // re-run when content changes
  requestAnimationFrame(() => {
    const headings = scrollRef.querySelectorAll("h1[id], h2[id], h3[id]");
    const entries: TocEntry[] = [];
    for (const h of headings) {
      const level = parseInt(h.tagName[1]);
      if (level <= 3) {
        entries.push({ id: h.id, text: h.textContent || "", level });
      }
    }
    setTocEntries(entries);
  });
});
```

### IntersectionObserver for Active Heading

```typescript
const observer = new IntersectionObserver(
  (observed) => {
    for (const entry of observed) {
      if (entry.isIntersecting) {
        setActiveId(entry.target.id);
      }
    }
  },
  {
    root: scrollRef,
    rootMargin: "-10% 0px -80% 0px",  // Active zone: top 10-20% of viewport
    threshold: 0,
  },
);
```

The `rootMargin` creates a narrow active zone near the top of the scroll container. When a heading enters this zone, it becomes the active TOC entry.

### Active Indicator Bar

A 2px sky-blue bar appears to the left of the active TOC entry:

```tsx
<Show when={activeId() === entry.id}>
  <div class="absolute left-[-17px] top-1 bottom-1 w-[2px] bg-sky-400 rounded-full" />
</Show>
```

### Sidebar Sections

1. **On this page** -- Table of contents (h1-h3)
2. **Notes** -- Editable notes, click to open editor
3. **Tags** -- Display tags with `#` prefix
4. **Links** -- External links extracted from markdown content

### External Link Extraction

Links are extracted from the raw markdown using regex:

```typescript
const regex = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
```

Filters:
- `(?<!!)` -- not image links
- Skip image URLs (`.png`, `.jpg`, `.gif`, `.svg`, `.webp`, `.ico`, `.bmp`)
- Skip same-domain links
- Deduplicate by href
- Limited to 8 links

---

## 7. Content Migration System

### Types

```typescript
// From @tab-zen/shared
export interface MigrationAction {
  type: "re-extract-content" | "regenerate-tags" | "regenerate-summary";
  behavior: "silent" | "prompted" | "destructive";
  reason: string;
}

export interface Migration {
  version: number;
  actions: MigrationAction[];
}
```

### Behaviors

| Behavior | User Experience |
|----------|----------------|
| `silent` | Auto-runs on detail page mount, no UI indication |
| `prompted` | Shows toast with "Update" button, user decides |
| `destructive` | Would require explicit confirmation (not currently used) |

### How It Works

1. `DetailPage` mounts and calls `getPendingMigrations(props.tab.contentVersion)`
2. Silent actions run immediately via `handleReExtract()`
3. Prompted actions show a toast bar at the bottom of the page
4. User clicks "Update" or dismisses with X
5. On update, `RE_EXTRACT_CONTENT` message is sent to background
6. Background re-extracts and saves with `contentVersion: CURRENT_CONTENT_VERSION`

### Fallback for Missing Migration Entries

If a tab's version is behind `CURRENT_CONTENT_VERSION` but no explicit migration entries exist in the `MIGRATIONS` array for that gap, `getPendingMigrations` returns a default prompted re-extract. This means you only need to add explicit entries when you want `silent` behavior; otherwise the generic "Content extraction improvements available" prompt covers it.

---

## 8. Problems We Solved (Lessons Learned)

### a. DOMParser not available in MV3 service workers

**Problem**: Turndown and Readability both need a DOM. `DOMParser` doesn't exist in service workers. `happy-dom` has Node.js dependencies that don't work in the browser.

**Solution**: Use `linkedom`'s `parseHTML()`. It's lightweight, has no Node.js deps, and provides a compatible DOM.

### b. linkedom resolves URLs against chrome-extension:// origin

**Problem**: In a service worker, linkedom resolves relative URLs against the extension's origin. `<a href="/about">` becomes `chrome-extension://extensionid/about`. This corruption is invisible -- the URLs look absolute so downstream code doesn't try to fix them.

**Solution**: Run `resolveRelativeUrls()` on the raw HTML string BEFORE any DOM parsing. Uses regex to convert all `href="/path"` and `src="/path"` to absolute URLs using the source page's origin.

### c. Turndown uses `document` internally

**Problem**: When you pass an HTML string to `td.turndown(html)`, Turndown tries to parse it using the global `document` object, which doesn't exist in service workers.

**Solution**: Parse HTML with linkedom first: `parseHTML('<html><body>' + html + '</body></html>')`, then pass `doc.body` as a DOM node to `td.turndown(doc.body)`.

### d. CSP blocks dynamic imports from CDN

**Problem**: Shiki's default setup loads themes and language grammars from CDN URLs at runtime. Chrome extension CSP blocks these requests.

**Solution**: Use `createHighlighterCore` with bundled imports (`import("shiki/themes/...")`, `import("shiki/langs/...")`). Use `createJavaScriptRegexEngine()` instead of the Oniguruma WASM engine (which also has loading issues).

### e. marked v18 renderer receives raw text

**Problem**: In marked v18, renderer callbacks like `heading({ tokens, depth })` receive raw token arrays, not pre-rendered HTML. If you just use `tokens[0].text`, inline markdown (bold, code, links) is not rendered.

**Solution**: Call `this.parser.parseInline(tokens)` to render inline markdown within heading, paragraph, and link renderers.

### f. marked listitem tokens contain block elements

**Problem**: List items can contain paragraphs, code blocks, and nested lists. Using `parseInline()` for list items breaks these block elements.

**Solution**: Use `this.parser.parse(tokens)` for list items and blockquotes.

### g. Readability strips language classes from code blocks

**Problem**: After Readability processes HTML, `class="language-typescript"` on `<code>` elements is often removed, losing language information.

**Solution**: Auto-detect language from code content using pattern matching (`detectLanguage()`).

### h. TypeScript docs use `<p>ts</p>` before `<code>`

**Problem**: TypeScript documentation pages put a language label in a `<p>` tag as a sibling before the `<code>` element inside `<pre>`: `<pre><p>ts</p><code>...</code></pre>`.

**Solution**: The fenced code rule scans `<pre>` children before `<code>` for short text nodes (1-15 chars, alphanumeric pattern) that look like language labels. If found, use as language and remove from code text.

### i. TypeScript docs use `<p>` per line in code

**Problem**: Some sites wrap each line of code in `<p>` tags. `textContent` collapses all lines into one.

**Solution**: `extractCodeText()` walks the DOM tree and inserts newlines at block-element boundaries (`P`, `DIV`, `BR`, `LI`, `TR`).

### j. Blog headings wrapped in anchor tags

**Problem**: Blogs commonly wrap headings in anchor tags for permalink support: `<a href="#id"><h2>Section</h2></a>`. Turndown converts this to `[## Section](#id)` which is broken markdown.

**Solution**: Custom Turndown rule `headingAnchorStrip` detects `<a>` elements containing headings and outputs just the heading markdown, stripping the anchor.

### k. Shell prompt $ appears as standalone text

**Problem**: Readability sometimes outputs shell examples as a `$` in one paragraph and the command in the next paragraph. The markdown looks like:

```
$

curl -fsSL https://example.com/install.sh | bash
```

**Solution**: Post-processing regex converts `$ + newline + command` into a fenced bash code block. Remaining lone `$` lines are stripped.

### l. Readability output sometimes missing code blocks entirely

**Problem**: When a page has `$` followed by a command (a shell example), Readability can strip the code block entirely, leaving just the `$` and bare command text as paragraphs.

**Solution**: The post-processing regex in 3h catches this pattern and wraps the bare command in a bash code fence.

---

## 9. Test Coverage

All tests are in `tests/page-extract.test.ts` using Vitest.

### `shouldExtractContent` tests
- Returns true for article URLs (CSS Tricks, generic blogs)
- Returns false for YouTube URLs (watch, youtu.be, shorts)
- Returns false for non-http protocols (chrome://, chrome-extension://, about:blank)
- Returns true for any http/https URL that isn't YouTube

### `htmlToMarkdown` tests

**Basic conversion:**
- Simple HTML to markdown (headings, bold)
- Code blocks
- Links
- Empty input handling

**URL resolution:**
- Resolves relative links with sourceUrl
- Resolves relative image srcs
- Leaves absolute links unchanged
- Leaves anchor-only links unchanged
- Resolves relative paths with anchors
- Resolves parent-relative paths (`../`)
- Leaves mailto links unchanged
- Works without sourceUrl (no resolution)

**Code block language detection:**
- Detects from `class="language-typescript"`
- Detects from `class="lang-python"`
- Detects language label in `<p>` before `<code>` (TypeScript docs pattern)
- Auto-detects: JSON, YAML, Bash, TypeScript (interface), JavaScript (imports), HTML, CSS, SQL, Python
- Preserves line breaks when lines wrapped in `<p>` tags
- Strips trailing "Try" links

**Shell prompt stripping:**
- Converts `$` + command (span before pre)
- Converts `$` + command (div before pre)
- Strips `$` inside pre before code
- Wraps bare command after `$` prompt in bash fence
- Keeps `$` when part of code content (like `$HOME`)

**Heading anchor links:**
- Strips anchor tags wrapping headings
- Strips anchors with SVG icons
- Handles multiple heading levels
- Keeps normal links that don't wrap headings

### `getPendingMigrations` tests
- Returns all migrations for tabs with no version
- Returns all migrations for version 0
- Returns empty for current version
- Returns only newer migrations
- Validates migration structure (version, actions, type, behavior, reason)

---

## 10. Full Code

### page-extract.ts

```typescript
import { isYouTubeWatchUrl } from "./youtube";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Migration } from "@tab-zen/shared";

/** Current content version — bump when extraction logic improves */
export const CURRENT_CONTENT_VERSION = 9;

/** Registry of migrations — each defines what actions to take when upgrading */
export const MIGRATIONS: Migration[] = [
  {
    version: 2,
    actions: [
      {
        type: "re-extract-content",
        behavior: "silent",
        reason: "Improved content extraction with syntax highlighting, code blocks, and URL resolution",
      },
    ],
  },
];

export interface PageExtractResult {
  title: string;
  byline: string | null;
  content: string;        // markdown
  excerpt: string | null;
  siteName: string | null;
}

/**
 * Whether we should attempt content extraction for this URL.
 * Returns false for YouTube (handled by transcript extraction),
 * non-http protocols, and chrome-internal pages.
 */
export function shouldExtractContent(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  } catch {
    return false;
  }
  if (isYouTubeWatchUrl(url)) return false;
  return true;
}

/**
 * Resolve relative URLs in a raw HTML string.
 * Must be called BEFORE linkedom/Readability parse the HTML, because
 * linkedom in a service worker resolves getAttribute("href") against
 * the chrome-extension:// origin.
 */
function resolveRelativeUrls(html: string, sourceUrl: string): string {
  try {
    const origin = new URL(sourceUrl).origin;
    const baseUrl = sourceUrl.replace(/\/[^/]*$/, "/");

    // Resolve href="/path" and src="/path" (root-relative)
    let result = html.replace(
      /(href|src)="(\/[^"]*?)"/g,
      (_match, attr, path) => `${attr}="${origin}${path}"`,
    );

    // Resolve href="path" and src="path" (relative, not protocol/anchor/data/root)
    result = result.replace(
      /(href|src)="(?!https?:\/\/|mailto:|#|data:|\/\/|\/[^/])([^"]*?)"/g,
      (_match, attr, path) => {
        try {
          return `${attr}="${new URL(path, baseUrl).href}"`;
        } catch {
          return _match;
        }
      },
    );

    return result;
  } catch {
    return html;
  }
}

/** Convert HTML string to markdown using Turndown. Runs in background service worker. */
export function htmlToMarkdown(html: string, sourceUrl?: string): string {
  if (!html || !html.trim()) return "";

  // If sourceUrl provided, resolve any remaining relative URLs in the HTML
  // (most should already be resolved before Readability, this is a safety net)
  const processedHtml = sourceUrl ? resolveRelativeUrls(html, sourceUrl) : html;

  // Turndown uses `document` internally to parse HTML strings, which doesn't
  // exist in MV3 service workers. Parse with linkedom and pass the DOM node.
  // Wrap in <html><body> so linkedom places content in document.body.
  const { document: doc } = parseHTML(`<html><body>${processedHtml}</body></html>`);
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Preserve language info from <code class="language-xxx">, language labels
  // in sibling elements (e.g. TypeScript docs: <pre><p>ts</p><code>...</code></pre>),
  // or auto-detect from content.
  // Strip anchor tags that wrap headings (common blog pattern: <a href="#id"><h2>...</h2></a>)
  // These produce broken markdown like [## Heading](url)
  td.addRule("headingAnchorStrip", {
    filter: (node) => {
      if (node.nodeName !== "A") return false;
      // Check if this anchor contains a heading as a child
      const hasHeading = node.querySelector?.("h1, h2, h3, h4, h5, h6");
      return !!hasHeading;
    },
    replacement: (_content, node) => {
      // Just return the inner content — Turndown will process the heading inside
      const el = node as Element;
      const heading = el.querySelector?.("h1, h2, h3, h4, h5, h6");
      if (heading) {
        const level = parseInt(heading.nodeName[1]);
        const prefix = "#".repeat(level);
        return `\n\n${prefix} ${heading.textContent?.trim() || ""}\n\n`;
      }
      return _content;
    },
  });

  td.addRule("fencedCodeWithLang", {
    filter: (node) => {
      if (node.nodeName !== "PRE") return false;
      // Match if there's a <code> anywhere inside, or if it looks like a code block
      const hasCode = node.querySelector?.("code") !== null && node.querySelector?.("code") !== undefined;
      const firstChild = node.firstChild;
      const firstChildIsCode = firstChild?.nodeName === "CODE";
      return hasCode || firstChildIsCode;
    },
    replacement: (_content, node) => {
      const el = node as Element;
      const codeEl = el.querySelector?.("code");

      // Extract code text, preserving line breaks from block-level children
      // (some sites like typescriptlang.org wrap each line in <p> tags)
      let text = extractCodeText(codeEl || node);

      // Try to find language from:
      // 1. class="language-xxx" on <code>
      let lang = "";
      const className = codeEl?.getAttribute?.("class") || "";
      const langMatch = className.match(/(?:language-|lang-)(\w+)/);
      if (langMatch) {
        lang = langMatch[1];
      }

      // 2. A short text node or <p> before <code> (e.g. <pre><p>ts</p><code>...)
      //    Also check parent <pre>'s children if codeEl is nested deeper
      if (!lang) {
        const preChildren = Array.from(node.childNodes || []);
        for (const child of preChildren) {
          // Stop if we've reached the code element or its parent
          if (child === codeEl || (child as Element).querySelector?.("code")) break;
          const childText = (child.textContent || "").trim();
          // Short text (1-15 chars) before code is likely a language label
          if (childText && childText.length <= 15 && /^[a-zA-Z][\w+-]*$/.test(childText)) {
            lang = childText.toLowerCase();
            // Remove this label from the code text if it leaked in
            const firstLine = text.split("\n")[0];
            if (firstLine.trim() === childText) {
              text = text.split("\n").slice(1).join("\n");
            } else if (text.startsWith(childText)) {
              text = text.slice(childText.length).replace(/^\s*\n?/, "");
            }
            break;
          }
        }
      }

      // 3. Auto-detect from content
      if (!lang) {
        lang = detectLanguage(text);
      }

      // Strip trailing "Try" links (TypeScript playground links)
      text = text.replace(/\s*Try\s*$/, "");

      return `\n\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  let markdown = td.turndown(doc.body as any);

  // Convert standalone $ prompt + bare command into a fenced bash code block
  markdown = markdown.replace(
    /^[ \t]*\$[ \t]*\n+(.+)$/gm,
    "```bash\n$1\n```",
  );
  // Strip any remaining lone $ lines
  markdown = markdown.replace(/^[ \t]*\$[ \t]*$/gm, "");

  return markdown;
}

/**
 * Extract text from a code element, preserving line breaks.
 * Some sites wrap each line in <p>, <div>, or <br> — textContent
 * collapses these into a single line. This function inserts newlines
 * at block-element boundaries.
 */
function extractCodeText(node: Node): string {
  const blockTags = new Set(["P", "DIV", "BR", "LI", "TR"]);
  const lines: string[] = [];
  let currentLine = "";

  function walk(n: Node) {
    if (n.nodeType === 3) {
      // Text node
      currentLine += n.textContent || "";
    } else if (n.nodeType === 1) {
      const el = n as Element;
      // Skip anchor tags (e.g. "Try" playground links)
      if (el.nodeName === "A") return;
      if (blockTags.has(el.nodeName)) {
        // Flush current line before block element
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }
      }
      for (const child of Array.from(n.childNodes)) {
        walk(child);
      }
      if (blockTags.has(el.nodeName) && currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
    }
  }

  walk(node);
  if (currentLine) lines.push(currentLine);

  return lines.join("\n");
}

/** Best-effort language detection from code content */
function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // JSON: starts with { or [
  if (/^\s*[\{\[]/.test(trimmed) && /[\}\]]\s*$/.test(trimmed)) return "json";

  // HTML/XML: starts with < tag
  if (/^\s*<[a-zA-Z!]/.test(trimmed)) return "html";

  // YAML: key: value pattern, no braces
  if (/^\s*[\w-]+\s*:(?:\s|$)/m.test(trimmed) && !trimmed.includes("{")) return "yaml";

  // CSS: has selectors with { } and properties with :
  if (/[.#@]\w+.*\{[\s\S]*?:/.test(trimmed)) return "css";

  // SQL: common keywords
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(trimmed)) return "sql";

  // Python: def/import/class with colon, no semicolons
  if (/^\s*(def |import |from |class )/m.test(trimmed) && !trimmed.includes(";")) return "python";

  // Rust: fn/let mut/impl/pub fn
  if (/^\s*(fn |let mut |impl |pub fn |use std::)/m.test(trimmed)) return "rust";

  // Go: func/package/import with Go patterns
  if (/^\s*(func |package |import \()/m.test(trimmed)) return "go";

  // Bash/shell: shebang, common commands, $variables
  if (/^#!\/bin\/(ba)?sh/m.test(trimmed) || /^\s*(export |echo |if \[\[|npm |pnpm |yarn |git |cd |mkdir |curl )/m.test(trimmed)) return "bash";

  // TypeScript: import/export with types, interface, type
  if (/^\s*(interface |type \w+ =|export (interface|type))/m.test(trimmed)) return "typescript";

  // JavaScript/TypeScript: import/export/const/function with common patterns
  if (/^\s*(import |export |const |let |function |=>|require\()/m.test(trimmed)) return "javascript";

  return "";
}

/**
 * Extract content from a browser tab using Readability + Turndown.
 *
 * Injects a trivial function to grab the page HTML (no CSP issues),
 * then runs Readability + Turndown in the background service worker
 * using linkedom as the DOM parser (lightweight, no Node.js deps).
 */
export async function extractPageContent(
  browserTabId: number,
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: browserTabId },
      func: () => document.documentElement.outerHTML,
    });

    const rawHtml = results?.[0]?.result;
    if (!rawHtml || typeof rawHtml !== "string") return null;

    // Resolve relative URLs BEFORE parsing — linkedom resolves against extension origin
    const resolvedHtml = resolveRelativeUrls(rawHtml, url);

    const { document } = parseHTML(resolvedHtml);
    const article = new Readability(document as any).parse();
    if (!article || !article.content) return null;

    const markdown = htmlToMarkdown(article.content, url);
    if (!markdown.trim()) return null;

    return {
      title: article.title ?? "",
      byline: article.byline ?? null,
      content: markdown,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
    };
  } catch (e) {
    console.warn("[TabZen] Page content extraction failed:", e);
    return null;
  }
}

/**
 * Extract page content via fetch (no browser tab needed).
 * Falls back to this when the page isn't open in a tab.
 * Works for server-rendered pages; won't work for SPAs that require JS.
 */
export async function extractPageContentViaFetch(
  url: string,
): Promise<PageExtractResult | null> {
  if (!shouldExtractContent(url)) return null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });

    if (!response.ok) return null;

    const rawHtml = await response.text();
    if (!rawHtml) return null;

    // Resolve relative URLs BEFORE parsing — linkedom resolves against extension origin
    const resolvedHtml = resolveRelativeUrls(rawHtml, url);

    const { document } = parseHTML(resolvedHtml);
    const article = new Readability(document as any).parse();
    if (!article || !article.content) return null;

    const markdown = htmlToMarkdown(article.content, url);
    if (!markdown.trim()) return null;

    return {
      title: article.title ?? "",
      byline: article.byline ?? null,
      content: markdown,
      excerpt: article.excerpt ?? null,
      siteName: article.siteName ?? null,
    };
  } catch (e) {
    console.warn("[TabZen] Fetch extraction failed:", e);
    return null;
  }
}

/**
 * Get pending migrations for a tab based on its contentVersion.
 */
export function getPendingMigrations(tabContentVersion?: number): Migration[] {
  const currentVersion = tabContentVersion || 0;
  if (currentVersion >= CURRENT_CONTENT_VERSION) return [];
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  // If tab is behind current version but no specific migration entries exist,
  // return a default re-extract action so the banner still shows
  if (pending.length === 0 && currentVersion < CURRENT_CONTENT_VERSION) {
    return [{
      version: CURRENT_CONTENT_VERSION,
      actions: [{ type: "re-extract-content", behavior: "prompted", reason: "Content extraction improvements available" }],
    }];
  }
  return pending;
}
```

### MarkdownView.tsx

```tsx
import { createMemo, createEffect, Show } from "solid-js";
import { FileText } from "lucide-solid";
import { marked } from "marked";

interface MarkdownViewProps {
  content: string;
  sourceUrl?: string;
  onFetchContent?: () => void;
  loading?: boolean;
}

// Set before each parse call so the renderer can resolve relative URLs
let currentSourceUrl: string | undefined;

// The extension origin prefix that the browser resolves relative URLs against
const EXT_ORIGIN = (() => {
  try {
    return browser.runtime.getURL("").replace(/\/$/, "");
  } catch {
    return "";
  }
})();

function resolveUrl(href: string): string {
  if (!currentSourceUrl || !href) return href;
  if (href.startsWith("mailto:") || href.startsWith("data:")) return href;

  // If the browser already resolved a relative URL against the extension origin,
  // recover the original path and resolve against the source page instead
  if (EXT_ORIGIN && href.startsWith(EXT_ORIGIN)) {
    const path = href.slice(EXT_ORIGIN.length);
    // background.js#anchor = was originally a #anchor link on the source page
    if (path.startsWith("/background.js#") || path === "/background.js") {
      const anchor = path.replace("/background.js", "");
      if (!anchor || anchor === "#") return "#";
      try {
        return new URL(currentSourceUrl).origin + new URL(currentSourceUrl).pathname + anchor;
      } catch {
        return anchor;
      }
    }
    // Other extension-resolved paths — resolve against source
    try {
      return new URL(path, currentSourceUrl).href;
    } catch {
      return href;
    }
  }

  // Already absolute and not extension-relative
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  // Pure anchor
  if (href.startsWith("#")) return href;

  try {
    return new URL(href, currentSourceUrl).href;
  } catch {
    return href;
  }
}

// Configure marked with custom renderer using this.parser.parseInline
// for proper inline markdown rendering (backticks, bold, italic, links)
const HEADING_STYLES: Record<number, string> = {
  1: "text-3xl font-bold text-foreground mt-10 mb-4",
  2: "text-2xl font-semibold text-foreground mt-10 mb-3",
  3: "text-lg font-semibold text-foreground mt-8 mb-3",
  4: "text-base font-semibold text-foreground mt-6 mb-2",
};

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth, raw }) {
      const text = this.parser.parseInline(tokens);
      const tag = `h${depth}`;
      // Generate ID from raw text for TOC linking
      const id = raw.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
      return `<${tag} id="${id}" class="${HEADING_STYLES[depth] || HEADING_STYLES[4]}" style="scroll-margin-top:1rem">${text}</${tag}>`;
    },
    paragraph({ tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<p class="text-sm text-foreground/80 leading-[1.8]">${text}</p>`;
    },
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<a href="${resolveUrl(href)}" target="_blank" class="text-sky-400 hover:underline">${text}</a>`;
    },
    image({ href, text }) {
      return `<img src="${resolveUrl(href)}" alt="${text}" class="rounded-lg max-w-full my-4" />`;
    },
    code({ text, lang }) {
      const langAttr = lang ? ` data-lang="${lang}"` : "";
      return `<pre class="bg-muted/30 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed my-4"${langAttr}><code>${text}</code></pre>`;
    },
    codespan({ text }) {
      return `<code class="bg-muted/30 px-1.5 py-0.5 rounded text-sm">${text}</code>`;
    },
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      return `<blockquote class="border-l-2 border-muted-foreground/20 pl-4 italic text-muted-foreground">${body}</blockquote>`;
    },
    list(token) {
      const tag = token.ordered ? "ol" : "ul";
      let body = "";
      for (const item of token.items) {
        body += this.listitem(item);
      }
      return `<${tag} class="ml-4 space-y-1 ${token.ordered ? "list-decimal" : "list-disc"}">${body}</${tag}>`;
    },
    listitem({ tokens }) {
      const text = this.parser.parse(tokens);
      return `<li class="text-sm text-foreground/80 leading-[1.8]">${text}</li>`;
    },
    hr() {
      return `<hr class="border-muted/30 my-8" />`;
    },
  },
});

// --- Shiki syntax highlighting (bundled, lazy-loaded) ---

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  javascript: "javascript",
  typescript: "typescript",
  json: "json",
  css: "css",
  html: "html",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  yaml: "yaml",
  yml: "yaml",
  python: "python",
  py: "python",
  sql: "sql",
  xml: "xml",
};

let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    try {
      const { createHighlighterCore } = await import("shiki/core");
      const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
      const highlighter = await createHighlighterCore({
        themes: [import("shiki/themes/github-dark-dimmed.mjs")],
        langs: [
          import("shiki/langs/javascript.mjs"),
          import("shiki/langs/typescript.mjs"),
          import("shiki/langs/json.mjs"),
          import("shiki/langs/css.mjs"),
          import("shiki/langs/html.mjs"),
          import("shiki/langs/bash.mjs"),
          import("shiki/langs/yaml.mjs"),
          import("shiki/langs/python.mjs"),
          import("shiki/langs/xml.mjs"),
          import("shiki/langs/sql.mjs"),
        ],
        engine: createJavaScriptRegexEngine(),
      });
      return highlighter;
    } catch (e) {
      console.warn("[TabZen] Failed to load Shiki:", e);
      highlighterPromise = null;
      return null;
    }
  })();

  return highlighterPromise;
}

async function highlightCodeBlocks(container: HTMLElement) {
  const preWithLang = container.querySelectorAll("pre[data-lang]");
  if (preWithLang.length === 0) return;

  const highlighter = await getHighlighter();
  if (!highlighter) return;

  for (const pre of preWithLang) {
    const rawLang = pre.getAttribute("data-lang") || "";
    const lang = LANG_MAP[rawLang.toLowerCase()];
    if (!lang) continue;

    const code = pre.querySelector("code");
    if (!code) continue;

    try {
      const highlighted = highlighter.codeToHtml(code.textContent || "", {
        lang,
        theme: "github-dark-dimmed",
      });
      const tmp = document.createElement("div");
      tmp.innerHTML = highlighted;
      const shikiPre = tmp.querySelector("pre");
      if (shikiPre) {
        // Keep our rounded/padding classes, replace inner content with Shiki output
        pre.innerHTML = shikiPre.innerHTML;
        // Carry over Shiki's inline background style
        const bg = (shikiPre as HTMLElement).style.backgroundColor;
        if (bg) (pre as HTMLElement).style.backgroundColor = bg;
        pre.removeAttribute("data-lang");
      }
    } catch {
      // Language not supported or error — leave as plain text
    }
  }
}

/**
 * Renders extracted markdown content as styled HTML.
 * Code blocks get syntax highlighting via Shiki (bundled, lazy-loaded).
 */
export default function MarkdownView(props: MarkdownViewProps) {
  const htmlContent = createMemo(() => {
    if (!props.content) return "";
    currentSourceUrl = props.sourceUrl;
    // Convert standalone $ prompt + bare command into a fenced bash code block
    // Pattern: line with just "$", followed by a line that looks like a command
    let cleaned = props.content.replace(
      /^[ \t]*\$[ \t]*\n+(.+)$/gm,
      "```bash\n$1\n```",
    );
    // Also strip any remaining lone $ lines that didn't match the pattern above
    cleaned = cleaned.replace(/^[ \t]*\$[ \t]*$/gm, "");
    return marked.parse(cleaned, { async: false }) as string;
  });

  let contentRef: HTMLDivElement | undefined;

  // After content renders, resolve relative URLs and apply syntax highlighting
  createEffect(() => {
    const html = htmlContent();
    if (!html || !contentRef) return;

    requestAnimationFrame(() => {
      if (contentRef) highlightCodeBlocks(contentRef);
    });
  });

  return (
    <div>
      <Show
        when={props.content}
        fallback={
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No content available</p>
            <Show when={props.onFetchContent}>
              <button
                onClick={props.onFetchContent}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Extracting..." : "Extract Content"}
              </button>
            </Show>
          </div>
        }
      >
        <div class="px-2 pb-12">
          <div
            ref={contentRef}
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}
```
