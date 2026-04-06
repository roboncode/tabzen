# Milestone 2: Tab Detail Page — Design Spec

**Date:** 2026-04-06
**Status:** Draft

## Overview

A dedicated detail page for viewing and interacting with a captured tab's content. Opens as a new chrome-extension tab. Layout A with persistent chat panel: header with thumbnail/title on the left, tabbed content sections below (Transcript | Summary | Content), and a chat panel on the right.

For this milestone, only the transcript tab is functional. Summary, Content, and Chat are shells with placeholder states. Future milestones fill them in without layout changes.

## Goals

- New entrypoint: `entrypoints/detail/` opening as a chrome-extension tab
- URL: `detail.html?tabId={id}`
- Header: thumbnail, title, channel/source, metadata, action buttons
- Tabbed content area: Transcript (functional), Summary (placeholder), Content (placeholder)
- Chat panel: persistent right sidebar (shell only, non-functional)
- Expand icon on tab cards (hover) opens the detail page in a new tab
- Card click behavior unchanged (opens source URL)
- Back button closes the tab

## Non-Goals (Future Milestones)

- Functional chat (Milestone 7)
- AI summaries tab content (Milestone 4)
- Web page content tab (Milestone 3)
- AI content generation (Milestone 6)

## Layout

### Two-Column Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                    ⭐ Star  ↗ Open  │
├─────────────────────────────────────────┬───────────────────┤
│ [Thumbnail] Title                       │ Chat              │
│             Channel · Views · Date      │                   │
│             Description...              │ "Ask about this   │
├─────────────────────────────────────────│  content"         │
│ [Transcript] [Summary] [Content]        │                   │
├─────────────────────────────────────────│                   │
│                                         │                   │
│ 0:00  Welcome to today's video...       │                   │
│ 0:15  The first thing you need...       │  (Coming in a     │
│ 1:02  Now let's look at...              │   future update)  │
│                                         │                   │
│                                         ├───────────────────┤
│                                         │ [Ask about...]  ↑ │
└─────────────────────────────────────────┴───────────────────┘
```

**Left side (~65-70% width):**
- Top bar: back button, star, open source URL
- Hero: thumbnail (16:9, ~180px wide) + title, channel avatar/name, view count, date, description (2-line clamp)
- Tab bar: Transcript | Summary | Content (underline active tab)
- Content area: scrollable, fills remaining height

**Right side (~30-35% width, ~340px):**
- Chat header: "Chat" title, subtitle
- Message area: scrollable (placeholder for now)
- Input bar: text input + send button (disabled for now)
- Collapsible: user can hide chat panel to give full width to content

### Responsive Behavior

- On narrow screens (side panel), chat panel hides and becomes a toggleable overlay or tab
- The detail page is primarily designed for the full-page tab view where width is available

## Entrypoint Structure

```
entrypoints/detail/
├── index.html    # HTML shell
├── main.tsx      # SolidJS mount
└── App.tsx       # Detail page component
```

Same pattern as existing `entrypoints/tabs/` and `entrypoints/sidepanel/`.

## Component Structure

```
components/
├── detail/
│   ├── DetailPage.tsx        # Main layout (two-column, header, tabs)
│   ├── DetailHeader.tsx      # Thumbnail, title, channel, metadata, actions
│   ├── DetailTabs.tsx        # Tab bar + content switcher
│   ├── TranscriptView.tsx    # Timestamped transcript display
│   ├── ChatPanel.tsx         # Right sidebar chat (shell)
│   └── PlaceholderTab.tsx    # "Coming soon" state for inactive tabs
```

## Transcript View

Displays transcript segments from the tab's local data. Features:

- Timestamped segments, each line showing `[M:SS]` + text
- Timestamps are clickable links that open YouTube at that point
- Segment count shown at top
- Copy button: copies full transcript as `[timestamp] text` lines
- Scrollable, fills available height
- Hover highlight on segments

If no transcript is available (non-YouTube tab, or capture before M1), shows an appropriate empty state.

## Chat Panel (Shell)

Right sidebar, ~340px wide. For this milestone:

- Header: "Chat" title
- Body: centered message "Chat will be available in a future update"
- Input: visible but disabled, placeholder text "Ask about this content..."
- Toggle button to collapse/expand the panel

## Expand Icon on Tab Cards

Add a small expand icon to tab cards that appears on hover. Clicking it opens the detail page.

- Icon: Lucide `Maximize2` or `ExternalLink` (small, ~14px)
- Position: top-right of thumbnail overlay, alongside existing action buttons
- Click handler: `chrome.tabs.create({ url: detail page URL })`
- Only appears on hover, consistent with existing overlay button pattern

The icon appears on ALL tab cards (not just YouTube). The detail page works for any tab — YouTube tabs show the transcript tab, other tabs show the placeholder.

## Data Flow

1. User clicks expand icon on a tab card
2. Extension opens `detail.html?tabId={id}` in a new browser tab
3. Detail page reads `tabId` from URL params
4. Loads tab data from IndexedDB via `getTab(tabId)`
5. Renders header from tab metadata
6. Checks if tab has transcript data (`(tab as any).transcript` or `tab.contentType === "transcript"`)
7. If transcript exists: renders TranscriptView with segments
8. If no transcript but is YouTube URL: shows "Transcript not yet captured" with option to fetch
9. If not YouTube: shows transcript tab as inactive

### Fetching Transcript On-Demand

If the detail page is open for a YouTube tab with no transcript, a "Fetch Transcript" button triggers `sendMessage({ type: "GET_TRANSCRIPT", tabId })`. On success, the view updates with the segments.

## Back Button

Closes the current browser tab: `window.close()`. If the tab was opened by the extension, this works. If the user navigated to it directly, `window.close()` may not work — in that case, fall back to navigating to the extension's full-page view.

## Design Language

Follow the existing Tab Zen design system:

- Background: `#1b1b1f` (--background)
- Cards/panels: `#202127` (--card)
- Muted surfaces: `#2e2e32` (--muted)
- Text: `#dfdfd6` (--foreground)
- Secondary text: `#98989f` (--muted-foreground)
- Accent: `#a8b1ff` (--ring) for active tab underline, chat accents
- Timestamps: `#7dd3fc` (sky-400) — consistent with existing tag styling
- Borders: `#3c3f44` (--border)
- Font: system font stack (existing)
- Lucide icons throughout
- Rounded corners: `rounded-lg` / `rounded-xl` consistent with cards

## Testing

### Unit Tests
- YouTube URL detection (already exists from M1)
- Timestamp formatting
- Video ID extraction (already exists from M1)

### Manual Testing
- Open detail page from card expand icon
- Verify header renders correctly for YouTube tabs
- Verify transcript displays with clickable timestamps
- Verify timestamp links open YouTube at correct time
- Verify copy button works
- Verify back button closes tab
- Verify Summary/Content tabs show placeholder
- Verify chat panel shows placeholder
- Verify non-YouTube tabs show appropriate state
- Test on narrow viewport (side panel behavior)
