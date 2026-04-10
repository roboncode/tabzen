# Social Posts — Design Spec

## Overview

A new built-in section that generates social media posts positioning the user as a subject matter expert based on content they've consumed. Not promotional — the user shares what they learned AS themselves.

## Platform Support

| Platform | Char Limit | Key Traits |
|----------|-----------|------------|
| X/Twitter | 280 (single), unlimited (thread) | Punchy, hot takes, threads for depth |
| LinkedIn | 3,000 | Professional, longer-form, storytelling |
| Instagram | 2,200 (caption) | Visual-first, hashtag-heavy, casual |
| Facebook | 63,206 | Community-oriented, conversational |
| Threads | 500 | Casual, conversational, similar to X |

## User Controls

### Platform Pills
Horizontal pill selector. One active at a time. Selecting a platform triggers generation if content hasn't been generated for that platform + current settings combo.

### Length Selector
Segmented control with 4 options:
- **Brief** — 1-2 sentences
- **Standard** — 1 short paragraph
- **Detailed** — 2-3 paragraphs
- **Thread** — Multiple connected posts (X/Twitter only; other platforms fall back to Detailed)

### Toggles
- **Hashtags** — on/off, generates platform-appropriate hashtags
- **End with question** — appends an engagement question

### Voice & Personality
- Collapsible textarea, 300 char limit
- Placeholder: "e.g., Professional but approachable. I use data to back up claims. I avoid jargon and explain things simply."
- No resize handle (CSS `resize: none`)
- Saved globally in extension settings, persists across all articles/videos
- Injected into the system prompt as tone context

## Persistent Settings

All stored in extension settings (not per-tab):
- `socialVoice: string` — voice/personality text (max 300 chars)
- `socialDefaultLength: "brief" | "standard" | "detailed" | "thread"` — default length
- `socialHashtags: boolean` — default hashtag preference
- `socialEngagementQuestion: boolean` — default question toggle

## Generation Behavior

- NOT auto-generated. User must select platform first.
- Generate per-platform + settings combo on demand.
- Changing platform checks if a cached result exists for that combo; if not, generates.
- Changing length/toggles regenerates for the current platform.
- Generated posts cached per (tabId, platform, length, hashtags, question) combo as AIDocuments with templateId `builtin-social-posts`.

## Post Display

### Single Post (Brief, Standard, Detailed)
Clean card with:
- Platform badge (colored pill with platform icon/name)
- "Single post · X / Y chars" metadata
- Post text
- Hashtags below a subtle divider (if enabled)
- Copy button (copies text + hashtags together)

### Thread (Thread length)
- Header: platform badge + "Thread · N posts" + "Copy All" button
- Posts connected by a vertical line (border-left, sky-400/15)
- Each post is its own card within the thread
- Each card has: post text, "Copy" button, "N/M · X chars" footer
- Copy All copies all posts separated by newlines

## Components

### SocialPostsView
Orchestrator component. Manages state, renders controls + post display.
Registered as a specialized renderer in DetailPage's SPECIALIZED_RENDERERS map.

### PostCard
Single post card. Props: text, platform, charCount, maxChars, hashtags, onCopy.

### ThreadView
Multiple PostCards connected by vertical line. Props: posts[], platform, onCopyAll.

### Reusable Controls (can be shared)
- Platform pills — inline in SocialPostsView
- Length segmented control — inline in SocialPostsView
- Toggle switches — inline in SocialPostsView

## Prompt Design

System prompt template (`prompts/social-posts.md`):

```
You are a social media expert writing as the user. Create a {{platformName}} post based on the following {{contentType}}.

{{voiceSection}}

Post requirements:
- Length: {{lengthInstruction}}
- Platform: {{platformName}} ({{charLimit}} character limit)
- Write as a subject matter expert sharing knowledge, NOT promoting the source content
- Do not reference "this article" or "this video" — write as if sharing your own insights
- {{hashtagInstruction}}
- {{questionInstruction}}
- {{threadInstruction}}

Format:
{{formatInstruction}}
```

The prompt is constructed dynamically based on user selections — not a static markdown file.

## Template & Nav Integration

- Template ID: `builtin-social-posts`
- Name: "Social Posts"
- Added to BUILTIN_TEMPLATES in templates.ts
- Appears in left nav between existing built-ins and custom section
- Prompt stored as a base template; actual prompt is constructed dynamically in the view

## Files to Create/Modify

### New files:
- `apps/extension/prompts/social-posts.md` — base prompt
- `apps/extension/components/detail/SocialPostsView.tsx` — main view
- `apps/extension/components/detail/PostCard.tsx` — single post card
- `apps/extension/components/detail/ThreadView.tsx` — thread display

### Modified files:
- `packages/shared/src/types.ts` — add social settings to Settings interface
- `apps/extension/lib/templates.ts` — add builtin-social-posts template
- `apps/extension/lib/settings.ts` — add social post defaults
- `apps/extension/components/detail/DetailPage.tsx` — add to SPECIALIZED_RENDERERS, handle dynamic prompt construction
- `apps/extension/components/detail/DocumentNav.tsx` — no changes needed (template appears automatically)
- `apps/extension/components/detail/DocumentSkeletons.tsx` — add SocialPostsSkeleton
