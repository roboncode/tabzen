# Content Types & Type Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a computed media-type dimension so the user can choose which content types are saved when capturing all tabs, group the domains nav by type, and create custom types a domain can be "moved" into (remembered for that domain).

**Architecture:** A pure classifier (`lib/media-types.ts`) resolves a URL/domain to a type id via `domainTypeOverrides > DOMAIN_TYPE_MAP > "other"`. Nothing is stored on `Page`; all config lives in local extension settings. Capture filtering, nav grouping, and "move to group" all call the same classifier, so reassigning a domain updates every view with no migration.

**Tech Stack:** WXT + SolidJS + Tailwind v4; Vitest (happy-dom); `@wxt-dev/storage` for settings; lucide-solid icons.

## Global Constraints

- **Package manager:** pnpm only (never npm/bun). Type-check: `cd apps/extension && pnpm compile`. Tests: `cd apps/extension && pnpm exec vitest run`.
- **Typed interfaces:** no untyped `any` for domain data; export named interfaces.
- **Path aliases:** `@/` → `apps/extension` root; `@tab-zen/shared` → package src. Tests resolve these (see `vitest.config.ts`).
- **Design system:** no separating borders — use `bg-muted/30…50` shading + spacing; pill-style tabs/toggles; min `text-sm` for content (`text-xs` only for tertiary metadata).
- **Back-compat:** every new setting defaults to a no-op (`captureTypes: []` = capture all; `navGroupBy: "domain"`; empty overrides/customTypes). Existing users see no behavior change until they opt in.
- **No schema churn:** do NOT add fields to `Page`, the sync payload, D1, or the Go service. Type config is local-only.
- **Branch + commit policy:** do all work on branch `feat/content-types-grouping`. Commit every task (frequent commits). Per the project's commit-discipline rule, UI-visible changes get the user's **visual confirmation before merging to main** — committing to the feature branch is fine.

---

## File Structure

**New files**
- `apps/extension/lib/media-types.ts` — type defs, seed domain map, `classifyDomain`/`classifyMediaType`, `allMediaTypes`, `resolveMediaType`, `includeUrlForCapture`. Pure.
- `apps/extension/lib/capture-filter.ts` — `filterPreviewByTypes`, `presentTypeIds`. Pure (operates on `CapturePreviewData`).
- `apps/extension/tests/media-types.test.ts`
- `apps/extension/tests/type-index.test.ts`
- `apps/extension/tests/capture-filter.test.ts`
- `apps/extension/components/settings/ContentTypesPanel.tsx` — manage default capture types + custom types + domain assignments.
- `apps/extension/components/MoveToGroupDialog.tsx` — modal: pick target type / new group, confirm with blast-radius count.

**Modified files**
- `apps/extension/lib/types.ts` — `Settings` fields + `DEFAULT_SETTINGS`.
- `apps/extension/lib/domains.ts` — `TypeGroup`, `buildTypeIndex`.
- `apps/extension/entrypoints/background.ts` — type filter in `QUICK_CAPTURE`.
- `apps/extension/components/CapturePreview.tsx` — type chips + client-side filter + trimmed confirm.
- `apps/extension/components/AppSidebar.tsx` — Domain|Type toggle + type sections + per-domain move action.
- `apps/extension/components/PageCard.tsx`, `components/PageRow.tsx` — "Move to group" action.
- `apps/extension/components/PageCollection.tsx` — settings signal, `navGroupBy` persistence, type index, move dialog wiring, pass props to CapturePreview/AppSidebar.
- `apps/extension/components/SettingsPanel.tsx` — register "Content Types" section.

---

## Phase 0: Branch setup

### Task 0: Create the feature branch

- [ ] **Step 1: Branch**

```bash
cd /Users/home/Projects/jombee/chrome-extensions/tab-zen
git checkout -b feat/content-types-grouping
```

- [ ] **Step 2: Verify clean baseline tests**

Run: `cd apps/extension && pnpm exec vitest run`
Expected: PASS (147 tests) — establishes the green baseline.

---

## Phase 1: The classifier + settings

### Task 1: `lib/media-types.ts` — type defs + classifier

**Files:**
- Create: `apps/extension/lib/media-types.ts`
- Test: `apps/extension/tests/media-types.test.ts`

**Interfaces:**
- Consumes: `getDomain` from `@/lib/domains`.
- Produces:
  - `type BuiltInTypeId = "video" | "social" | "article" | "audio" | "shopping" | "other"`
  - `interface MediaTypeDef { id: string; label: string; icon?: string; color?: string; builtIn: boolean }`
  - `const BUILT_IN_TYPES: MediaTypeDef[]`, `const OTHER_TYPE: MediaTypeDef`, `const DOMAIN_TYPE_MAP: Record<string, BuiltInTypeId>`
  - `classifyDomain(domain: string, overrides: Record<string,string>): string`
  - `classifyMediaType(url: string, overrides: Record<string,string>): string`
  - `allMediaTypes(customTypes: MediaTypeDef[]): MediaTypeDef[]`
  - `resolveMediaType(id: string, customTypes: MediaTypeDef[]): MediaTypeDef`
  - `includeUrlForCapture(url: string, captureTypes: string[], overrides: Record<string,string>): boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/media-types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  classifyDomain,
  classifyMediaType,
  allMediaTypes,
  resolveMediaType,
  includeUrlForCapture,
  BUILT_IN_TYPES,
  OTHER_TYPE,
  type MediaTypeDef,
} from "@/lib/media-types";

const custom: MediaTypeDef[] = [
  { id: "work", label: "Work", color: "#6366f1", builtIn: false },
];

describe("classifyDomain / classifyMediaType", () => {
  it("maps known domains to built-in types", () => {
    expect(classifyDomain("youtube.com", {})).toBe("video");
    expect(classifyDomain("tiktok.com", {})).toBe("video");
    expect(classifyDomain("medium.com", {})).toBe("article");
    expect(classifyDomain("reddit.com", {})).toBe("social");
  });

  it("falls back to 'other' for unknown domains", () => {
    expect(classifyDomain("example.com", {})).toBe("other");
  });

  it("lets overrides win over the built-in map", () => {
    expect(classifyDomain("youtube.com", { "youtube.com": "work" })).toBe("work");
  });

  it("normalizes www. and case", () => {
    expect(classifyDomain("WWW.YouTube.com", {})).toBe("video");
  });

  it("classifyMediaType derives the domain from a URL", () => {
    expect(classifyMediaType("https://www.youtube.com/watch?v=abc", {})).toBe("video");
    expect(classifyMediaType("not a url", {})).toBe("other");
  });
});

describe("allMediaTypes / resolveMediaType", () => {
  it("lists built-ins (minus other) then custom then other last", () => {
    const all = allMediaTypes(custom);
    expect(all[all.length - 1].id).toBe("other");
    expect(all.map((t) => t.id)).toContain("work");
    expect(all.findIndex((t) => t.id === "work")).toBeLessThan(all.length - 1);
  });

  it("resolves a known id, else falls back to OTHER_TYPE", () => {
    expect(resolveMediaType("work", custom).label).toBe("Work");
    expect(resolveMediaType("video", custom).id).toBe("video");
    expect(resolveMediaType("deleted-id", custom)).toEqual(OTHER_TYPE);
  });
});

describe("includeUrlForCapture", () => {
  it("includes everything when captureTypes is empty", () => {
    expect(includeUrlForCapture("https://example.com", [], {})).toBe(true);
  });

  it("includes only urls whose type is selected", () => {
    expect(includeUrlForCapture("https://youtube.com/x", ["video"], {})).toBe(true);
    expect(includeUrlForCapture("https://medium.com/x", ["video"], {})).toBe(false);
  });

  it("respects overrides", () => {
    expect(includeUrlForCapture("https://medium.com/x", ["work"], { "medium.com": "work" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/extension && pnpm exec vitest run tests/media-types.test.ts`
Expected: FAIL — cannot resolve `@/lib/media-types`.

- [ ] **Step 3: Write the implementation**

Create `apps/extension/lib/media-types.ts`:

```ts
import { getDomain } from "./domains";

export type BuiltInTypeId =
  | "video"
  | "social"
  | "article"
  | "audio"
  | "shopping"
  | "other";

export interface MediaTypeDef {
  id: string;
  label: string;
  /** lucide-solid icon name (built-ins only). */
  icon?: string;
  /** accent color for custom types (badge / section header). */
  color?: string;
  builtIn: boolean;
}

export const BUILT_IN_TYPES: MediaTypeDef[] = [
  { id: "video", label: "Video", icon: "Video", builtIn: true },
  { id: "social", label: "Social", icon: "AtSign", builtIn: true },
  { id: "article", label: "Article", icon: "FileText", builtIn: true },
  { id: "audio", label: "Audio", icon: "Music", builtIn: true },
  { id: "shopping", label: "Shopping", icon: "ShoppingBag", builtIn: true },
  { id: "other", label: "Other", icon: "Globe", builtIn: true },
];

export const OTHER_TYPE: MediaTypeDef = BUILT_IN_TYPES[BUILT_IN_TYPES.length - 1];

/** Seed domain → built-in type map. Keys are bare domains (no "www."). */
export const DOMAIN_TYPE_MAP: Record<string, BuiltInTypeId> = {
  "youtube.com": "video",
  "youtu.be": "video",
  "tiktok.com": "video",
  "vimeo.com": "video",
  "twitch.tv": "video",
  "dailymotion.com": "video",
  "x.com": "social",
  "twitter.com": "social",
  "reddit.com": "social",
  "instagram.com": "social",
  "threads.net": "social",
  "bsky.app": "social",
  "facebook.com": "social",
  "linkedin.com": "social",
  "medium.com": "article",
  "substack.com": "article",
  "nytimes.com": "article",
  "dev.to": "article",
  "theverge.com": "article",
  "spotify.com": "audio",
  "open.spotify.com": "audio",
  "music.youtube.com": "audio",
  "soundcloud.com": "audio",
  "podcasts.apple.com": "audio",
  "amazon.com": "shopping",
  "ebay.com": "shopping",
  "etsy.com": "shopping",
};

/** Resolve a bare domain to a type id: override > seed map > "other". */
export function classifyDomain(
  domain: string,
  overrides: Record<string, string>,
): string {
  if (!domain) return "other";
  const normalized = domain.replace(/^www\./, "").toLowerCase();
  if (overrides[normalized]) return overrides[normalized];
  return DOMAIN_TYPE_MAP[normalized] ?? "other";
}

/** Resolve a URL to a type id. Returns "other" for unparseable URLs. */
export function classifyMediaType(
  url: string,
  overrides: Record<string, string>,
): string {
  return classifyDomain(getDomain(url), overrides);
}

/** Built-ins (except "other") then custom types then "other" last. */
export function allMediaTypes(customTypes: MediaTypeDef[]): MediaTypeDef[] {
  const head = BUILT_IN_TYPES.filter((t) => t.id !== "other");
  return [...head, ...customTypes, OTHER_TYPE];
}

/** Resolve an id to its def, falling back to "other" for unknown ids. */
export function resolveMediaType(
  id: string,
  customTypes: MediaTypeDef[],
): MediaTypeDef {
  return allMediaTypes(customTypes).find((t) => t.id === id) ?? OTHER_TYPE;
}

/** Whether a URL should be captured given the saved type filter. */
export function includeUrlForCapture(
  url: string,
  captureTypes: string[],
  overrides: Record<string, string>,
): boolean {
  if (!captureTypes.length) return true;
  return captureTypes.includes(classifyMediaType(url, overrides));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/extension && pnpm exec vitest run tests/media-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/media-types.ts apps/extension/tests/media-types.test.ts
git commit -m "feat(types): media-type classifier + seed domain map"
```

### Task 2: Settings fields for type config

**Files:**
- Modify: `apps/extension/lib/types.ts`

**Interfaces:**
- Consumes: `MediaTypeDef` from `@/lib/media-types`.
- Produces: `Settings.customTypes: MediaTypeDef[]`, `Settings.domainTypeOverrides: Record<string,string>`, `Settings.captureTypes: string[]`, `Settings.navGroupBy: "domain" | "type"`.

- [ ] **Step 1: Add the import + fields to the `Settings` interface**

In `apps/extension/lib/types.ts`, add near the top of the file (with the other imports):

```ts
import type { MediaTypeDef } from "./media-types";
```

Inside `interface Settings { … }` add:

```ts
  /** User-created custom media types (built-ins live in media-types.ts). */
  customTypes: MediaTypeDef[];
  /** Bare domain → type id. Reassignments + custom-type routing. */
  domainTypeOverrides: Record<string, string>;
  /** Type ids to save on "save all tabs". Empty = save all types. */
  captureTypes: string[];
  /** Domains-nav grouping mode. */
  navGroupBy: "domain" | "type";
```

- [ ] **Step 2: Add defaults to `DEFAULT_SETTINGS`**

Inside `export const DEFAULT_SETTINGS: Settings = { … }` add:

```ts
  customTypes: [],
  domainTypeOverrides: {},
  captureTypes: [],
  navGroupBy: "domain",
```

- [ ] **Step 3: Type-check**

Run: `cd apps/extension && pnpm compile`
Expected: PASS (no errors). `reconcileSettings` copies these via its generic key loop, so no settings.ts change is needed.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "feat(settings): customTypes, domainTypeOverrides, captureTypes, navGroupBy"
```

---

## Phase 2: Capture filtering

### Task 3: `lib/capture-filter.ts` — pure preview filtering

**Files:**
- Create: `apps/extension/lib/capture-filter.ts`
- Test: `apps/extension/tests/capture-filter.test.ts`

**Interfaces:**
- Consumes: `classifyMediaType` from `@/lib/media-types`; `CapturePreviewData` from `@/lib/types`.
- Produces:
  - `presentTypeIds(preview: CapturePreviewData, overrides: Record<string,string>): string[]` — distinct type ids present among the preview pages.
  - `filterPreviewByTypes(preview: CapturePreviewData, selectedTypeIds: string[], overrides: Record<string,string>): CapturePreviewData` — pages + groups trimmed to the selected types (empty groups dropped).

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/capture-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { CapturePreviewData, Page } from "@/lib/types";
import { filterPreviewByTypes, presentTypeIds } from "@/lib/capture-filter";

function page(id: string, url: string): Page {
  return {
    id, url, title: id, favicon: "", ogTitle: null, ogDescription: null,
    ogImage: null, metaDescription: null, creator: null, creatorAvatar: null,
    creatorUrl: null, publishedAt: null, tags: [], notes: null, viewCount: 0,
    lastViewedAt: null, capturedAt: "", sourceLabel: "", deviceId: "",
    archived: false, starred: false, deletedAt: null, groupId: "g",
    contentKey: null, contentType: null, contentFetchedAt: null,
  };
}

const preview: CapturePreviewData = {
  captureId: "c1",
  pages: [
    page("a", "https://youtube.com/watch?v=1"),
    page("b", "https://medium.com/post"),
    page("c", "https://tiktok.com/@x/video/2"),
  ],
  groups: [
    { groupName: "youtube.com", pageIds: ["a", "c"] },
    { groupName: "medium.com", pageIds: ["b"] },
  ],
};

describe("presentTypeIds", () => {
  it("returns the distinct types present", () => {
    expect(presentTypeIds(preview, {}).sort()).toEqual(["article", "video"]);
  });
});

describe("filterPreviewByTypes", () => {
  it("keeps only pages of selected types and drops empty groups", () => {
    const out = filterPreviewByTypes(preview, ["video"], {});
    expect(out.pages.map((p) => p.id).sort()).toEqual(["a", "c"]);
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].groupName).toBe("youtube.com");
    expect(out.groups[0].pageIds.sort()).toEqual(["a", "c"]);
  });

  it("keeps everything when all present types are selected", () => {
    const out = filterPreviewByTypes(preview, ["video", "article"], {});
    expect(out.pages).toHaveLength(3);
    expect(out.groups).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/extension && pnpm exec vitest run tests/capture-filter.test.ts`
Expected: FAIL — cannot resolve `@/lib/capture-filter`.

- [ ] **Step 3: Write the implementation**

Create `apps/extension/lib/capture-filter.ts`:

```ts
import type { CapturePreviewData } from "./types";
import { classifyMediaType } from "./media-types";

/** Distinct type ids present among a preview's pages. */
export function presentTypeIds(
  preview: CapturePreviewData,
  overrides: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  for (const p of preview.pages) seen.add(classifyMediaType(p.url, overrides));
  return [...seen];
}

/** Trim a preview to pages whose type is selected; drop emptied groups. */
export function filterPreviewByTypes(
  preview: CapturePreviewData,
  selectedTypeIds: string[],
  overrides: Record<string, string>,
): CapturePreviewData {
  const pages = preview.pages.filter((p) =>
    selectedTypeIds.includes(classifyMediaType(p.url, overrides)),
  );
  const keep = new Set(pages.map((p) => p.id));
  const groups = preview.groups
    .map((g) => ({
      groupName: g.groupName,
      pageIds: g.pageIds.filter((id) => keep.has(id)),
    }))
    .filter((g) => g.pageIds.length > 0);
  return { ...preview, pages, groups };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/extension && pnpm exec vitest run tests/capture-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/capture-filter.ts apps/extension/tests/capture-filter.test.ts
git commit -m "feat(capture): pure preview type-filter helpers"
```

### Task 4: Apply the type filter to QUICK_CAPTURE

**Files:**
- Modify: `apps/extension/entrypoints/background.ts` (the `QUICK_CAPTURE` candidate filter, around lines 854-868)

**Interfaces:**
- Consumes: `includeUrlForCapture` from `@/lib/media-types`; `settings.captureTypes`, `settings.domainTypeOverrides`.

- [ ] **Step 1: Add the import**

At the top of `apps/extension/entrypoints/background.ts`, add to the existing imports:

```ts
import { includeUrlForCapture } from "@/lib/media-types";
```

- [ ] **Step 2: Filter QUICK_CAPTURE candidates by type**

Find the `QUICK_CAPTURE` candidate filter (currently):

```ts
      const candidateTabs = openTabs.filter(
        (t) =>
          t.url &&
          !shouldSkipUrl(t.url!, settings.blockedDomains) &&
          !isDuplicate(t.url!, existingUrls),
      );
```

Replace it with:

```ts
      const candidateTabs = openTabs.filter(
        (t) =>
          t.url &&
          !shouldSkipUrl(t.url!, settings.blockedDomains) &&
          !isDuplicate(t.url!, existingUrls) &&
          includeUrlForCapture(t.url!, settings.captureTypes, settings.domainTypeOverrides),
      );
```

> Note: `buildCapturePreview` is intentionally NOT filtered here — the preview shows all candidates and the UI (Task 5) applies the saved default as the initial chip selection, allowing per-capture re-inclusion.

- [ ] **Step 3: Type-check + tests**

Run: `cd apps/extension && pnpm compile && pnpm exec vitest run`
Expected: PASS (compile clean; 147 + new tests still pass).

- [ ] **Step 4: Commit**

```bash
git add apps/extension/entrypoints/background.ts
git commit -m "feat(capture): filter QUICK_CAPTURE by captureTypes"
```

### Task 5: Capture preview type chips + trimmed confirm

**Files:**
- Modify: `apps/extension/components/CapturePreview.tsx`
- Modify: `apps/extension/components/PageCollection.tsx` (pass props; trim on confirm — around lines 436-443 and 839-846)

**Interfaces:**
- Consumes: `filterPreviewByTypes`, `presentTypeIds` from `@/lib/capture-filter`; `allMediaTypes`, `resolveMediaType`, `MediaTypeDef` from `@/lib/media-types`.
- Produces: `CapturePreview` now takes `overrides`, `customTypes`, `defaultTypes` props and calls `onConfirm(filtered: CapturePreviewData)`.

- [ ] **Step 1: Rewrite `CapturePreview.tsx` with type chips**

Replace the entire contents of `apps/extension/components/CapturePreview.tsx`:

```tsx
import { createSignal, createMemo, For, Show } from "solid-js";
import type { CapturePreviewData } from "@/lib/types";
import {
  filterPreviewByTypes,
  presentTypeIds,
} from "@/lib/capture-filter";
import { resolveMediaType, type MediaTypeDef } from "@/lib/media-types";

interface CapturePreviewProps {
  data: CapturePreviewData;
  /** Domain → type overrides (for classifying preview pages). */
  overrides: Record<string, string>;
  /** Custom types, for resolving chip labels. */
  customTypes: MediaTypeDef[];
  /** Saved default capture types; [] means "all present types". */
  defaultTypes: string[];
  onConfirm: (filtered: CapturePreviewData) => void;
  onCancel: () => void;
}

export default function CapturePreview(props: CapturePreviewProps) {
  // Type ids present among the candidate pages, in display order.
  const present = createMemo(() => presentTypeIds(props.data, props.overrides));

  // Initial selection: saved default ∩ present, or all present when no default.
  const initial = () => {
    const p = present();
    if (!props.defaultTypes.length) return p;
    const chosen = p.filter((id) => props.defaultTypes.includes(id));
    return chosen.length ? chosen : p;
  };

  const [selected, setSelected] = createSignal<string[]>(initial());

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const filtered = createMemo(() =>
    filterPreviewByTypes(props.data, selected(), props.overrides),
  );

  const chipLabel = (id: string) => resolveMediaType(id, props.customTypes).label;

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-card rounded-xl p-5 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
        <h2 class="text-base font-semibold text-foreground mb-1">
          Capture Preview
        </h2>
        <p class="text-sm text-muted-foreground mb-3">
          {filtered().pages.length} of {props.data.pages.length} tabs in{" "}
          {filtered().groups.length} groups
        </p>

        {/* Type filter chips */}
        <Show when={present().length > 1}>
          <div class="flex flex-wrap gap-1.5 mb-4">
            <For each={present()}>
              {(id) => (
                <button
                  class={`px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    selected().includes(id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => toggle(id)}
                >
                  {chipLabel(id)}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="space-y-3 mb-5">
          <For each={filtered().groups}>
            {(group) => {
              const groupPages = () =>
                filtered().pages.filter((t) => group.pageIds.includes(t.id));
              return (
                <div class="bg-muted/30 rounded-lg p-3">
                  <h3 class="text-sm font-medium text-foreground mb-2">
                    {group.groupName}
                    <span class="text-muted-foreground ml-2 text-xs">
                      ({groupPages().length})
                    </span>
                  </h3>
                  <ul class="space-y-1.5">
                    <For each={groupPages()}>
                      {(tab) => (
                        <li class="text-xs text-muted-foreground truncate flex items-center gap-2">
                          {tab.favicon && (
                            <img src={tab.favicon} alt="" class="w-3.5 h-3.5 rounded-sm" />
                          )}
                          {tab.title}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              );
            }}
          </For>
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            disabled={filtered().pages.length === 0}
            onClick={() => props.onConfirm(filtered())}
          >
            Save {filtered().pages.length} Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `PageCollection.tsx` to pass props and trim on confirm**

In `apps/extension/components/PageCollection.tsx`, change the confirm handler (currently around line 436):

```ts
  const handleConfirmCapture = async (filtered: CapturePreviewData) => {
    await sendMessage({ type: "CONFIRM_CAPTURE", captureData: filtered });
    setCapturePreview(null);
    loadData(); // Full reload for new captures
  };
```

And update the `<CapturePreview>` usage (currently around line 841) to pass the new props and the new onConfirm signature. It must read settings — see Task 8 which adds a `settings` signal; until then use `DEFAULT_SETTINGS` fallbacks. Replace the usage with:

```tsx
        <Show when={capturePreview()}>
          {(preview) => (
            <CapturePreview
              data={preview()}
              overrides={settings()?.domainTypeOverrides ?? {}}
              customTypes={settings()?.customTypes ?? []}
              defaultTypes={settings()?.captureTypes ?? []}
              onConfirm={handleConfirmCapture}
              onCancel={() => setCapturePreview(null)}
            />
          )}
        </Show>
```

> The `settings()` signal is introduced in Task 8. If executing strictly in order, temporarily use `{}` / `[]` literals here and switch to `settings()?…` in Task 8. Recommended: do Task 8's settings-signal step first, then this — they're in the same file.

- [ ] **Step 3: Type-check**

Run: `cd apps/extension && pnpm compile`
Expected: PASS once the `settings()` signal exists (Task 8). If doing this task first, use literal `{}`/`[]` and compile clean.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/CapturePreview.tsx apps/extension/components/PageCollection.tsx
git commit -m "feat(capture): per-capture type chips in preview"
```

---

## Phase 3: Type grouping in the nav

### Task 6: `buildTypeIndex` in `lib/domains.ts`

**Files:**
- Modify: `apps/extension/lib/domains.ts`
- Test: `apps/extension/tests/type-index.test.ts`

**Interfaces:**
- Consumes: existing `buildDomainIndex`, `DomainInfo`; `classifyDomain`, `allMediaTypes`, `MediaTypeDef` from `@/lib/media-types`.
- Produces:
  - `interface TypeGroup { type: MediaTypeDef; count: number; domains: DomainInfo[]; otherSites?: { count: number; domains: DomainInfo[] } }`
  - `buildTypeIndex(pages: Page[], overrides: Record<string,string>, customTypes: MediaTypeDef[]): TypeGroup[]`
  - `const ONE_OFF_MAX = 2` (exported for the test).

- [ ] **Step 1: Write the failing test**

Create `apps/extension/tests/type-index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Page } from "@/lib/types";
import { buildTypeIndex } from "@/lib/domains";
import type { MediaTypeDef } from "@/lib/media-types";

function page(id: string, url: string): Page {
  return {
    id, url, title: id, favicon: "", ogTitle: null, ogDescription: null,
    ogImage: null, metaDescription: null, creator: null, creatorAvatar: null,
    creatorUrl: null, publishedAt: null, tags: [], notes: null, viewCount: 0,
    lastViewedAt: null, capturedAt: "", sourceLabel: "", deviceId: "",
    archived: false, starred: false, deletedAt: null, groupId: "g",
    contentKey: null, contentType: null, contentFetchedAt: null,
  };
}

// 3 youtube (video), 1 medium (article, one-off), 1 example.com (other, one-off)
const pages: Page[] = [
  page("1", "https://youtube.com/watch?v=a"),
  page("2", "https://youtube.com/watch?v=b"),
  page("3", "https://youtube.com/watch?v=c"),
  page("4", "https://medium.com/post"),
  page("5", "https://example.com/x"),
];
const custom: MediaTypeDef[] = [];

describe("buildTypeIndex", () => {
  it("buckets domains by type with summed counts", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    const video = idx.find((g) => g.type.id === "video")!;
    expect(video.count).toBe(3);
    expect(video.domains.map((d) => d.domain)).toEqual(["youtube.com"]);
  });

  it("collapses one-off domains (<=2 pages) into otherSites", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    const article = idx.find((g) => g.type.id === "article")!;
    // medium.com has 1 page -> it goes to otherSites, primary list empty
    expect(article.domains).toHaveLength(0);
    expect(article.otherSites?.count).toBe(1);
    expect(article.otherSites?.domains.map((d) => d.domain)).toEqual(["medium.com"]);
  });

  it("omits types with no pages and routes unknown domains to 'other'", () => {
    const idx = buildTypeIndex(pages, {}, custom);
    expect(idx.find((g) => g.type.id === "shopping")).toBeUndefined();
    const other = idx.find((g) => g.type.id === "other")!;
    expect(other.otherSites?.domains.map((d) => d.domain)).toEqual(["example.com"]);
  });

  it("routes a domain via overrides into a custom type", () => {
    const customTypes: MediaTypeDef[] = [
      { id: "work", label: "Work", builtIn: false },
    ];
    const idx = buildTypeIndex(pages, { "youtube.com": "work" }, customTypes);
    const work = idx.find((g) => g.type.id === "work")!;
    expect(work.count).toBe(3);
    expect(idx.find((g) => g.type.id === "video")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/extension && pnpm exec vitest run tests/type-index.test.ts`
Expected: FAIL — `buildTypeIndex` is not exported.

- [ ] **Step 3: Implement `buildTypeIndex`**

In `apps/extension/lib/domains.ts`, add the import at the top:

```ts
import { classifyDomain, allMediaTypes, type MediaTypeDef } from "./media-types";
```

Append to the end of the file:

```ts
export const ONE_OFF_MAX = 2;

export interface TypeGroup {
  type: MediaTypeDef;
  count: number;
  domains: DomainInfo[];
  otherSites?: { count: number; domains: DomainInfo[] };
}

/**
 * Group the domain index by media type. Domains with <= ONE_OFF_MAX pages are
 * collapsed into a per-type `otherSites` bucket so the long tail of one-off
 * domains doesn't bloat the Type view. Empty types are omitted; unknown domains
 * fall back to "other".
 */
export function buildTypeIndex(
  pages: Page[],
  overrides: Record<string, string>,
  customTypes: MediaTypeDef[],
): TypeGroup[] {
  const domainIndex = buildDomainIndex(pages);
  const types = allMediaTypes(customTypes);
  const validIds = new Set(types.map((t) => t.id));

  const byType = new Map<string, DomainInfo[]>();
  for (const info of domainIndex) {
    const id0 = classifyDomain(info.domain, overrides);
    const id = validIds.has(id0) ? id0 : "other";
    const list = byType.get(id) || [];
    list.push(info);
    byType.set(id, list);
  }

  const groups: TypeGroup[] = [];
  for (const type of types) {
    const domains = byType.get(type.id);
    if (!domains || domains.length === 0) continue;
    const primary = domains.filter((d) => d.count > ONE_OFF_MAX);
    const oneOff = domains.filter((d) => d.count <= ONE_OFF_MAX);
    const count = domains.reduce((sum, d) => sum + d.count, 0);
    groups.push({
      type,
      count,
      domains: primary,
      otherSites: oneOff.length
        ? { count: oneOff.reduce((s, d) => s + d.count, 0), domains: oneOff }
        : undefined,
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/extension && pnpm exec vitest run tests/type-index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/lib/domains.ts apps/extension/tests/type-index.test.ts
git commit -m "feat(nav): buildTypeIndex with one-off collapsing"
```

### Task 7: AppSidebar — Domain|Type toggle + type sections

**Files:**
- Modify: `apps/extension/components/AppSidebar.tsx`

**Interfaces:**
- Consumes: `TypeGroup` from `@/lib/domains`; `MediaTypeDef`.
- Produces: `AppSidebarProps` gains `groupBy: "domain" | "type"`, `typeGroups: TypeGroup[]`, `onSetGroupBy: (m: "domain" | "type") => void`, `onMoveDomain?: (domain: string) => void`.

- [ ] **Step 1: Extend props + add the toggle and type view**

In `apps/extension/components/AppSidebar.tsx`, update the import line:

```ts
import type { DomainInfo, TypeGroup } from "@/lib/domains";
```

Extend the props interface:

```ts
interface AppSidebarProps {
  domains: DomainInfo[];
  typeGroups: TypeGroup[];
  groupBy: "domain" | "type";
  onSetGroupBy: (mode: "domain" | "type") => void;
  activeDomain: string | null;
  activeCreator: string | null;
  onSelectDomain: (domain: string | null) => void;
  onSelectCreator: (domain: string, creator: string | null) => void;
  onMoveDomain?: (domain: string) => void;
  totalCount: number;
}
```

- [ ] **Step 2: Extract the domain row into a local component**

Still in `AppSidebar.tsx`, refactor so the existing domain-row markup (the `<For each={props.domains}>` body) is rendered by a reusable local function `DomainRow`, used by both the Domain view and inside each Type section. Add this inside the `AppSidebar` function, before the `return`:

```tsx
  const [expandedDomains, setExpandedDomains] = createSignal<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = createSignal<Set<string>>(new Set());
  const [expandedOther, setExpandedOther] = createSignal<Set<string>>(new Set());

  const toggleExpand = (domain: string) => {
    const next = new Set(expandedDomains());
    next.has(domain) ? next.delete(domain) : next.add(domain);
    setExpandedDomains(next);
  };
  const toggleType = (id: string) => {
    const next = new Set(expandedTypes());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedTypes(next);
  };
  const toggleOther = (id: string) => {
    const next = new Set(expandedOther());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedOther(next);
  };

  const DomainRow = (domainInfo: DomainInfo) => {
    const isActive = () => props.activeDomain === domainInfo.domain;
    const isExpanded = () => expandedDomains().has(domainInfo.domain);
    const hasSocialCreators = () =>
      domainInfo.isSocial && domainInfo.creators.length > 0;
    const favSrc =
      domainInfo.favicon && !domainInfo.favicon.startsWith("chrome://")
        ? domainInfo.favicon
        : `https://www.google.com/s2/favicons?domain=${domainInfo.domain}&sz=32`;

    return (
      <div class={hasSocialCreators() && isExpanded() ? "mb-2 pb-1" : ""}>
        <div class="group/row flex items-center">
          <button
            class={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
              isActive() && !props.activeCreator
                ? "bg-muted/50 text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
            onClick={() => {
              if (hasSocialCreators()) toggleExpand(domainInfo.domain);
              props.onSelectDomain(domainInfo.domain);
              props.onSelectCreator(domainInfo.domain, null);
            }}
          >
            <Show when={hasSocialCreators()} fallback={<div class="w-3" />}>
              <span class="w-3 flex items-center justify-center text-muted-foreground/50 flex-shrink-0">
                {isExpanded() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </Show>
            <img src={favSrc} alt="" class="w-4 h-4 rounded flex-shrink-0" />
            <span class="flex-1 text-left truncate">{domainInfo.domain}</span>
            <span class="text-xs text-muted-foreground/60">{domainInfo.count}</span>
          </button>
          <Show when={props.onMoveDomain}>
            <button
              class="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 text-muted-foreground/60 hover:text-foreground flex-shrink-0"
              title="Move to group"
              onClick={(e) => {
                e.stopPropagation();
                props.onMoveDomain!(domainInfo.domain);
              }}
            >
              <FolderInput size={13} />
            </button>
          </Show>
        </div>

        <Show when={hasSocialCreators() && isExpanded()}>
          <div class="ml-5 mt-0.5 space-y-0.5">
            <For each={domainInfo.creators}>
              {(creator) => {
                const isCreatorActive = () =>
                  props.activeDomain === domainInfo.domain &&
                  props.activeCreator === creator.name;
                return (
                  <button
                    class={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isCreatorActive()
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    onClick={() => {
                      props.onSelectDomain(domainInfo.domain);
                      props.onSelectCreator(domainInfo.domain, creator.name);
                    }}
                  >
                    <Avatar src={creator.avatar} size="sm" />
                    <span class="flex-1 text-left truncate">{creator.name}</span>
                    <span class="text-xs text-muted-foreground/60">{creator.count}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    );
  };
```

Update the icon import line to include the new icons:

```ts
import { ChevronDown, ChevronRight, Globe, MessagesSquare, FolderInput, Layers } from "lucide-solid";
```

- [ ] **Step 3: Replace the domain-list render with toggle + conditional views**

Replace the markup from `{/* All domains */}` through the end of the `{/* Domain list */}` block with:

```tsx
        {/* All domains */}
        <button
          class={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
            !props.activeDomain
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          }`}
          onClick={() => props.onSelectDomain(null)}
        >
          <Globe size={15} class="flex-shrink-0" />
          <span class="flex-1 text-left truncate">All Domains</span>
          <span class="text-xs text-muted-foreground">{props.totalCount}</span>
        </button>

        {/* Group-by toggle */}
        <div class="flex items-center gap-1 mt-3 mb-1 px-1">
          <span class="text-xs text-muted-foreground/60 flex-1">Group by</span>
          <div class="flex gap-1 bg-muted/30 rounded-full p-0.5">
            <For each={["domain", "type"] as const}>
              {(mode) => (
                <button
                  class={`px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    props.groupBy === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => props.onSetGroupBy(mode)}
                >
                  {mode === "domain" ? "Domain" : "Type"}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Domain view */}
        <Show when={props.groupBy === "domain"}>
          <div class="mt-1 space-y-0.5">
            <For each={props.domains}>{(d) => DomainRow(d)}</For>
          </div>
        </Show>

        {/* Type view */}
        <Show when={props.groupBy === "type"}>
          <div class="mt-1 space-y-1.5">
            <For each={props.typeGroups}>
              {(tg) => {
                const isOpen = () => !expandedTypes().has(tg.type.id); // open by default
                const otherOpen = () => expandedOther().has(tg.type.id);
                return (
                  <div>
                    <button
                      class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleType(tg.type.id)}
                    >
                      <span class="w-3 flex items-center justify-center text-muted-foreground/50 flex-shrink-0">
                        {isOpen() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <Layers size={14} class="flex-shrink-0 text-muted-foreground/60" />
                      <span class="flex-1 text-left truncate">{tg.type.label}</span>
                      <span class="text-xs text-muted-foreground/60">{tg.count}</span>
                    </button>
                    <Show when={isOpen()}>
                      <div class="ml-3 mt-0.5 space-y-0.5">
                        <For each={tg.domains}>{(d) => DomainRow(d)}</For>
                        <Show when={tg.otherSites}>
                          <button
                            class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground transition-colors"
                            onClick={() => toggleOther(tg.type.id)}
                          >
                            <span class="w-3 flex items-center justify-center text-muted-foreground/40 flex-shrink-0">
                              {otherOpen() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <span class="flex-1 text-left truncate">
                              Other sites ({tg.otherSites!.domains.length})
                            </span>
                            <span class="text-xs text-muted-foreground/50">{tg.otherSites!.count}</span>
                          </button>
                          <Show when={otherOpen()}>
                            <div class="ml-3 space-y-0.5">
                              <For each={tg.otherSites!.domains}>{(d) => DomainRow(d)}</For>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
```

> Note: `expandedTypes` holds the *collapsed* set, so types render open by default (matches the approved mockup).

- [ ] **Step 4: Type-check**

Run: `cd apps/extension && pnpm compile`
Expected: PASS once `PageCollection` passes the new props (Task 8). If compiling this task alone, it errors at the call sites until Task 8 — acceptable; do Task 8 next.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/AppSidebar.tsx
git commit -m "feat(nav): Domain|Type group-by toggle + type sections"
```

### Task 8: PageCollection — settings signal, navGroupBy persistence, type index, sidebar props

**Files:**
- Modify: `apps/extension/components/PageCollection.tsx`

**Interfaces:**
- Consumes: `buildTypeIndex` from `@/lib/domains`; `watchSettings` from `@/lib/settings`; `Settings` type.
- Produces: a reactive `settings()` signal; `groupBy` persisted to `settings.navGroupBy`; `typeIndex()` memo; new props passed to `AppSidebar` (both instances) and `CapturePreview`.

- [ ] **Step 1: Add a settings signal + watcher**

In `apps/extension/components/PageCollection.tsx`, add imports:

```ts
import { getSettings, updateSettings, watchSettings } from "@/lib/settings";
import { buildDomainIndex, buildTypeIndex, getDomain, extractCreator } from "@/lib/domains";
import type { Settings } from "@/lib/types";
```

Add a settings signal near the other signals (after line ~65):

```ts
  const [settings, setSettings] = createSignal<Settings | null>(null);
```

In `onMount`, replace the existing `getSettings().then(...)` block with one that also seeds settings + restores `navGroupBy`, and subscribe to changes:

```ts
    getSettings().then((s) => {
      setSettings(s);
      if (s.syncError) setSyncError(s.syncError);
      setFilterRaw(s.activeFilter);
    });
    const unwatchSettings = watchSettings((s) => setSettings(s));
    onCleanup(unwatchSettings);
```

- [ ] **Step 2: Add groupBy persistence + the type index memo**

Add after the `domainIndex` memo (~line 224):

```ts
  const groupBy = (): "domain" | "type" => settings()?.navGroupBy ?? "domain";
  const setGroupBy = (mode: "domain" | "type") => {
    setSettings((s) => (s ? { ...s, navGroupBy: mode } : s));
    void updateSettings({ navGroupBy: mode });
  };

  const typeIndex = createMemo(() =>
    buildTypeIndex(
      allPages() || [],
      settings()?.domainTypeOverrides ?? {},
      settings()?.customTypes ?? [],
    ),
  );
```

- [ ] **Step 3: Pass the new props to both `<AppSidebar>` instances**

For each `<AppSidebar … />` (desktop ~line 449 and drawer ~line 471), add:

```tsx
          typeGroups={typeIndex()}
          groupBy={groupBy()}
          onSetGroupBy={setGroupBy}
          onMoveDomain={(d) => openMoveDialog(d)}
```

(`openMoveDialog` is added in Task 10. Until then, pass `onMoveDomain={() => {}}` and replace in Task 10.)

- [ ] **Step 4: Type-check + tests**

Run: `cd apps/extension && pnpm compile && pnpm exec vitest run`
Expected: PASS (compile clean; all tests green).

- [ ] **Step 5: Commit**

```bash
git add apps/extension/components/PageCollection.tsx
git commit -m "feat(nav): wire settings signal, navGroupBy persistence, type index"
```

---

## Phase 4: Move a domain into a type

### Task 9: `MoveToGroupDialog` component

**Files:**
- Create: `apps/extension/components/MoveToGroupDialog.tsx`

**Interfaces:**
- Consumes: `allMediaTypes`, `MediaTypeDef` from `@/lib/media-types`.
- Produces: `MoveToGroupDialog` props:
  - `domain: string`
  - `itemCount: number`
  - `customTypes: MediaTypeDef[]`
  - `currentTypeId: string`
  - `onPick: (typeId: string) => void` (existing type chosen → caller confirms+writes)
  - `onCreate: (label: string) => void` (new group → caller creates + assigns)
  - `onCancel: () => void`

- [ ] **Step 1: Create the dialog**

Create `apps/extension/components/MoveToGroupDialog.tsx`:

```tsx
import { createSignal, For, Show } from "solid-js";
import { allMediaTypes, type MediaTypeDef } from "@/lib/media-types";

interface MoveToGroupDialogProps {
  domain: string;
  itemCount: number;
  customTypes: MediaTypeDef[];
  currentTypeId: string;
  onPick: (typeId: string) => void;
  onCreate: (label: string) => void;
  onCancel: () => void;
}

export default function MoveToGroupDialog(props: MoveToGroupDialogProps) {
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={props.onCancel}>
      <div
        class="bg-card rounded-xl p-5 w-80 max-w-[90vw] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 class="text-base font-semibold text-foreground mb-1">Move to group</h2>
        <p class="text-sm text-muted-foreground mb-4">
          Routes <span class="text-foreground">{props.domain}</span> ({props.itemCount}{" "}
          {props.itemCount === 1 ? "item" : "items"}). Future items from this domain follow.
        </p>

        <div class="space-y-0.5 mb-3">
          <For each={allMediaTypes(props.customTypes)}>
            {(t) => (
              <button
                class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  t.id === props.currentTypeId
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
                onClick={() => props.onPick(t.id)}
              >
                <Show when={t.color}>
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ "background-color": t.color }} />
                </Show>
                <span class="flex-1 truncate">{t.label}</span>
                <Show when={t.id === props.currentTypeId}>
                  <span class="text-xs text-muted-foreground/60">current</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <Show
          when={creating()}
          fallback={
            <button
              class="w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors text-left"
              onClick={() => setCreating(true)}
            >
              + New group…
            </button>
          }
        >
          <div class="flex gap-2">
            <input
              class="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="Group name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name().trim()) props.onCreate(name().trim());
              }}
              autofocus
            />
            <button
              class="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
              disabled={!name().trim()}
              onClick={() => props.onCreate(name().trim())}
            >
              Create
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/extension && pnpm compile`
Expected: PASS (component is self-contained).

- [ ] **Step 3: Commit**

```bash
git add apps/extension/components/MoveToGroupDialog.tsx
git commit -m "feat(types): MoveToGroupDialog component"
```

### Task 10: Wire move-to-group in PageCollection + page rows

**Files:**
- Modify: `apps/extension/components/PageCollection.tsx`
- Modify: `apps/extension/components/PageCard.tsx`, `apps/extension/components/PageRow.tsx`

**Interfaces:**
- Consumes: `MoveToGroupDialog`; `classifyDomain` from `@/lib/media-types`; `getDomain` from `@/lib/domains`.
- Produces: `openMoveDialog(domain: string)`; `PageCard`/`PageRow` gain `onMove?: (page: Page) => void`.

- [ ] **Step 1: Add move state + handlers in PageCollection**

In `apps/extension/components/PageCollection.tsx`, add imports:

```ts
import MoveToGroupDialog from "./MoveToGroupDialog";
import { classifyDomain } from "@/lib/media-types";
```

Add signals + handlers (near the capture-preview signal):

```ts
  const [moveDomain, setMoveDomain] = createSignal<string | null>(null);

  const openMoveDialog = (domain: string) => setMoveDomain(domain);

  const moveItemCount = createMemo(() => {
    const d = moveDomain();
    if (!d) return 0;
    return (allPages() || []).filter(
      (p) => !p.deletedAt && !p.archived && getDomain(p.url) === d,
    ).length;
  });

  const assignDomainType = async (domain: string, typeId: string) => {
    const cur = settings();
    const overrides = { ...(cur?.domainTypeOverrides ?? {}), [domain]: typeId };
    setSettings((s) => (s ? { ...s, domainTypeOverrides: overrides } : s));
    await updateSettings({ domainTypeOverrides: overrides });
    setMoveDomain(null);
  };

  const createTypeAndAssign = async (domain: string, label: string) => {
    const cur = settings();
    const id = `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${(cur?.customTypes?.length ?? 0)}`;
    const customTypes = [
      ...(cur?.customTypes ?? []),
      { id, label, color: "#6366f1", builtIn: false },
    ];
    const overrides = { ...(cur?.domainTypeOverrides ?? {}), [domain]: id };
    setSettings((s) => (s ? { ...s, customTypes, domainTypeOverrides: overrides } : s));
    await updateSettings({ customTypes, domainTypeOverrides: overrides });
    setMoveDomain(null);
  };
```

Replace the temporary `onMoveDomain={() => {}}` on both `<AppSidebar>` instances with `onMoveDomain={openMoveDialog}` (from Task 8 Step 3).

- [ ] **Step 2: Render the dialog**

Next to the `<Show when={capturePreview()}>` block, add:

```tsx
        <Show when={moveDomain()}>
          {(domain) => (
            <MoveToGroupDialog
              domain={domain()}
              itemCount={moveItemCount()}
              customTypes={settings()?.customTypes ?? []}
              currentTypeId={classifyDomain(domain(), settings()?.domainTypeOverrides ?? {})}
              onPick={(typeId) => assignDomainType(domain(), typeId)}
              onCreate={(label) => createTypeAndAssign(domain(), label)}
              onCancel={() => setMoveDomain(null)}
            />
          )}
        </Show>
```

- [ ] **Step 3: Add an `onMove` action to PageCard and PageRow**

In `apps/extension/components/PageCard.tsx`, add to the props interface:

```ts
  onMove?: (page: Page) => void;
```

Add a button alongside the existing action buttons (next to the star button), importing `FolderInput` from `lucide-solid`:

```tsx
            <Show when={props.onMove}>
              <button
                class="p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                title="Move domain to group"
                onClick={(e) => { e.stopPropagation(); props.onMove!(props.page); }}
              >
                <FolderInput size={16} />
              </button>
            </Show>
```

Do the equivalent in `apps/extension/components/PageRow.tsx` (match its existing action-button styling and `Show`/import patterns).

- [ ] **Step 4: Pass `onMove` from PageCollection to the rendered cards/rows**

Where PageCollection renders `<PageCard>` / `<PageRow>`, add:

```tsx
              onMove={(p) => openMoveDialog(getDomain(p.url))}
```

- [ ] **Step 5: Type-check + tests + build**

Run: `cd apps/extension && pnpm compile && pnpm exec vitest run && pnpm exec wxt build`
Expected: PASS (compile clean, all tests green, build succeeds).

- [ ] **Step 6: Commit**

```bash
git add apps/extension/components/PageCollection.tsx apps/extension/components/PageCard.tsx apps/extension/components/PageRow.tsx
git commit -m "feat(types): move a domain into a (custom) group from nav + cards"
```

---

## Phase 5: Settings — Content Types panel

### Task 11: `ContentTypesPanel` + register the section

**Files:**
- Create: `apps/extension/components/settings/ContentTypesPanel.tsx`
- Modify: `apps/extension/components/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `allMediaTypes`, `BUILT_IN_TYPES`, `MediaTypeDef` from `@/lib/media-types`; `Settings` type; a `save(partial: Partial<Settings>)` callback (the existing SettingsPanel pattern).
- Produces: a `"content-types"` settings section.

- [ ] **Step 1: Create the panel**

Create `apps/extension/components/settings/ContentTypesPanel.tsx`:

```tsx
import { createSignal, For, Show } from "solid-js";
import type { Settings } from "@/lib/types";
import { allMediaTypes, BUILT_IN_TYPES, type MediaTypeDef } from "@/lib/media-types";

interface ContentTypesPanelProps {
  settings: Settings;
  save: (partial: Partial<Settings>) => void;
}

export default function ContentTypesPanel(props: ContentTypesPanelProps) {
  const [newName, setNewName] = createSignal("");

  const types = () => allMediaTypes(props.settings.customTypes);
  const captureTypes = () => props.settings.captureTypes;

  const toggleCapture = (id: string) => {
    const cur = captureTypes();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    props.save({ captureTypes: next });
  };

  const addType = () => {
    const label = newName().trim();
    if (!label) return;
    const id = `t-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${props.settings.customTypes.length}`;
    props.save({
      customTypes: [...props.settings.customTypes, { id, label, color: "#6366f1", builtIn: false }],
    });
    setNewName("");
  };

  const deleteType = (id: string) => {
    const customTypes = props.settings.customTypes.filter((t) => t.id !== id);
    const captureTypesNext = props.settings.captureTypes.filter((t) => t !== id);
    // Strip overrides pointing at the deleted type (they resolve to "other").
    const overrides = { ...props.settings.domainTypeOverrides };
    for (const [domain, typeId] of Object.entries(overrides)) {
      if (typeId === id) delete overrides[domain];
    }
    props.save({ customTypes, captureTypes: captureTypesNext, domainTypeOverrides: overrides });
  };

  // domains routed to each type via overrides (custom-routed sites).
  const overriddenDomains = (typeId: string) =>
    Object.entries(props.settings.domainTypeOverrides)
      .filter(([, t]) => t === typeId)
      .map(([d]) => d);

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-sm font-medium text-foreground mb-1">Capture by type</h3>
        <p class="text-sm text-muted-foreground mb-3">
          When saving all tabs, only these types are saved. Select none to save everything.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <For each={types()}>
            {(t) => (
              <button
                class={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                  captureTypes().includes(t.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => toggleCapture(t.id)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium text-foreground mb-1">Your groups</h3>
        <p class="text-sm text-muted-foreground mb-3">
          Custom types you can move domains into. Built-in types can't be removed.
        </p>
        <div class="space-y-1.5">
          <For each={props.settings.customTypes}>
            {(t) => (
              <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ "background-color": t.color }} />
                <span class="flex-1 text-sm text-foreground truncate">{t.label}</span>
                <Show when={overriddenDomains(t.id).length}>
                  <span class="text-xs text-muted-foreground/60">
                    {overriddenDomains(t.id).length} sites
                  </span>
                </Show>
                <button
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => deleteType(t.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </For>
          <Show when={!props.settings.customTypes.length}>
            <p class="text-sm text-muted-foreground/60">No custom groups yet.</p>
          </Show>
        </div>
        <div class="flex gap-2 mt-3">
          <input
            class="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            placeholder="New group name"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
          />
          <button
            class="px-3 py-2 text-sm bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors disabled:opacity-40"
            disabled={!newName().trim()}
            onClick={addType}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the section in `SettingsPanel.tsx`**

In `apps/extension/components/SettingsPanel.tsx`:

1. Add to the `SettingsSection` union: `| "content-types"`.
2. Add to `navGroups` in the same group as `storage`/`domains`:

```ts
      { key: "content-types", label: "Content Types" },
```

3. Import the panel near the other settings imports:

```ts
import ContentTypesPanel from "./settings/ContentTypesPanel";
```

4. Add the render block alongside the other `<Show when={activeSection() === …}>` blocks (mirror how `storage` renders `<SyncConfigPanel settings={s()} save={save} />`):

```tsx
                <Show when={activeSection() === "content-types"}>
                  <ContentTypesPanel settings={s()} save={save} />
                </Show>
```

> Verify the local settings signal is named `s` and the saver `save` in this file (the `storage` section uses `<SyncConfigPanel settings={s()} save={save} />`). Match those exact names.

- [ ] **Step 3: Type-check + tests + build**

Run: `cd apps/extension && pnpm compile && pnpm exec vitest run && pnpm exec wxt build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/components/settings/ContentTypesPanel.tsx apps/extension/components/SettingsPanel.tsx
git commit -m "feat(settings): Content Types panel (default capture types + custom groups)"
```

---

## Phase 6: Verification & version

### Task 12: Full verification + version bump

**Files:**
- Modify: `apps/extension/package.json` (version)

- [ ] **Step 1: Run the whole suite + build**

Run: `cd apps/extension && pnpm compile && pnpm exec vitest run && pnpm exec wxt build`
Expected: compile clean; all tests pass (147 + media-types + capture-filter + type-index); build succeeds.

- [ ] **Step 2: Bump the version**

In `apps/extension/package.json`, bump `"version"` to the next patch (e.g. `0.4.0` for a feature). Rebuild:

Run: `cd apps/extension && pnpm exec wxt build && grep '"version"' .output/chrome-mv3/manifest.json`
Expected: manifest shows the new version.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/package.json
git commit -m "chore(extension): bump version for content types & type grouping"
```

- [ ] **Step 4: Manual in-browser review (user)**

Hand off for visual confirmation before merging to main:
1. Settings → Content Types: select default capture types; add a custom group.
2. Save all tabs → preview shows type chips; toggling narrows/re-includes; Save persists only selected.
3. Nav → Group by: Type → type sections with counts; one-off domains collapsed under "Other sites (N)".
4. Move to group from a card and from a nav domain row → confirm dialog shows blast-radius count; after confirm, the domain (and future items) route to that type.

---

## Self-Review (completed during plan authoring)

**Spec coverage:**
- Classifier / data model → Task 1; settings fields → Task 2. ✓
- Capture filtering (saved default + per-capture override; QUICK_CAPTURE) → Tasks 3–5. ✓
- Nav grouping (Domain|Type toggle, one-off collapse) → Tasks 6–8. ✓
- Move to group (whole-domain + confirm; custom types) → Tasks 9–10. ✓
- Settings management (default types, custom types, deletion cleanup) → Task 11. ✓
- Edge cases (unknown→other, deleted custom type→other, empty captureTypes=all, back-compat defaults) → covered in Tasks 1/2/6/11 tests + logic. ✓
- Testing focus on pure logic → media-types, capture-filter, type-index suites. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only forward references (`settings()` signal in Task 5, `openMoveDialog` in Task 8) are explicitly called out with interim values and resolved in the named later task.

**Type consistency:** `MediaTypeDef`, `TypeGroup`, `classifyDomain`/`classifyMediaType`, `buildTypeIndex`, `filterPreviewByTypes`/`presentTypeIds`, `includeUrlForCapture` are used with identical signatures across tasks. `navGroupBy` values `"domain"|"type"` consistent in types, AppSidebar, PageCollection. `captureTypes`/`domainTypeOverrides`/`customTypes` names consistent throughout.

**Note for executor:** Tasks 5, 7, 8, 10 all touch `PageCollection.tsx`/co-dependent components and compile cleanly only once their paired task lands — execute Phase tasks in order; do not gate a task's commit on a *neighbor's* call site that a later task introduces (the plan flags each such case).
