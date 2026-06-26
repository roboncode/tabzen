# Content Types & Type Grouping — Design

**Date:** 2026-06-26
**Status:** Approved (ready for implementation plan)
**Area:** `apps/extension`

## Summary

Add a **media-type** dimension to the extension so the user can (1) choose which
*types* of content get saved when capturing all tabs, and (2) group the domains
navigation by type instead of one long flat list. Users can also create their
own custom types ("groups") and "move" a domain into one; the assignment is
remembered for existing and future items from that domain.

The type of a page is **computed from its domain** via a pure classifier — there
is no `mediaType` field on `Page`, so there is **no shared-type change, no D1
schema change, no Go service change, and no backfill**. All configuration lives
in local extension settings.

## Goals

- Define a small built-in set of media types with smart domain→type mapping.
- Let the user restrict which types are saved on "save all tabs", with a saved
  default plus a per-capture override.
- Let the user group the domains nav by type (toggle between Domain and Type).
- Let the user create custom types and route a domain into one via a "move"
  action that is remembered for that domain (existing + future items).
- Keep the long tail of one-off domains from bloating the Type view.

## Non-goals (YAGNI for v1)

- No per-page type override (move is always whole-domain). 
- No second orthogonal "topic vs medium" axis — one category axis only.
- No syncing of type configuration across profiles/devices (local settings,
  like `blockedDomains`). Can be added later.
- No `mediaType` column on `Page` / sync payload / Go service.

## Background (current state)

- **Capture** (`background.ts` `buildCapturePreview()` + `QUICK_CAPTURE`) gathers
  open tabs, filters via `shouldSkipUrl(url, blockedDomains)` (protocol + domain
  blocklist) and dedup, then shows a preview the user confirms. There is no
  notion of content type at capture.
- **Classification** today is domain-level only: `lib/domains.ts` has a
  `SOCIAL_PLATFORMS` set, `getDomain`, `isSocialPlatform`, `extractCreator`, and
  `buildDomainIndex()` → `DomainInfo[]` (domain, count, favicon, isSocial,
  creators).
- `Page` has **no media-type field**. Its `contentType: "transcript" | "markdown"
  | null` is the *extraction* result, unrelated to medium.
- **Nav** (`components/AppSidebar.tsx`) renders "All Domains" + a flat domain
  list sorted by count; social domains expand to creators.
- **`Group`** is a *per-capture* AI-named cluster (`Group.captureId`), not a
  persistent user library folder — so the new custom "types" are a distinct
  concept and do not reuse `Group`.

## Data model

### New module: `lib/media-types.ts`

The single source of truth for type definitions and classification (pure, no I/O).

```ts
export type BuiltInTypeId =
  | "video" | "social" | "article" | "audio" | "shopping" | "other";

export interface MediaTypeDef {
  id: string;        // built-in id, or a generated id for custom types
  label: string;     // "Video", "Work"
  icon?: string;     // lucide-solid icon name (built-ins ship with defaults)
  color?: string;    // accent for custom types (badge / section header)
  builtIn: boolean;
}

// Ordered list of built-ins; "other" is always last.
export const BUILT_IN_TYPES: MediaTypeDef[];

// Seed domain → built-in type map (keys are bare domains, e.g. "youtube.com").
export const DOMAIN_TYPE_MAP: Record<string, BuiltInTypeId>;

/**
 * Resolve a URL to a type id. Precedence: domainTypeOverrides > DOMAIN_TYPE_MAP
 * > "other". Domain is normalized via getDomain() (strips "www.").
 */
export function classifyMediaType(
  url: string,
  domainTypeOverrides: Record<string, string>,
): string;

/** Built-ins + custom types, in display order. */
export function allMediaTypes(customTypes: MediaTypeDef[]): MediaTypeDef[];

/**
 * Resolve a type id to its definition, falling back to the "other" built-in
 * when the id is unknown (e.g. a deleted custom type still referenced by an
 * override).
 */
export function resolveMediaType(
  id: string,
  customTypes: MediaTypeDef[],
): MediaTypeDef;
```

Seed `DOMAIN_TYPE_MAP` (starting set; extend as needed):

| Type | Seed domains |
|------|--------------|
| video | youtube.com, youtu.be, tiktok.com, vimeo.com, twitch.tv, dailymotion.com |
| social | x.com, twitter.com, reddit.com, instagram.com, threads.net, bsky.app, facebook.com, linkedin.com |
| article | medium.com, substack.com, nytimes.com, dev.to, theverge.com |
| audio | spotify.com, open.spotify.com, music.youtube.com, soundcloud.com, podcasts.apple.com |
| shopping | amazon.com, ebay.com, etsy.com |
| other | (fallback for anything unmapped) |

### Settings additions (`lib/types.ts`)

Add to `Settings` and `DEFAULT_SETTINGS` (all back-compatible defaults):

```ts
customTypes: MediaTypeDef[];                  // default []
domainTypeOverrides: Record<string, string>;  // default {}  (bare domain → typeId)
captureTypes: string[];                       // default []  ([] = capture all types)
navGroupBy: "domain" | "type";                // default "domain"
```

- `captureTypes === []` means "no type filter" → current capture behavior.
- `navGroupBy` is persisted like the already-persisted `activeFilter`.

## Feature 1 — Capture filtering by type

### Background capture (`entrypoints/background.ts`)

In both `buildCapturePreview()` and the `QUICK_CAPTURE` path, after the existing
`shouldSkipUrl(...)` + dedup filtering of candidate tabs, apply a type filter
**only when `settings.captureTypes.length > 0`**:

```ts
const includeType = (url: string) =>
  settings.captureTypes.length === 0 ||
  settings.captureTypes.includes(
    classifyMediaType(url, settings.domainTypeOverrides),
  );
```

Keep a candidate tab only if `includeType(tab.url)` is true. The blocklist still
applies on top. Tabs filtered out by type are simply not offered for capture
(same treatment as blocked domains).

### Per-capture override (capture preview UI)

The capture preview component renders a row of **type chips** seeded from
`settings.captureTypes` (or "all" when empty). Toggling a chip filters the
preview's candidate list live for *this capture only* — it does not persist.
Confirming captures exactly the visible (selected) items, consistent with the
existing select-and-confirm flow.

### Saved default (Settings → Content Types panel)

New `components/settings/ContentTypesPanel.tsx`, surfaced from `SettingsPanel`:

- **Save these types by default** — checkbox per type (built-in + custom) that
  writes `captureTypes`.
- **Types & domains** — list of all types; for each, the domains currently
  routed to it (from `DOMAIN_TYPE_MAP` + `domainTypeOverrides`). Add a custom
  type (label + color); rename/delete custom types. Deleting a custom type
  removes it from `customTypes` and strips it from `captureTypes`; overrides
  pointing at it resolve to "other" via `resolveMediaType`.

## Feature 2 — Type grouping in the nav

### Index builder (`lib/domains.ts`)

Add `buildTypeIndex(pages, domainTypeOverrides, customTypes)` →

```ts
interface TypeGroup {
  type: MediaTypeDef;
  count: number;            // total non-deleted, non-archived pages in this type
  domains: DomainInfo[];    // domains in this type, sorted by count desc
  otherSites?: {            // collapsed long tail (domains with <= 2 pages)
    count: number;          // summed page count
    domains: DomainInfo[];  // the collapsed domains, for expand-on-click
  };
}
```

Implementation reuses `buildDomainIndex(pages)` then buckets each `DomainInfo`
by `classifyMediaType(domain-representative-url, overrides)`. Within a type,
domains with `count <= 2` move into `otherSites`. Empty types are omitted.
Types are ordered by `allMediaTypes()` order; "other" last.

> Note: `buildDomainIndex` keys by domain; `classifyMediaType` takes a URL.
> Add a small `classifyDomain(domain, overrides)` helper (or have
> `buildTypeIndex` synthesize `https://${domain}` for the lookup) so bucketing
> works from a bare domain.

### Sidebar (`components/AppSidebar.tsx`)

- Add a **Group by: [ Domain | Type ]** toggle at the top of the nav, bound to
  `navGroupBy` (persisted via settings, restored on mount — mirrors the
  `activeFilter` persistence already in `PageCollection`).
- `navGroupBy === "domain"` → current flat domain list (unchanged).
- `navGroupBy === "type"` → collapsible **type sections** (label, count). Each
  section lists its `domains` (which still expand to creators for social
  domains) plus, if present, an **"Other sites (N)"** row that expands to the
  collapsed long-tail domains.
- Selecting a domain/creator inside a type section uses the existing
  `onSelectDomain` / `onSelectCreator` callbacks — type grouping is presentation
  only; it does not change how pages are filtered into the main view.

## Feature 3 — Move a domain into a type ("move to group")

- A context action on a page (`PageCard` / `PageRow`) and on a domain row in the
  nav: **Move to group →** opens a list of all types plus **"+ New group…"**.
- Selecting an existing type:
  1. Compute the page's domain (`getDomain`).
  2. Count non-deleted, non-archived pages sharing that domain.
  3. Confirm: *"Move all N items from {domain} to {Type}? Future items from
     {domain} will go here too."*
  4. On confirm: `updateSettings({ domainTypeOverrides: { ...overrides,
     [domain]: typeId } })`.
- **"+ New group…"** prompts for a name (+ color), appends to `customTypes`,
  then performs the same domain assignment.
- Classification is computed, so the nav/Type view re-derives immediately after
  the settings write (existing `DATA_CHANGED` / settings reload path). No
  per-page writes occur.

## Data flow

```
capture:   open tabs ─ shouldSkipUrl ─ dedup ─ includeType(captureTypes) ─ preview(type chips) ─ confirm
classify:  url ─ getDomain ─ domainTypeOverrides[domain] ?? DOMAIN_TYPE_MAP[domain] ?? "other"
nav:       pages ─ buildTypeIndex(overrides, customTypes) ─ TypeGroup[] ─ AppSidebar (type view)
move:      page/domain ─ count same-domain ─ confirm ─ updateSettings(domainTypeOverrides[domain]=typeId)
```

## Edge cases & error handling

- Unknown domain → "other".
- `captureTypes === []` → capture everything (back-compat; no behavior change for
  existing users).
- Deleted custom type still referenced by an override or `captureTypes` →
  `resolveMediaType` falls back to "other"; deletion also prunes `captureTypes`.
- Move confirm counts only non-deleted, non-archived pages (matches
  `buildDomainIndex`'s own exclusion).
- `otherSites` only appears when at least one domain in the type has ≤2 pages;
  a type whose every domain is ≤2 still shows them under "Other sites".
- Settings are local (`browser.storage.local`); type config is per-profile.

## Components & files

**New**
- `lib/media-types.ts` — types, seed map, `classifyMediaType`, `allMediaTypes`,
  `resolveMediaType`, built-in defs.
- `components/settings/ContentTypesPanel.tsx` — default capture types + custom
  type management.

**Changed**
- `lib/types.ts` — `Settings` fields + `DEFAULT_SETTINGS`.
- `lib/domains.ts` — `buildTypeIndex`, one-off collapse, `classifyDomain` helper.
- `entrypoints/background.ts` — type filter in `buildCapturePreview` + `QUICK_CAPTURE`.
- `components/AppSidebar.tsx` — Domain|Type toggle + type sections.
- capture-preview component — per-capture type chips.
- `components/SettingsPanel.tsx` — surface the Content Types panel.
- `components/PageCard.tsx` / `components/PageRow.tsx` — "Move to group" action.
- `components/PageCollection.tsx` — `navGroupBy` persistence, pass type index to
  sidebar, handle the move action + confirm dialog.

## Testing

Pure logic carries the coverage (Vitest, happy-dom):

- `classifyMediaType`: override > map > "other"; `www.`/subdomain normalization;
  empty/invalid URL → "other".
- `buildTypeIndex`: bucketing by type, one-off (≤2) collapse into `otherSites`,
  counts (type total = sum of domain counts incl. otherSites), empty-type
  omission, custom-type + override routing, deleted-type fallback.
- Capture `includeType` predicate: `[]` = all; subset includes/excludes by
  classified type; interaction with blocklist.

UI wiring (toggle persistence, chips, move confirm) is thin and verified by
type-check, the existing suite, and manual in-browser review.

## Rollout / back-compat

- All new settings default to "no change" (`captureTypes: []`, `navGroupBy:
  "domain"`, empty overrides/customTypes), so existing users see identical
  behavior until they opt in.
- No migrations; computed classification applies to all existing pages on first
  render.
