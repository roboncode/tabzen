# Detail Page Sidebar Layout Redesign

**Date:** 2026-04-07
**Status:** Approved

## Overview

Redesign the detail page layout to add a floating metadata sidebar on the right, replace the dedicated ChatPanel with a floating chat FAB, and handle responsive collapse.

## Layout

### Wide View (container > 768px)

```
┌─ Action Bar ─────────────────────────────────────────────┐
│ ← Back          [compact title when scrolled]    actions  │
├─ Main Content (flex-1, scrollable) ─┬─ Sidebar (220px) ──┤
│ Hero Card                           │ Contents (TOC)      │
│ Summary (future M4)                 │ Notes               │
│ Reading Progress                    │ Tags                │
│ Article / Transcript                │ Links               │
│                                     │                     │
│                            [Chat FAB ●]                   │
└─────────────────────────────────────┴─────────────────────┘
```

### Narrow View (container < 768px)

```
┌─ Action Bar ──────────────────────┐
│ ← Back                    actions  │
├─ Main Content (scrollable) ───────┤
│ Hero Card (stacked)               │
│ Tags (inline)                     │
│ Notes (inline)                    │
│ Summary (future M4)               │
│ Reading Progress                  │
│ Article / Transcript              │
│                         [Chat FAB ●]                      │
└───────────────────────────────────┘
```

## Sidebar Panel

- **No background, no border** — just spacing for separation
- **Sticky** — `position: sticky; top: 0; align-self: flex-start`
- **Hidden scrollbar** — `scrollbar-width: none` + `::-webkit-scrollbar { display: none }`, scroll via mouse wheel or touch
- **Max height** — `max-height: 100vh; overflow-y: auto`
- **Width** — 220px fixed

### Sections

1. **Contents (TOC)** — auto-generated from h2/h3 headings in the markdown. Active item highlighted in sky-400 as user scrolls. Clickable to scroll to that section.

2. **Notes** — shows existing note text in a subtle card (`bg-muted/30 rounded-lg`). Click opens the existing modal editor. If no note, shows "Add a note..." in muted text.

3. **Tags** — plain blue text hashtags (`text-sky-400`), no pill backgrounds. Clickable (future: filter by tag).

4. **Links** — external links extracted from the article content. Displayed as sky-400 text, truncated with ellipsis. Open in new tab on click.

### Narrow Collapse

When container width < 768px:
- Sidebar hides
- Tags render inline below the hero card
- Notes render inline below tags
- TOC and Links sections are omitted (not essential at narrow widths)

## Chat FAB

Replace the dedicated `ChatPanel` component with a floating action button:

- **Position** — fixed bottom-right of the detail page, `bottom: 16px; right: 16px`
- **Size** — 44px circle
- **Style** — `bg-muted` with `shadow`, MessageCircle icon
- **Hover** — slightly lighter background
- **Click** — opens a floating chat overlay (340px wide, max-height 420px, rounded-xl, shadow)
- **Active state** — FAB background changes to sky-400 when chat is open

### Chat Overlay

- Header with "Chat" title + close button
- Placeholder body: "Ask questions about this article" + "Coming in a future update"
- Input field at bottom
- Positioned above the FAB, bottom-right

## TOC Generation

Parse the rendered markdown for h2/h3 elements:
- Extract heading text and assign IDs
- Build a list of `{ id, text, level }` entries
- In the sidebar, render as clickable links
- Use IntersectionObserver to track which heading is in view and highlight the corresponding TOC item

## Files Changed

| File | Change |
|------|--------|
| `components/detail/DetailPage.tsx` | Remove ChatPanel, add sidebar layout, chat FAB, TOC generation |
| `components/detail/DetailSidebar.tsx` | **New** — sidebar component with TOC, notes, tags, links |
| `components/detail/ChatFab.tsx` | **New** — floating chat button + overlay |
| `components/detail/ChatPanel.tsx` | **Delete** — replaced by ChatFab |
| `components/detail/MarkdownView.tsx` | Add heading IDs for TOC linking |

## Out of Scope

- Summary block (Milestone 4)
- AI-generated chapters for transcripts
- Tag click filtering
- Actual chat functionality
