# Popup Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the extension popup to use a unified clickable tab card, visual spatial navigation, and streamlined header.

**Architecture:** Single-file rewrite of `apps/extension/entrypoints/popup/App.tsx`. Add one new message type (`IS_URL_SAVED`) to support already-saved detection. The popup uses Solid.js with Tailwind CSS.

**Tech Stack:** Solid.js, Tailwind CSS, Lucide icons (removing most), Chrome Extension APIs

---

### Task 1: Add IS_URL_SAVED message type

**Files:**
- Modify: `apps/extension/lib/messages.ts`
- Modify: `apps/extension/entrypoints/background.ts`

The popup needs to check if the current tab's URL is already saved so it can show the correct state (unsaved vs. saved/View Details). Currently no message type supports this.

- [ ] **Step 1: Add message types**

In `apps/extension/lib/messages.ts`, add to the `MessageRequest` union:

```typescript
| { type: "IS_URL_SAVED"; url: string }
```

Add to the `MessageResponse` union:

```typescript
| { type: "URL_SAVED"; saved: boolean; tabId?: string }
```

- [ ] **Step 2: Add handler in background.ts**

In `apps/extension/entrypoints/background.ts`, add the case to the message switch (near line 316, alongside other cases):

```typescript
case "IS_URL_SAVED":
  return handleIsUrlSaved(message.url);
```

Add the handler function (near the other handler functions around line 357):

```typescript
async function handleIsUrlSaved(url: string): Promise<MessageResponse> {
  try {
    const { normalizeUrl } = await import("@/lib/duplicates");
    const { getTabByUrl } = await import("@/lib/db");
    const tab = await getTabByUrl(normalizeUrl(url));
    return { type: "URL_SAVED", saved: !!tab, tabId: tab?.id };
  } catch {
    return { type: "URL_SAVED", saved: false };
  }
}
```

- [ ] **Step 3: Verify the extension builds**

Run: `cd apps/extension && pnpm build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/lib/messages.ts apps/extension/entrypoints/background.ts
git commit -m "feat(popup): add IS_URL_SAVED message type for saved-tab detection"
```

---

### Task 2: Rewrite popup App.tsx with new design

**Files:**
- Modify: `apps/extension/entrypoints/popup/App.tsx`

This is the main task — rewriting the popup component to match the new design. The new layout is:
1. Header: "Tab Zen" + "Save all (N)" text link
2. Unified clickable tab card (unsaved = greyed, saved = colored)
3. "Browse your collection" label
4. Visual spatial navigation (fullscreen + sidebar wireframes)

- [ ] **Step 1: Rewrite the popup component**

Replace the entire contents of `apps/extension/entrypoints/popup/App.tsx` with:

```tsx
import { createSignal, createResource, Show, createEffect } from "solid-js";
import { ShieldBan, Settings as SettingsIcon } from "lucide-solid";
import { sendMessage } from "@/lib/messages";
import { shouldSkipUrl } from "@/lib/duplicates";
import { getSettings } from "@/lib/settings";
import { getDomain } from "@/lib/domains";

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [captureResult, setCaptureResult] = createSignal<{
    saved: number;
    skipped: number;
  } | null>(null);
  const [saved, setSaved] = createSignal(false);
  const [savedTabId, setSavedTabId] = createSignal<string | undefined>();

  const [activeTab] = createResource(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return null;

    let ogTitle: string | null = null;
    let ogDescription: string | null = null;
    let ogImage: string | null = null;
    let creator: string | null = null;

    try {
      const response = await browser.tabs.sendMessage(tab.id!, {
        type: "GET_METADATA",
      });
      if (response) {
        ogTitle = response.ogTitle || null;
        ogDescription = response.ogDescription || null;
        ogImage = response.ogImage || null;
        creator = response.creator || null;
      }
    } catch {}

    // YouTube thumbnail fallback
    if (!ogImage && tab.url) {
      try {
        const u = new URL(tab.url);
        let videoId: string | null = null;
        if (u.hostname.includes("youtube.com"))
          videoId = u.searchParams.get("v");
        else if (u.hostname === "youtu.be") videoId = u.pathname.slice(1);
        if (videoId)
          ogImage = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      } catch {}
    }

    return {
      title: tab.title || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      id: tab.id!,
      ogTitle,
      ogDescription,
      ogImage,
      creator,
    };
  });

  const [uncapturedCount] = createResource(async () => {
    const response = await sendMessage({ type: "GET_UNCAPTURED_COUNT" });
    return response.type === "UNCAPTURED_COUNT" ? response.count : 0;
  });

  const domain = () => getDomain(activeTab()?.url || "");

  const [isBlocked] = createResource(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.url) return true;
    const settings = await getSettings();
    return shouldSkipUrl(tab.url, settings.blockedDomains);
  });

  const [syncError] = createResource(async () => {
    const settings = await getSettings();
    return settings.syncError || null;
  });

  // Check if this tab is already saved
  createEffect(async () => {
    const tab = activeTab();
    if (!tab?.url) return;
    const response = await sendMessage({ type: "IS_URL_SAVED", url: tab.url });
    if (response.type === "URL_SAVED" && response.saved) {
      setSaved(true);
      setSavedTabId(response.tabId);
    }
  });

  const handleCardClick = async () => {
    if (saved()) {
      // Navigate to detail page
      const tabId = savedTabId();
      if (tabId) {
        browser.tabs.create({
          url: browser.runtime.getURL(`/detail.html?tabId=${tabId}`),
        });
        window.close();
      }
    } else {
      // Save the tab
      const tab = activeTab();
      if (tab?.id) {
        await sendMessage({ type: "CAPTURE_SINGLE_TAB", tabId: tab.id });
        // Check for the saved tab ID so we can link to details
        const response = await sendMessage({
          type: "IS_URL_SAVED",
          url: tab.url,
        });
        if (response.type === "URL_SAVED" && response.saved) {
          setSavedTabId(response.tabId);
        }
        setSaved(true);
      }
    }
  };

  const handleCaptureAll = async () => {
    setCapturing(true);
    const response = await sendMessage({ type: "QUICK_CAPTURE" });
    if (response.type === "QUICK_CAPTURE_DONE") {
      setCaptureResult(response);
    }
    setCapturing(false);
  };

  const openSidePanel = async () => {
    const tab = activeTab();
    if (tab?.id) {
      await browser.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  };

  const openFullPage = () => {
    browser.tabs.create({ url: browser.runtime.getURL("/tabs.html") });
    window.close();
  };

  return (
    <div class="bg-background text-foreground p-4 w-[340px]">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-foreground">Tab Zen</h1>
        <button
          class="text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 px-2.5 py-1 rounded-lg transition-colors"
          onClick={handleCaptureAll}
          disabled={capturing() || uncapturedCount() === 0}
        >
          {capturing()
            ? "Saving..."
            : uncapturedCount() === 0
              ? "All saved"
              : `Save all (${uncapturedCount()})`}
        </button>
      </div>

      {/* Sync error banner */}
      <Show when={syncError()}>
        <div class="flex items-center gap-2 bg-red-500/10 rounded-lg px-3 py-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <p class="text-xs text-red-300 flex-1">{syncError()}</p>
          <button
            class="text-xs text-red-300 hover:text-red-200 transition-colors flex-shrink-0"
            onClick={() => {
              browser.tabs.create({
                url: browser.runtime.getURL("/tabs.html?settings=true"),
              });
              window.close();
            }}
          >
            Fix
          </button>
        </div>
      </Show>

      {/* Blocked domain notice */}
      <Show when={isBlocked()}>
        <div class="mb-4 bg-muted/30 rounded-xl p-4">
          <div class="flex items-center gap-3 mb-2">
            <ShieldBan size={18} class="text-muted-foreground flex-shrink-0" />
            <p class="text-sm text-foreground">This page won't be captured</p>
          </div>
          <p class="text-xs text-muted-foreground mb-3">
            {domain() || "This page"} is on the blocked list.
          </p>
          <button
            class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              browser.tabs.create({
                url: browser.runtime.getURL("/tabs.html?settings=true"),
              });
              window.close();
            }}
          >
            <SettingsIcon size={12} />
            Manage blocked domains
          </button>
        </div>
      </Show>

      {/* Unified tab card */}
      <Show when={!isBlocked() && activeTab()}>
        {(tab) => (
          <button
            class={`w-full text-left rounded-xl overflow-hidden mb-4 transition-all duration-200 ${
              saved()
                ? "bg-muted/30 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-lg"
                : "bg-muted/20 hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-lg"
            }`}
            onClick={handleCardClick}
          >
            {/* Thumbnail */}
            <div class="aspect-video overflow-hidden">
              {tab().ogImage ? (
                <img
                  src={tab().ogImage!}
                  alt=""
                  class={`w-full h-full object-cover object-top transition-all duration-500 ${
                    saved()
                      ? ""
                      : "grayscale brightness-75 hover:grayscale-[30%] hover:brightness-[0.85]"
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  class={`w-full h-full flex items-center justify-center ${
                    saved() ? "bg-muted/40" : "bg-muted/30"
                  }`}
                >
                  {(() => {
                    const fav = tab().favIconUrl;
                    const src =
                      fav && !fav.startsWith("chrome://")
                        ? fav
                        : domain()
                          ? `https://www.google.com/s2/favicons?domain=${domain()}&sz=32`
                          : "";
                    return src ? (
                      <img
                        src={src}
                        alt=""
                        class={`w-8 h-8 rounded transition-all duration-500 ${
                          saved() ? "" : "grayscale brightness-75"
                        }`}
                      />
                    ) : (
                      <span class="text-muted-foreground text-sm">
                        {domain()}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div class="p-3">
              <div class="flex gap-2.5 items-start">
                {(() => {
                  const fav = tab().favIconUrl;
                  const src =
                    fav && !fav.startsWith("chrome://")
                      ? fav
                      : domain()
                        ? `https://www.google.com/s2/favicons?domain=${domain()}&sz=32`
                        : "";
                  return src ? (
                    <img
                      src={src}
                      alt=""
                      class={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 transition-all duration-500 ${
                        saved() ? "" : "grayscale brightness-75"
                      }`}
                    />
                  ) : (
                    <div class="w-5 h-5 rounded-full bg-muted/50 mt-0.5 flex-shrink-0" />
                  );
                })()}
                <div class="flex-1 min-w-0">
                  <h3
                    class={`text-sm font-medium leading-snug line-clamp-2 transition-colors duration-300 ${
                      saved() ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {tab().ogTitle || tab().title}
                  </h3>
                  <p
                    class={`text-xs mt-1 transition-colors duration-300 ${
                      saved()
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {tab().creator || domain()}
                  </p>
                  <Show when={tab().ogDescription}>
                    <p
                      class={`text-xs mt-0.5 line-clamp-1 transition-colors duration-300 ${
                        saved()
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {tab().ogDescription}
                    </p>
                  </Show>
                </div>
              </div>

              {/* Action label */}
              <p
                class={`text-center text-sm mt-3 transition-colors duration-200 ${
                  saved()
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                {saved() ? "View Details →" : "Save Tab"}
              </p>
            </div>
          </button>
        )}
      </Show>

      {/* Capture result */}
      <Show when={captureResult()}>
        {(result) => (
          <div class="bg-muted/30 rounded-lg p-3 mb-3">
            <p class="text-sm text-foreground">
              Saved {result().saved} tabs
              {result().skipped > 0 &&
                ` (${result().skipped} duplicates skipped)`}
            </p>
          </div>
        )}
      </Show>

      {/* Visual navigation */}
      <p class="text-xs text-muted-foreground/50 mb-2.5">
        Browse your collection
      </p>
      <div class="flex gap-2.5">
        {/* Fullscreen nav */}
        <button
          class="flex-1 bg-muted/25 rounded-xl p-3 flex gap-1.5 h-[100px] transition-colors duration-200 hover:bg-[#141e30] group"
          onClick={openFullPage}
        >
          <div class="w-[24%] bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
          <div class="flex-1 grid grid-cols-2 grid-rows-2 gap-1.5">
            <div class="bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
            <div class="bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
            <div class="bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
            <div class="bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
          </div>
        </button>

        {/* Sidebar nav */}
        <button
          class="w-[80px] bg-muted/25 rounded-xl p-3 flex flex-col gap-1.5 h-[100px] transition-colors duration-200 hover:bg-[#141e30] group"
          onClick={openSidePanel}
        >
          <div class="flex-1 bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
          <div class="flex-1 bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
          <div class="flex-1 bg-muted/40 rounded-md transition-colors duration-200 group-hover:bg-sky-400" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the extension builds**

Run: `cd apps/extension && pnpm build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/entrypoints/popup/App.tsx
git commit -m "feat(popup): redesign with unified card, visual nav, streamlined header"
```

---

### Task 3: Apply hover grayscale transition to unsaved card

**Files:**
- Modify: `apps/extension/entrypoints/popup/App.tsx`

The card's unsaved state needs hover behavior where the grayscale lifts partially on hover (colors peek through). The Tailwind classes in Task 2 apply `grayscale` and `brightness-75` statically to the thumbnail, but the hover variant (`hover:grayscale-[30%]`) only applies when hovering the image itself — it needs to apply when hovering the parent card button.

- [ ] **Step 1: Update the thumbnail classes to use group-hover**

The parent `<button>` already has no `group` class. We need to give the card button a `group/card` class and use `group-hover/card:` for the thumbnail and text transitions.

In `apps/extension/entrypoints/popup/App.tsx`, update the card button's class to add `group/card`:

Change the card `<button>` class from:
```tsx
class={`w-full text-left rounded-xl overflow-hidden mb-4 transition-all duration-200 ${
  saved()
    ? "bg-muted/30 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-lg"
    : "bg-muted/20 hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-lg"
}`}
```

To:
```tsx
class={`group/card w-full text-left rounded-xl overflow-hidden mb-4 transition-all duration-200 ${
  saved()
    ? "bg-muted/30 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-lg"
    : "bg-muted/20 hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-lg"
}`}
```

Then update the `<img>` for the thumbnail (the ogImage branch) from:
```tsx
class={`w-full h-full object-cover object-top transition-all duration-500 ${
  saved()
    ? ""
    : "grayscale brightness-75 hover:grayscale-[30%] hover:brightness-[0.85]"
}`}
```

To:
```tsx
class={`w-full h-full object-cover object-top transition-all duration-500 ${
  saved()
    ? ""
    : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
}`}
```

Update the favicon in the thumbnail area from:
```tsx
class={`w-8 h-8 rounded transition-all duration-500 ${
  saved() ? "" : "grayscale brightness-75"
}`}
```

To:
```tsx
class={`w-8 h-8 rounded transition-all duration-500 ${
  saved() ? "" : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
}`}
```

Update the small favicon in the metadata area from:
```tsx
class={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 transition-all duration-500 ${
  saved() ? "" : "grayscale brightness-75"
}`}
```

To:
```tsx
class={`w-5 h-5 rounded-full mt-0.5 flex-shrink-0 transition-all duration-500 ${
  saved() ? "" : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
}`}
```

Update the title text from:
```tsx
class={`text-sm font-medium leading-snug line-clamp-2 transition-colors duration-300 ${
  saved() ? "text-foreground" : "text-muted-foreground"
}`}
```

To:
```tsx
class={`text-sm font-medium leading-snug line-clamp-2 transition-colors duration-300 ${
  saved() ? "text-foreground" : "text-muted-foreground group-hover/card:text-foreground/80"
}`}
```

Update the "Save Tab" action label from:
```tsx
class={`text-center text-sm mt-3 transition-colors duration-200 ${
  saved()
    ? "text-muted-foreground"
    : "text-muted-foreground/60"
}`}
```

To:
```tsx
class={`text-center text-sm mt-3 transition-colors duration-200 ${
  saved()
    ? "text-muted-foreground"
    : "text-muted-foreground/60 group-hover/card:text-foreground"
}`}
```

- [ ] **Step 2: Verify the extension builds**

Run: `cd apps/extension && pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Test in browser**

Load the extension in Chrome (`chrome://extensions` → Load unpacked → select `apps/extension/.output/chrome-mv3`).

Test these interactions:
1. Open popup on an unsaved page — card should be greyed/muted
2. Hover the card — colors should peek through, card lifts, "Save Tab" brightens
3. Click the card — should save, thumbnail transitions to full color, text says "View Details →"
4. Click again — should open the detail page
5. "Save all (N)" in header — should work as before
6. Visual nav hover — blocks should turn sky-400 blue
7. Click fullscreen nav — should open tabs.html
8. Click sidebar nav — should open side panel
9. Open popup on an already-saved page — should show colored card with "View Details →" immediately

- [ ] **Step 4: Commit**

```bash
git add apps/extension/entrypoints/popup/App.tsx
git commit -m "feat(popup): add group-hover transitions for unsaved card peek effect"
```

---

### Task 4: Clean up unused imports

**Files:**
- Modify: `apps/extension/entrypoints/popup/App.tsx`

After the rewrite, these imports from the old popup are no longer needed: `PanelRight`, `Maximize2`, `Kbd`, `formatTimeAgo`. The `Kbd` component itself (`apps/extension/components/Kbd.tsx`) should be kept since it may be used elsewhere — just remove the import from the popup.

- [ ] **Step 1: Verify Kbd is used elsewhere**

Run: `grep -r "Kbd" apps/extension --include="*.tsx" --include="*.ts" -l`

If Kbd.tsx is only imported by the popup, it's now dead code. Note this but don't delete it — it may be useful in settings or elsewhere later.

- [ ] **Step 2: Verify no other unused imports**

The rewrite in Task 2 should already have clean imports. Verify the file has no unused imports by checking the build output for warnings.

Run: `cd apps/extension && pnpm build 2>&1 | grep -i "unused\|import"`

- [ ] **Step 3: Commit if changes needed**

Only commit if there were actual cleanup changes:

```bash
git add apps/extension/entrypoints/popup/App.tsx
git commit -m "chore(popup): remove unused imports"
```
