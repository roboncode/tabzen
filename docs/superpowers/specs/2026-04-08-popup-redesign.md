# Popup Redesign

## Problem

The current popup has several UX issues:
- Navigation buttons (sidebar/fullscreen) are tiny icon buttons in the top-right corner — tedious to click
- "Save All Tabs" is the primary button but "Save This Tab" is the more common intent
- Keyboard shortcuts section takes up space and adds clutter
- Getting to the detail page after saving requires 4+ clicks (save → open fullscreen/sidebar → find tab → click)

## Design

### Layout Structure

```
┌──────────────────────────────┐
│ Tab Zen          Save all (4)│  ← header
│                              │
│ ┌──────────────────────────┐ │
│ │  [thumbnail]             │ │
│ │                          │ │
│ │  favicon  Title          │ │  ← unified clickable card
│ │  domain                  │ │
│ │  description             │ │
│ │       Save Tab           │ │
│ └──────────────────────────┘ │
│                              │
│ Browse your collection       │  ← label
│ ┌────────────┐┌────────┐    │
│ │ ▪ ┌──┐┌──┐ ││ ┌────┐ │    │
│ │ ▪ │  ││  │ ││ │    │ │    │  ← visual nav
│ │ ▪ └──┘└──┘ ││ ├────┤ │    │
│ │   ┌──┐┌──┐ ││ │    │ │    │
│ │   │  ││  │ ││ └────┘ │    │
│ │   └──┘└──┘ ││        │    │
│ └────────────┘└────────┘    │
└──────────────────────────────┘
```

### Header

- "Tab Zen" title on the left
- "Save all (N)" as a subtle text link on the right — not a button, just text with hover state
- No icon buttons, no shortcuts

### Unified Tab Card

The tab preview and save action merge into one clickable card component.

**Unsaved state (default):**
- Thumbnail is desaturated (grayscale) and dimmed
- Title, metadata, description are muted colors
- "Save Tab" text at the bottom of the card
- On hover: colors peek through (grayscale reduces), card lifts slightly with shadow, "Save Tab" text brightens
- Clicking saves the tab

**Saved state:**
- Thumbnail shows full color (animated transition from grayscale)
- All text at normal color values
- "Save Tab" becomes "View Details →"
- Clicking navigates to the detail page (`detail.html?tabId={id}`)

**Already-saved detection:**
- When popup opens, check if the current tab URL already exists in the database
- If already saved, go straight to the saved/colored state with "View Details →"
- Popup becomes useful for both saving new tabs and returning to existing tab details

### Visual Navigation

Two spatial wireframe buttons representing the fullscreen and sidebar views:

**Fullscreen button:**
- Takes `flex: 1` (wider)
- Contains a sidebar slab on the left + 2x2 grid of rounded blocks — suggesting the actual fullscreen layout
- All elements are monotone gray (`bg-[#2e2e34]`) by default

**Sidebar button:**
- Fixed narrow width (~80px)
- Contains 3 stacked rounded blocks — suggesting the single-column sidebar layout
- Same monotone gray default

**Hover behavior:**
- Container background shifts to a dark blue
- Inner blocks shift to `sky-400` for a vibrant pop
- No labels — the shapes communicate the layout
- No labels needed; shapes are self-explanatory

**Label:**
- "Browse your collection" sits above the nav buttons in muted text, providing context

### Removed Elements

- Keyboard shortcuts section — removed entirely
- Icon buttons in header (Maximize2, PanelRight) — replaced by visual nav
- Separate "Save All Tabs" button — moved to header as text link
- Separate "Save This Tab" button — merged into the card

### States to Handle

1. **Normal unsaved tab** — greyed card, click to save
2. **Already saved tab** — colored card, "View Details →"
3. **Blocked domain** — keep existing blocked domain notice (ShieldBan icon + message)
4. **Sync error** — keep existing sync error banner above the card
5. **After save-all** — show capture result message (X saved, Y skipped)

### Interactions

| Action | Result |
|--------|--------|
| Click card (unsaved) | Saves tab, transitions to saved state |
| Click card (saved) | Opens detail page |
| Hover card (unsaved) | Colors peek through, lift effect |
| Click "Save all (N)" | Saves all tabs, shows result |
| Click fullscreen nav | Opens `tabs.html` in new tab |
| Hover fullscreen nav | Blocks turn `sky-400` |
| Click sidebar nav | Opens Chrome side panel |
| Hover sidebar nav | Blocks turn `sky-400` |

### Design System Compliance

- No borders — shading only for separation
- Minimum text-sm (card body text)
- Rounded corners: `rounded-xl` on card, `rounded-lg` on nav blocks
- Colors from existing CSS variables (`--background`, `--foreground`, `--muted`, `--muted-foreground`)
- Nav hover blue: `sky-400` for inner blocks

## File

- `apps/extension/entrypoints/popup/App.tsx` — primary file to modify

## Mockups

Visual mockups from brainstorming session saved in `.superpowers/brainstorm/` directory.
