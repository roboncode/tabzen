# Tab Zen -- Design Spec

**Date:** 2026-04-05
**Status:** Approved

## Overview

Tab Zen is a Chrome extension that serves as a personal tab library with AI-powered organization. It captures open browser tabs, groups them intelligently using AI, and provides a rich interface for browsing, searching, and managing a growing collection of saved tabs across multiple browsers and profiles.

This is a personal/free tool, not a commercial product. The architecture prioritizes simplicity and developer ergonomics.

## Core Concept

Tab Zen is a **persistent reference library**, not a read-later queue. Tabs are saved, organized, annotated, and kept long-term. Users build up a living collection that grows over time, with AI helping to organize and search it.

## Tech Stack

- **Extension framework:** WXT
- **UI framework:** SolidJS
- **Styling:** Tailwind CSS
- **Local storage:** IndexedDB (tab collection) + chrome.storage.local (settings)
- **AI:** OpenRouter API, default model GPT-4o-mini, user-configurable model picker
- **Sync backend:** Cloudflare Workers + D1 + KV (lives in `sync-service/` folder within the project)
- **Auth:** Token-based (no user accounts)
- **Build:** WXT for extension, Wrangler for sync service
- **Testing:** Local SQLite database for dev mode, D1 for production

## Data Model

### Tab

| Field             | Type      | Description                                      |
|-------------------|-----------|--------------------------------------------------|
| `id`              | string    | Unique identifier                                |
| `url`             | string    | Page URL                                         |
| `title`           | string    | Page title                                       |
| `favicon`         | string    | Favicon URL                                      |
| `ogTitle`         | string?   | Open Graph title                                 |
| `ogDescription`   | string?   | Open Graph description                           |
| `ogImage`         | string?   | Open Graph image URL                             |
| `metaDescription` | string?   | Fallback meta description                        |
| `notes`           | string?   | User-added notes (searchable)                    |
| `viewCount`       | number    | Times reopened from Tab Zen                      |
| `lastViewedAt`    | string?   | ISO timestamp of last reopen                     |
| `capturedAt`      | string    | ISO timestamp when saved                         |
| `sourceLabel`     | string    | Browser/profile identifier (e.g., "Chrome - Work") |
| `archived`        | boolean   | Whether tab is archived                          |
| `groupId`         | string    | Which group this tab belongs to                  |

### Group

| Field       | Type    | Description                                  |
|-------------|---------|----------------------------------------------|
| `id`        | string  | Unique identifier                            |
| `name`      | string  | Display name (AI-generated or user-set)      |
| `captureId` | string  | Which capture session created this group     |
| `position`  | number  | Sort order for drag-and-drop reordering      |
| `archived`  | boolean | Whether group is archived                    |

### Capture

| Field        | Type   | Description                         |
|--------------|--------|-------------------------------------|
| `id`         | string | Unique identifier                   |
| `capturedAt` | string | ISO timestamp                       |
| `sourceLabel`| string | Browser/profile                     |
| `tabCount`   | number | Number of tabs in this capture      |

The layered structure supports two views: **date view** (Captures -> Groups -> Tabs) and **groups view** (Groups -> Tabs independent of capture).

## Extension Architecture

### Entry Points

**Popup** (`entrypoints/popup/`)
- Minimal quick-action UI
- "Capture All Tabs (N new)" button with live badge showing uncaptured tab count
- "Save This Tab" button
- Quick search bar with inline results
- Links to open side panel or full page

**Side Panel** (`entrypoints/sidepanel/`)
- Primary day-to-day interface
- Browse collection, search, manage groups, triage tabs
- Card view and row view toggle
- Filter pills: All, By Date, Archived, Duplicates
- Collapsible groups with tab count and capture date
- Full drag-and-drop organization

**Full Page** (`entrypoints/tabs/`)
- Same functionality and shared components as side panel
- More screen real estate for bulk organization and browsing large collections
- Opens as a chrome-extension tab

**Background Service Worker** (`entrypoints/background.ts`)
- Tab capture orchestration
- OG/meta metadata fetching
- AI requests to OpenRouter (grouping and search)
- Sync with Cloudflare backend
- Duplicate detection
- Maintains uncaptured tab count badge on extension icon
- Listens to `tabs.onCreated`, `tabs.onRemoved`, `tabs.onUpdated` to keep badge current

**Content Script** (`entrypoints/content.ts`)
- Extracts Open Graph and meta description data from pages

### Internal Modules

| Module              | Responsibility                                       |
|---------------------|------------------------------------------------------|
| `lib/storage.ts`    | Abstraction over IndexedDB and chrome.storage.local  |
| `lib/ai.ts`         | OpenRouter integration for grouping and search       |
| `lib/sync.ts`       | Cloudflare sync client                               |
| `lib/metadata.ts`   | OG/meta extraction logic                             |
| `lib/duplicates.ts` | URL matching + AI near-duplicate detection            |
| `lib/export.ts`     | JSON and HTML bookmarks export/import                |

### Shared UI

Side panel and full page share the same SolidJS components, rendered at different sizes. The popup has its own lightweight UI.

## UI Design

### Theme
Dark theme. Slate color palette (`#0f172a` background, `#1e293b` cards, `#f8fafc` text).

### Side Panel / Full Page Layout
- **Top bar:** "Tab Zen" branding, Cards/Rows view toggle, expand-to-full-page button (side panel only)
- **Search bar:** Natural language search across titles, URLs, OG descriptions, and notes
- **Filter pills:** All, By Date, Archived, Duplicates
- **Groups:** Collapsible sections with group name, tab count badge, capture date
- **Card view:** Social media card style -- OG image when available, title, description, view count, source label, notes icon. Graceful fallback (no image) when OG data is unavailable.
- **Row view:** Compact list -- favicon, title, domain. Dense, scannable.

### Popup Layout
- Tab count badge on "Capture All Tabs" button showing uncaptured count
- Changes to "All tabs captured" when count is 0
- "Save This Tab" button
- Search bar
- Links to side panel / full page

### Extension Icon Badge
Shows uncaptured tab count in real time. Updates via background worker listening to tab events.

## Key Flows

### Capture Flow
1. User clicks "Capture All Tabs" (popup, keyboard shortcut, or context menu)
2. Background worker collects all open tab URLs, titles, favicons
3. Content script fetches OG/meta data from each tab
4. Duplicate check runs against existing collection (URL match, ignoring UTM params)
5. New tabs sent to OpenRouter for AI grouping (titles + descriptions -> suggested group names)
6. User sees a preview of proposed groups with ability to adjust before confirming
7. Capture saved with timestamp; groups and tabs written to IndexedDB
8. If sync enabled, changes pushed to Cloudflare
9. Extension badge updates to reflect new uncaptured count

### Search Flow
1. User types in search bar (side panel, full page, or popup)
2. Local search runs against titles, URLs, OG descriptions, and notes
3. For AI-powered natural language search, query sent to OpenRouter
4. Results shown with group context and search highlights

### Sync Flow
1. On any local change, a sync event queues in the background worker
2. Debounced push to Cloudflare (batched, not per-change)
3. On extension startup, pull latest from Cloudflare and merge with local
4. Conflict resolution: last-write-wins per tab, with source label preserved

### Duplicate Detection
- **Definitive:** URL match (ignoring query params like UTM tracking, respecting fragments) blocks duplicates on capture
- **AI-powered:** A "Possible Duplicates" section surfaces near-matches (same content on different URLs, etc.) for user review. User can merge or dismiss.

## Tab Features

- **Notes:** User can add freeform text notes to any tab. Notes are searchable.
- **View counter:** Tracks how many times a tab has been reopened from Tab Zen.
- **Last viewed:** Timestamp of most recent reopen.
- **Source label:** Which browser/profile the tab was captured from.
- **Archived status:** Tabs (and groups) can be archived to declutter the main view. Archived items remain searchable and recoverable.

## Group Management

- AI creates initial groups on capture
- User can rename, merge, create, and delete groups
- Full drag-and-drop: move tabs between groups, reorder groups
- Groups are collapsible
- Groups can be archived

## Cross-Browser Sync

### Unified Collection with Source Tagging
All browsers and profiles sync into one library. Each tab is tagged with its source (browser/profile). Users can filter by source but the default view shows everything unified.

### Token-Based Auth
- First browser: "Enable Sync" in settings generates a sync token
- Additional browsers: paste the same sync token to connect
- Token viewable in settings on any connected browser
- Token can be regenerated (requires re-linking other browsers)
- No email, no password, no OAuth

## Sync Service (Cloudflare)

Lives in `sync-service/` within the project root.

### Stack
- **Cloudflare Workers:** REST API
- **D1:** Tab collection storage (tabs, groups, captures)
- **KV:** Sync tokens and session metadata

### API Endpoints

| Endpoint            | Method | Description                                    |
|---------------------|--------|------------------------------------------------|
| `/sync/init`        | POST   | Generate sync token, create D1 tables          |
| `/sync/push`        | POST   | Receive changed data from extension            |
| `/sync/pull`        | POST   | Return data newer than a given timestamp       |
| `/sync/verify`      | POST   | Verify a sync token is valid                   |

All requests include the sync token in an `Authorization` header. Worker validates against KV before processing.

### Dev vs Production
- **Dev mode:** Local SQLite database for testing
- **Production:** Cloudflare D1

## OpenRouter AI Integration

### Configuration
- User enters their own OpenRouter API key in extension settings
- Model picker with list of available lightweight models
- Default: GPT-4o-mini

## Settings Page

- **Source label:** User sets a name for this browser/profile (e.g., "Chrome - Work"). Used to tag all captures from this instance.
- **OpenRouter API key:** Text input for the user's API key
- **AI model:** Dropdown to select from available lightweight models (default GPT-4o-mini)
- **Sync:** Enable/disable sync, view/copy sync token, regenerate token
- **Export:** Button to export as JSON or HTML bookmarks
- **Import:** Button to import a Tab Zen JSON file
- **Keyboard shortcuts:** Links to Chrome's built-in shortcut configuration

### AI Tasks
1. **Tab grouping on capture:** Send tab titles, URLs, and descriptions. AI returns suggested group names and assignments.
2. **Natural language search:** User queries like "that video about React hooks" matched against collection.
3. **Near-duplicate detection:** AI identifies tabs that may be duplicates despite different URLs.

## Export/Import

### JSON Export
- Full-fidelity export of all data: tabs, groups, captures, notes, view counts, source labels
- File named `tab-zen-export-YYYY-MM-DD.json`
- Lossless round-trip with Tab Zen import

### HTML Bookmarks Export
- Standard Netscape bookmark format (universal browser import)
- Groups become bookmark folders
- Tab title and URL preserved; metadata not included (format limitation)

### Import
- Accepts Tab Zen JSON files
- Duplicate check during import (skips existing tabs)
- Preview of what will be imported (N new tabs, N duplicates skipped)

### Location
Export/Import controls live in the Settings page.

## Keyboard Shortcuts & Quick Actions

- **Toggle side panel:** `Ctrl+Shift+Z` (configurable)
- **Quick capture all tabs:** `Ctrl+Shift+S` (configurable)
- **Context menu:** Right-click any tab or link -> "Save to Tab Zen"

## Project Structure

```
tab-zen/
├── entrypoints/
│   ├── popup/           # Quick-action popup
│   ├── sidepanel/       # Side panel UI
│   ├── tabs/            # Full page UI
│   ├── background.ts    # Service worker
│   └── content.ts       # OG/meta extraction
├── lib/
│   ├── storage.ts       # IndexedDB + chrome.storage abstraction
│   ├── ai.ts            # OpenRouter integration
│   ├── sync.ts          # Cloudflare sync client
│   ├── metadata.ts      # Metadata extraction
│   ├── duplicates.ts    # Duplicate detection
│   └── export.ts        # Export/import logic
├── components/          # Shared SolidJS components
├── sync-service/
│   ├── src/
│   │   └── index.ts     # Cloudflare Worker
│   ├── wrangler.toml
│   └── package.json
├── public/
├── assets/
├── package.json
├── wxt.config.ts
├── tailwind.config.ts
└── tsconfig.json
```
