# Milestone 5: SPA Routing & Navigation

## Overview

Merge the extension's separate entrypoints into a unified single-page app with hash-based routing. Rename the domain model from "Tab" to "Page" to reflect that the product captures page content, not browser tabs.

## Problems Solved

- Detail page opens as a separate window with no back navigation
- Back button calls `window.close()` instead of navigating
- Page reload loses active document section (reverts to Content)
- Active section (Key Points, Summary, etc.) not preserved in URL
- Settings is a slide-in panel, not a proper route
- "Tab" naming is misleading — the domain concept is pages/content

## Route Structure

Router: `@solidjs/router` with `HashRouter` (required for `chrome-extension://` URLs).

| Route | View |
|---|---|
| `#/` | Page list (current tabs page) |
| `#/page/:pageId` | Detail page, defaults to Content |
| `#/page/:pageId/:section` | Detail page with specific section |
| `#/settings` | Settings (promoted from slide-in panel) |

Unmatched routes redirect to `#/`.

### Section Slug Mapping

| URL Slug | Internal ID |
|---|---|
| `content` | `content` |
| `custom` | `custom` |
| `key-points` | `builtin-key-points` |
| `action-items` | `builtin-action-items` |
| `eli5` | `builtin-eli5` |
| `products-mentions` | `builtin-products-mentions` |
| `sponsors` | `builtin-sponsors` |
| `social-posts` | `builtin-social-posts` |
| `tmpl-<uuid>` | `<uuid>` (custom templates) |

Default section when none specified: `content` (always available).

Invalid section slugs silently default to `content`.

## Entrypoint Changes

### Before

```
entrypoints/
  tabs/        -> tabs.html    (page list + settings panel)
  detail/      -> detail.html  (detail page, separate window)
  sidepanel/   -> sidepanel.html (page list + settings panel, duplicate of tabs)
  popup/       -> popup.html   (quick actions)
  background.ts
  content.ts
```

### After

```
entrypoints/
  app/         -> app.html     (unified SPA: list, detail, settings)
  popup/       -> popup.html   (quick actions, links into SPA)
  background.ts
  content.ts
```

- `entrypoints/tabs/` renamed to `entrypoints/app/`
- `entrypoints/detail/` deleted (merged into SPA)
- `entrypoints/sidepanel/` deleted (sidepanel configured to use `app.html`)
- WXT config updated: sidepanel points at `app.html`

### Context Behavior

| Context | Behavior |
|---|---|
| Full-page tab | SPA with all routes, full-width |
| Sidepanel | Same SPA, narrower — responsive design handles layout |
| Popup | Separate entrypoint, opens/focuses SPA for detail views |

No context detection needed — the SPA behaves identically everywhere. Only the popup has different behavior, and it's already a separate entrypoint.

## Navigation

### Popup → SPA Tab Reuse

When popup needs to open a detail view:

1. `browser.tabs.query({ url: browser.runtime.getURL('/app.html*') })` to find existing SPA tab
2. If found: `browser.tabs.update(tabId, { url: 'app.html#/page/:pageId' })` + `browser.windows.update` to focus
3. If not found: `browser.tabs.create({ url: 'app.html#/page/:pageId' })`

Same logic for opening settings from popup.

### In-SPA Navigation

- Page card click: `navigate(`/page/${pageId}`)` via router
- Document section click in `DocumentNav`: `navigate(`/page/${pageId}/${slug}`)` via router
- Back button on detail: `navigate("/")` (or `navigate(-1)` for history-aware back)
- Settings back: `navigate("/")`
- Browser back/forward: works natively via `HashRouter`

### Deep Linking

Copy `chrome-extension://<id>/app.html#/page/abc123/key-points` → paste in new tab → opens directly to Key Points section. Page reload preserves position.

## Settings Page

The existing `SettingsPanel` component becomes a routed page at `#/settings` instead of a slide-in panel. The component internals stay the same — it just renders as a full page with a back button that calls `navigate("/")`.

## Domain Rename: Tab → Page

Rename the domain model throughout the codebase. `browser.tabs.*` API calls remain unchanged (those refer to actual browser tabs).

### Types

| Before | After |
|---|---|
| `interface Tab` | `interface Page` |
| `TabCardProps` | `PageCardProps` |
| `TabCollectionProps` | `PageCollectionProps` |
| `TabRowProps` | `PageRowProps` |
| `TabZenDB` | `TabZenDB` (keep — it's the product name) |
| `CapturePreviewData.tabs` | `CapturePreviewData.pages` |

### Components

| Before | After |
|---|---|
| `TabCard.tsx` | `PageCard.tsx` |
| `TabCollection.tsx` | `PageCollection.tsx` |
| `TabRow.tsx` | `PageRow.tsx` |

### DB Functions (`lib/db.ts`)

| Before | After |
|---|---|
| `addTab()` | `addPage()` |
| `addTabs()` | `addPages()` |
| `getTab()` | `getPage()` |
| `getAllTabs()` | `getAllPages()` |
| `getTabsByGroup()` | `getPagesByGroup()` |
| `getTabByUrl()` | `getPageByUrl()` |
| `updateTab()` | `updatePage()` |
| `hardDeleteTab()` | `hardDeletePage()` |
| `softDeleteTab()` | `softDeletePage()` |
| `restoreTab()` | `restorePage()` |
| `getDocumentsForTab()` | `getDocumentsForPage()` |
| `deleteDocumentsForTab()` | `deleteDocumentsForPage()` |

IndexedDB object store stays `"tabs"` — renaming a store requires a migration and data copy with no benefit. The store name is internal.

### Messages (`lib/messages.ts`)

| Before | After |
|---|---|
| `CAPTURE_SINGLE_TAB` | `CAPTURE_PAGE` |
| `OPEN_TAB` | `OPEN_PAGE` |
| `TAB_OPENED` | `PAGE_OPENED` |
| `tabId` field (domain) | `pageId` field |

Keep `CAPTURE_ALL_TABS` as-is since it refers to capturing all browser tabs.

### Signal/Variable Names

| Before | After |
|---|---|
| `currentTab` / `setCurrentTab` | `currentPage` / `setCurrentPage` |
| `allTabs` / `setAllTabs` | `allPages` / `setAllPages` |
| `editingTab` / `setEditingTab` | `editingPage` / `setEditingPage` |
| `deletingTab` / `setDeletingTab` | `deletingPage` / `setDeletingPage` |
| `patchTab()` | `patchPage()` |
| `savedTabId` | `savedPageId` |
| `activeDocTab` | `activeSection` |

### API Endpoints

| Before | After |
|---|---|
| `/content/transcript` body `{ tabId }` | `{ pageId }` |
| `/content/transcript/:tabId` | `/content/transcript/:pageId` |

### Sync Service

| Before | After |
|---|---|
| `SyncPayload.tabs` | `SyncPayload.pages` |
| `mapTab()` | `mapPage()` |

D1 table stays `tabs` — renaming requires a migration with no user-facing benefit. Internal detail.

### UI Copy

| Before | After |
|---|---|
| "Tab not found" | "Page not found" |
| "Save Tab" | "Save Page" |
| Any user-facing "tab" text | "page" |

Audit all user-facing strings. Internal variable comments don't need updating.

## Error Handling

- Invalid page ID (`#/page/nonexistent`): "Page not found" message with link to `#/`
- Invalid section slug: silently default to Content
- Unmatched routes: redirect to `#/`

## DATA_CHANGED Messaging

No changes needed. `browser.runtime.onMessage` listeners in the SPA respond to cross-context messages regardless of active route. The messaging system is context-independent.

## Testing Checklist

- [ ] Open page detail → click Key Points → reload → still on Key Points
- [ ] Click Back → returns to list view
- [ ] Browser back/forward buttons work
- [ ] Copy URL → paste in new tab → opens to same section
- [ ] Popup click opens detail in existing SPA tab (reuses if open)
- [ ] Popup click creates new SPA tab if none exists
- [ ] Sidepanel navigates to detail inline
- [ ] Sidepanel back button returns to list
- [ ] Settings accessible at `#/settings`, back works
- [ ] Popup settings link opens/focuses SPA at `#/settings`
- [ ] `DATA_CHANGED` updates propagate across popup/sidepanel/SPA
- [ ] Invalid page ID shows "Page not found" with back link
- [ ] Invalid section defaults to Content
- [ ] Custom template sections accessible via `tmpl-<uuid>` slug
