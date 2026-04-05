# Helpdesk Design System

A living reference for UI decisions, patterns, and conventions. All new components and pages should follow these principles.

---

## Core Principles

1. **No lines** — Use background shading and spacing for separation, not borders. No `border-b`, `border-t`, `border-l`, `border-r` for visual separation between sections.
2. **Shading over borders** — Distinguish areas with subtle background color differences (`bg-muted/30`, `bg-muted/40`, `bg-muted/50`).
3. **Readable font sizes** — Minimum `text-sm` (15px) for content. `text-xs` (13px) only for avatar initials inside circles or truly tertiary metadata. Global baseline raised in `app.css`.
4. **Breathing room** — Generous spacing between elements. Don't cram information.
5. **Consistent patterns** — Same approach everywhere. If the sidebar uses shading, the ticket detail uses shading, the dashboard uses shading.

---

## Color System

### Dark Mode Palette (Primary)
Inspired by VitePress docs — warm, neutral dark grays:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#1b1b1f` | Page background |
| `--foreground` | `#dfdfd6` | Primary text |
| `--card` | `#202127` | Card/elevated surfaces |
| `--muted` | `#2e2e32` | Muted backgrounds, secondary surfaces |
| `--muted-foreground` | `#98989f` | Secondary text |
| `--border` | `#3c3f44` | Borders (used sparingly — prefer shading) |
| `--sidebar` | `#161618` | Sidebar background (darker than main) |
| `--ring` | `#a8b1ff` | Focus rings (indigo accent) |
| `--primary` | `#dfdfd6` | Primary actions/text in dark mode |

### Light Mode Palette
Clean whites with subtle grays:

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | white | Page background |
| `--foreground` | dark slate | Primary text |
| `--ring` | `#3451b2` | Focus rings (indigo accent) |

### Avatar Colors (Activity Feed)
| Sender | Avatar Style |
|--------|-------------|
| Agent | `bg-blue-600 text-white` with initials (e.g., "RT") |
| Customer | `bg-muted text-muted-foreground` with User icon |
| AI | `bg-purple-600 text-white` with Bot icon |

### Status Colors
Centralized in `src/lib/ticket-colors.ts`. Used for status dots, chart colors, and status pills.

### Priority Colors
| Priority | Color |
|----------|-------|
| Urgent | `text-red-500` |
| High | `text-orange-500` |
| Medium | `text-muted-foreground` |
| Low | `text-muted-foreground/60` |

---

## Layout Patterns

### Page Structure
Every authenticated page follows:
```
┌─ Sidebar (w-72, bg-sidebar) ─┬─ Main Content ─────────────┐
│                               │  Header (bg-muted/30, py-3)│
│  Navigation                   │  Content (overflow-y-auto)  │
│                               │                             │
│  Footer (user + theme)        │                             │
└───────────────────────────────┴─────────────────────────────┘
```

### Page Headers
```tsx
<div className="surface-header">
  <h1 className="text-xl font-semibold">{title}</h1>
  <p className="text-sm text-muted-foreground">{subtitle}</p>
</div>
```
- Use `surface-header` CSS class (defined in `app.css`)
- Background shading, NOT border-bottom
- `py-3` (tight, not wasteful)
- `text-xl` for all page titles (consistent)

### Content Areas
- Full width within the main area (no `max-w-*xl` centering on settings pages)
- Dashboard uses `max-w-6xl mx-auto` (exception — dashboard has charts that benefit from centering)
- Ticket detail conversation uses `max-w-3xl mx-auto` (readability for long text)

### Two-Column Layout (Ticket Detail)
```
┌─ Left (flex-1) ──────────────┬─ Right (w-96) ─────────────┐
│  Activity Feed (max-w-3xl)   │  Detail Sidebar             │
│  Reply Composer (max-w-3xl)  │  (no background — same as   │
│                              │   content area)              │
└──────────────────────────────┴─────────────────────────────┘
```
- No border between columns — sidebar has no special background
- Header uses `bg-muted/30`

---

## Component Patterns

### Cards
```tsx
<Card className="p-5 bg-muted/30">
```
- No border (removed globally from Card component)
- No shadow
- `bg-muted/30` for subtle elevation
- `rounded-xl` (from Card component)

### Buttons
- Primary: default Shadcn — `bg-primary text-primary-foreground`
- Outline: `bg-muted/50` with hover (NO border — redesigned from Shadcn default)
- Ghost: `hover:bg-muted` for interactive elements
- No destructive red on delete buttons — use standard styling
- All confirmations use `ConfirmDialog` (not browser `confirm()`)

### Badges
- Squarish `rounded` (4px radius), NOT `rounded-full` pill shape
- No border — `border-transparent` base
- Outline variant uses `bg-muted/50` instead of `border-border`

### Form Inputs (Borderless Style)
```tsx
<Input className="input-borderless" />
<SelectTrigger className="select-borderless">
```
- Use `input-borderless` or `select-borderless` CSS classes
- Classes use `!important` to override component base borders
- Subtle background tint (`bg-muted/40`)
- Slightly darker on focus (`bg-muted/60`)
- No focus ring (clean look)

### Search Input
```tsx
<SearchInput value={q} onChange={setQ} placeholder="Search..." />
```
- Use the `SearchInput` component from `@/components/custom/search-input`
- Includes search icon on left, clear (X) button when text is entered
- Borderless with `bg-muted/40`, focus darkens
- Consistent across all pages that have search

### Color Pickers
- Native `<input type="color">` styled globally in `app.css`
- No browser chrome border, borderless swatch with 4px radius

### Date Inputs
- Dark mode calendar icon fixed via CSS `filter: invert(1)`

### Theme Toggle
- No border — just `bg-muted` track with hover state

### Sidebar Detail Dropdowns
```tsx
<SelectTrigger className="border-0 bg-transparent shadow-none px-3 hover:bg-muted/50">
```
- Transparent by default
- Hover reveals subtle background
- `px-3` for adequate left padding

### Count Badges
```tsx
<span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground px-1.5">
  {count}
</span>
```
- `bg-muted` with `text-muted-foreground` (subtle, readable)
- NOT `bg-primary` with tiny text (hard to read)

### Section Headers (Sidebar Detail)
```tsx
<p className="text-sm font-medium uppercase tracking-wider text-muted-foreground bg-muted/50 rounded px-3 py-1.5 mb-2">
  {label}
</p>
```
- Muted background bar with rounded corners
- NOT border lines
- Optional — omit `label` prop to skip the header entirely

### Toast Notifications
Use `sonner` for all CRUD feedback:
- `toast.success("Item created")`
- `toast.error("Failed to save")`
- Applied on every mutation (create, update, delete, star, watch, etc.)

---

## Activity Feed / Messages

### Message Layout (Card Style)
```
[Avatar] Name  Badge  Time
         ┌─────────────────────────┐
         │ Message content in card │
         └─────────────────────────┘
```
- Avatar + name + time on header line ABOVE the card
- Content in rounded card (`bg-muted/40` for agents, `bg-muted/30` for customers)
- Card indented `ml-10` past the avatar
- Internal notes: `bg-yellow-500/[0.07]` with "Internal" badge pill
- `space-y-5` between messages

### System Events
```tsx
<div className="flex items-center gap-2 py-1.5 ml-11">
  <Icon className="h-3 w-3 text-muted-foreground" />
  <span className="text-xs text-muted-foreground">Description · time</span>
</div>
```
- Compact, muted, aligned with message content column

### Activity Tabs
```tsx
<button className="px-3 py-1 min-w-[64px] text-sm font-medium rounded-full">
```
- Rounded pill buttons (NOT underline tabs with borders)
- Active: `bg-primary text-primary-foreground`
- Inactive: `text-muted-foreground hover:bg-muted`

---

## Table / List Patterns

### Ticket Table
- Header row: `bg-muted/30 rounded-t-lg` (no border)
- Row dividers: none — spacing and hover highlight only
- Row hover: `hover:bg-muted/30 rounded-lg`
- Urgent rows: `bg-red-500/5` subtle tint
- Status: colored dot + text label (not loud uppercase pills)
- Priority: colored text only (no arrow symbols)
- Time: compact format ("5m", "2h", "1d", "3w")

### Filter Bar
- All controls borderless with `bg-muted/40`
- Horizontal scroll on overflow (`overflow-x-auto scrollbar-hide`)
- Group By dropdown with Layers icon

### Grouped Lists
- Group headers: `bg-muted/40 hover:bg-muted/60` with chevron toggle
- `space-y-4` between groups
- Collapsible with local state

---

## Sidebar Navigation

### Structure
```
Dashboard
Starred (if any)
Queues (global: Assigned to Me, Unassigned, All Tickets)
Products (expandable with per-product queues)
Knowledge Base
AI
Settings
Help & Support + User Menu + Theme Toggle
```

### Product Items
- Colored letter icon (cycling palette)
- Expand/collapse with chevron
- Nested queues indented `ml-5 pl-2 pt-1`

### Starred Items
- Show human-readable ticket ID (`HELP-5`) in monospace
- Truncated subject after ID
- Max 5 visible

### Separators
- Use `border-background` (matches content area color) for header/footer separators
- No `border-sidebar-border` lines

---

## Responsive Patterns

### Container Queries
Use `@container` queries for components that need to adapt to available space (not viewport):
```tsx
<div className="@container">
  <div className="hidden @[600px]:flex">Row layout</div>
  <div className="@[600px]:hidden">Card layout</div>
</div>
```

### People Lists (Participants, Watchers)
- Show max 3, then "+N more" button to expand permanently
- Avatar + name in vertical list (not just avatar circles)

---

## Typography Hierarchy

| Element | Class | Size |
|---------|-------|------|
| Page title | `text-xl font-semibold` | 20px |
| Section header | `text-base font-medium` | 16px |
| Body text | `text-sm` | 15px (raised baseline) |
| Labels/metadata | `text-sm text-muted-foreground` | 15px |
| Avatar initials | `text-xs` | 13px |
| Compact metadata | `text-xs` | 13px (minimum) |
| Never use | `text-[10px]`, `text-[8px]` | Too small |

---

## CSS Utility Classes Reference

All custom classes are defined in `packages/client/admin/src/app.css` under `@layer components`. Use these instead of repeating inline Tailwind patterns.

### Surfaces
| Class | Purpose | Styles |
|-------|---------|--------|
| `surface-raised` | Cards, elevated containers | `bg-muted/30 rounded-xl` |
| `surface-inset` | Nested containers, form boxes | `bg-muted/40 rounded-lg` |
| `surface-header` | Page headers | `bg-muted/30 px-6 py-3` |

### Form Controls
| Class | Purpose | Styles |
|-------|---------|--------|
| `input-borderless` | Search inputs, text fields | `border-0 bg-muted/40 shadow-none` + focus states |
| `select-borderless` | Filter dropdowns | `border-0 bg-muted/40 shadow-none` |
| `select-inline` | Sidebar detail dropdowns | `!border-transparent bg-transparent px-3 hover:bg-muted/50` |

### Section Headers
| Class | Purpose | Styles |
|-------|---------|--------|
| `section-header` | Sidebar detail panel section titles | `text-sm uppercase tracking-wider bg-muted/50 rounded px-3 py-1.5` |

### Messages (Activity Feed)
| Class | Purpose | Styles |
|-------|---------|--------|
| `message-card` | Base message card | `ml-10 rounded-lg px-4 py-3 text-sm leading-relaxed` |
| `message-card-agent` | Agent message | message-card + `bg-muted/50` |
| `message-card-customer` | Customer message | message-card + `bg-muted/30` |
| `message-card-internal` | Internal note | message-card + `bg-yellow-500/7%` |

### Tabs
| Class | Purpose | Styles |
|-------|---------|--------|
| `pill-tab` | Base pill tab | `px-3 py-1 min-w-16 text-sm rounded-full` |
| `pill-tab-active` | Active tab | pill-tab + `bg-primary text-primary-foreground` |
| `pill-tab-inactive` | Inactive tab | pill-tab + `text-muted-foreground hover:bg-muted` |

### Table
| Class | Purpose | Styles |
|-------|---------|--------|
| `table-header` | Table header row | `bg-muted/30 rounded-t-lg` |
| `table-row` | Table body row | `hover:bg-muted/30 rounded-lg` |
| `table-row-urgent` | Urgent/escalated row | table-row + `bg-red-500/5` |

### Badges
| Class | Purpose | Styles |
|-------|---------|--------|
| `count-badge` | Sidebar count indicators | `rounded-full bg-muted text-xs text-muted-foreground` |

### Avatars
| Class | Purpose | Styles |
|-------|---------|--------|
| `avatar-agent` | Agent avatar | `bg-blue-600 text-white` |
| `avatar-customer` | Customer avatar | `bg-muted text-muted-foreground` |
| `avatar-ai` | AI avatar | `bg-purple-600 text-white` |

### Charts
| Class | Purpose | Styles |
|-------|---------|--------|
| `chart-tooltip` | Recharts tooltip container | `bg-popover text-popover-foreground rounded-lg shadow-md` |

### Important: Tailwind v4 Limitation
Custom `@apply` classes **cannot reference other custom classes** in the same `@layer`. If you need to compose, inline the base styles instead of referencing the parent class.

---

## What NOT to Do

- No `border-b`, `border-t` for section separation — use `surface-*` classes or spacing
- No `text-[10px]` or `text-[8px]` — minimum readable size is `text-xs` (13px)
- No `max-w-2xl` or `max-w-3xl` centering on settings pages — use full width
- No browser `confirm()` — always use `ConfirmDialog`
- No destructive/red styling on delete buttons — use `variant="default"`
- No raw UUIDs in UI — use human-readable IDs everywhere
- No `useMemo` or `React.memo` — React handles optimizations
- No duplicate color definitions — use `ticket-colors.ts`
- No `@apply` with custom class references in Tailwind v4 — inline the styles
