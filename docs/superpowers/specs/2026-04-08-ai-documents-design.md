# Milestone 4: AI-Generated Documents & Summaries

## Overview

Add AI-powered document generation to Tab Zen. Users can generate structured outputs (summaries, key points, action items, etc.) from saved tab content using customizable prompt templates. Generated documents appear as pill tabs alongside the raw content in the detail page.

## Prompt Template System

Templates are user-editable data stored in IndexedDB. Each template:

```ts
interface AITemplate {
  id: string;           // UUID
  name: string;         // display name, used as pill tab label
  prompt: string;       // the instruction text (max 500 chars for custom)
  isBuiltin: boolean;   // true for shipped defaults
  defaultPrompt: string | null; // original prompt text for built-ins (null for custom)
  isEnabled: boolean;   // toggle visibility without deleting
  sortOrder: number;    // controls pill tab ordering
  model: string | null; // per-template model override; null = use global default
}
```

### Built-in Defaults (5)

1. **Summary** — 2-5 sentence TL;DR of the content
2. **Key Points** — Bulleted list of main takeaways
3. **Action Items** — Extractable tasks and next steps
4. **ELI5** — Simple explanation of complex content
5. **Products & Mentions** — Sponsors, tools, and products referenced

Built-in templates can be edited but not deleted. A "Reset to Default" option restores the original prompt when a built-in has been modified.

### Custom Templates

Users can create additional templates with custom names and prompts. Custom templates can be deleted. No limit on count, but prompts are capped at 500 characters.

### Prompt Files

Prompts for built-in templates are stored as markdown files in the extension source (e.g., `prompts/summary.md`, `prompts/key-points.md`). These are loaded as the `defaultPrompt` on first run or reset. This allows iterating on prompt quality without code changes.

## Data Model

Generated outputs stored in a new `aiDocuments` IndexedDB object store:

```ts
interface AIDocument {
  id: string;           // UUID
  tabId: string;        // references the tab this was generated for
  templateId: string;   // references the template used
  content: string;      // the generated markdown output
  generatedAt: string;  // ISO timestamp
  promptUsed: string;   // snapshot of the prompt at generation time
}
```

- Unique constraint on `(tabId, templateId)` — one output per tab per template
- `promptUsed` captures the prompt at generation time so the user can see if results are stale after editing a template
- Syncs through the existing sync mechanism in the sync payload

## AI Generation Flow

### Architecture

All AI processing happens in the extension (client-side), calling OpenRouter directly. This follows the existing pattern used by `groupTabsWithAI`, `aiSearch`, and `generateTags` in `lib/ai.ts`.

### New Function

```ts
generateDocument(
  apiKey: string,
  model: string,
  template: AITemplate,
  content: string,
  contentType: "transcript" | "markdown"
): Promise<string>
```

- `content` is the raw transcript text (segments joined) or markdown article content
- `contentType` is passed to the prompt so it can adjust language (e.g., "this video discusses" vs "this article covers")
- Returns generated markdown string
- Each template runs as its own API call (separate prompts, not batched)
- "Generate All" fires all enabled templates in parallel via `Promise.allSettled`

### System Prompt Structure

Each call sends:
- **System message:** A base instruction that includes the content type context, plus the template's prompt text
- **User message:** The raw content (transcript or article markdown)

### Tag Generation Improvement

The existing `generateTags` function is updated to receive the user's current tag vocabulary. The prompt is augmented with: "Prefer reusing these existing tags when appropriate: [existing tags]". This reduces tag bloat without requiring a separate cleanup feature.

## Detail Page UI

### Pill Tab Bar

Inserted between the hero header and the content area. Tabs:

1. **Content** (always first) — the existing transcript or markdown view
2. **Template tabs** — one per enabled template, in `sortOrder`
3. **+ Custom** (always last, dashed border) — creates a new custom template inline
4. **Generate All** (right-aligned) — fires all un-generated templates in parallel; disabled when all are generated

### Tab Content States

**Content tab (active by default):**
- Exactly the current behavior — `TranscriptView` or `MarkdownView`

**AI document tab — not yet generated:**
- Centered message: "Generate a {template name} of this content"
- "Generate" button below

**AI document tab — generating:**
- Spinner with "Generating {template name}..."

**AI document tab — generated:**
- Rendered markdown content
- Top-right actions: "Regenerate" (re-runs the prompt), "Copy" (copies to clipboard)

**+ Custom tab:**
- Inline text input for the prompt (500 char limit)
- "Run" button
- Result displays in the same area
- Creating a custom prompt saves it as a new `AITemplate` with `isBuiltin: false`
- Custom templates created from the detail page appear in the settings template list and vice versa — they are the same records

### Sidebar Integration

The sidebar TOC adapts to the active tab's content. When viewing an AI document with headings, the TOC reflects those headings instead of the raw content's headings.

## Settings Reorganization

The settings page is reorganized into pill tabs to accommodate template management:

### General
- Device label
- Open mode (new tab / current tab)
- View mode (cards / rows)

### AI
- OpenRouter API key
- Model selection
- **Template Management:**
  - List of all templates (built-in + custom)
  - Drag handles for reordering
  - Toggle switch for enabled/disabled per template
  - Click to expand: editable name, editable prompt textarea, char count
  - Built-in templates show "Reset to Default" when modified
  - "Add Template" button at bottom for new custom templates

### Sync
- Sync toggle
- Sync token
- Sync URL
- Environment (local / remote)

### Blocked Domains
- Domain blocklist management

## Sync Considerations

- `AITemplate` records sync so template customizations carry across devices
- `AIDocument` records sync so generated outputs are available everywhere
- Both are added to the existing `SyncPayload` interface
- Conflict resolution: last-write-wins (same as existing tab/group sync)

## Out of Scope

- Tag cleanup/consolidation tool (future milestone)
- Auto-generation on capture (user must explicitly trigger)
- Per-template model selection UI (the `model` field exists in the schema for future use, but the settings UI won't expose it yet)
- Streaming responses (wait for full response, then display)
