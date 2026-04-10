# Capture Notch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A floating edge-notch button injected into every web page via content script, allowing one-click page capture with toast confirmation, drag-to-reposition, and onboarding tooltip.

**Architecture:** A new WXT content script (`entrypoints/notch.ts`) injects a Shadow DOM container with all UI. Pure vanilla TypeScript + DOM APIs — no SolidJS, no Tailwind. Communicates with background via `browser.runtime.sendMessage`. Settings stored in `chrome.storage.local`.

**Tech Stack:** WXT content script, Shadow DOM, vanilla TypeScript, Chrome Extension APIs

**Spec:** `docs/superpowers/specs/2026-04-10-capture-notch-design.md`

---

## File Structure

### New Files
- `apps/extension/entrypoints/notch.ts` — WXT content script with all notch UI logic (Shadow DOM injection, notch element, toast, onboarding tooltip, drag handling, settings sync)

### Modified Files
- `apps/extension/lib/types.ts` — Add `notchEnabled` and `notchSide` to Settings interface and DEFAULT_SETTINGS

### Note on SettingsPanel
The settings UI for the notch (enable/disable toggle and side selector) will be added in a separate task after the core notch is working. This keeps the content script work self-contained.

---

## Task 1: Add notch settings fields

**Files:**
- Modify: `apps/extension/lib/types.ts`

- [ ] **Step 1: Add notchEnabled and notchSide to Settings interface**

In `apps/extension/lib/types.ts`, add after `autoChapters: boolean;` (line 27):

```typescript
notchEnabled: boolean;
notchSide: "left" | "right";
```

- [ ] **Step 2: Add defaults to DEFAULT_SETTINGS**

In the `DEFAULT_SETTINGS` constant, add after `autoChapters: true,` (line 75):

```typescript
notchEnabled: true,
notchSide: "right",
```

- [ ] **Step 3: Commit**

```bash
git add apps/extension/lib/types.ts
git commit -m "feat: add notchEnabled and notchSide settings"
```

---

## Task 2: Create the notch content script

**Files:**
- Create: `apps/extension/entrypoints/notch.ts`

This is the main task — a single self-contained file with all notch functionality. The content script is structured as distinct sections: styles, DOM creation, state management, event handlers.

- [ ] **Step 1: Create the content script with Shadow DOM setup**

Create `apps/extension/entrypoints/notch.ts` with the full implementation:

```typescript
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    // --- Settings & State ---
    const STORAGE_KEY = "local:settings";
    const NOTCH_POS_KEY = "notchPositionY";
    const ONBOARDING_KEY = "notchOnboardingDismissed";

    // Read settings
    const stored = await browser.storage.local.get([STORAGE_KEY, NOTCH_POS_KEY, ONBOARDING_KEY]);
    const settings = stored[STORAGE_KEY] || {};

    // Check if notch is enabled
    if (settings.notchEnabled === false) return;

    // Check blocked domains
    const blockedDomains: string[] = settings.blockedDomains || [];
    if (shouldSkip(window.location.href, blockedDomains)) return;

    // Skip extension pages
    if (window.location.protocol === "chrome-extension:" || window.location.protocol === "chrome:") return;

    const side: "left" | "right" = settings.notchSide || "right";
    let positionY: number = stored[NOTCH_POS_KEY] ?? 50;
    let isSaved = false;
    let savedPageId: string | undefined;

    // Check if current URL is already saved
    try {
      const response = await browser.runtime.sendMessage({ type: "IS_URL_SAVED", url: window.location.href });
      if (response?.type === "URL_SAVED" && response.saved) {
        isSaved = true;
        savedPageId = response.pageId;
      }
    } catch {}

    // --- Styles ---
    const styles = `
      :host {
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483647;
        pointer-events: none;
      }

      .notch {
        position: fixed;
        ${side}: 0;
        top: ${positionY}%;
        transform: translateY(-50%);
        width: 6px;
        height: 40px;
        background: var(--notch-bg);
        ${side === "right" ? "border-radius: 6px 0 0 6px;" : "border-radius: 0 6px 6px 0;"}
        cursor: pointer;
        transition: width 0.2s ease, background 0.2s ease, opacity 0.2s ease;
        opacity: 0.6;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        --notch-bg: rgba(22, 22, 24, 0.8);
        --notch-bg-saved: linear-gradient(135deg, #0ea5e9, #6366f1);
      }

      .notch.saved {
        background: var(--notch-bg-saved);
        opacity: 0.7;
      }

      .notch:hover {
        width: 32px;
        opacity: 1;
      }

      .notch-icon {
        width: 16px;
        height: 16px;
        opacity: 0;
        transition: opacity 0.2s ease;
        flex-shrink: 0;
        color: white;
      }

      .notch:hover .notch-icon {
        opacity: 1;
      }

      .notch.saving {
        width: 32px;
        opacity: 1;
      }

      .toast {
        position: fixed;
        ${side}: 40px;
        top: ${positionY}%;
        transform: translateY(-50%) translateX(${side === "right" ? "20px" : "-20px"});
        background: rgba(22, 22, 24, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 10px 14px;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        max-width: 220px;
      }

      .toast.visible {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
      }

      .toast-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: rgba(223, 223, 214, 0.9);
        margin: 0;
        line-height: 1.4;
      }

      .toast-link {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        color: #38bdf8;
        text-decoration: none;
        cursor: pointer;
        margin-top: 4px;
        display: inline-block;
      }

      .toast-link:hover {
        color: #7dd3fc;
      }

      .tooltip {
        position: fixed;
        ${side}: 44px;
        top: ${positionY}%;
        transform: translateY(-50%);
        background: rgba(22, 22, 24, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px 16px;
        pointer-events: auto;
        max-width: 240px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .tooltip.visible {
        opacity: 1;
      }

      .tooltip-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        color: rgba(223, 223, 214, 0.8);
        margin: 0 0 10px 0;
        line-height: 1.5;
      }

      .tooltip-btn {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: #0ea5e9;
        background: rgba(14, 165, 233, 0.1);
        border: none;
        border-radius: 6px;
        padding: 6px 14px;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .tooltip-btn:hover {
        background: rgba(14, 165, 233, 0.2);
      }
    `;

    // --- DOM Creation ---
    const host = document.createElement("div");
    host.id = "tab-zen-notch";
    const shadow = host.attachShadow({ mode: "closed" });

    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    shadow.appendChild(styleEl);

    // Bookmark SVG icon
    const bookmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    // Create notch
    const notch = document.createElement("div");
    notch.className = isSaved ? "notch saved" : "notch";

    const icon = document.createElement("div");
    icon.className = "notch-icon";
    icon.innerHTML = isSaved ? checkSvg : bookmarkSvg;
    notch.appendChild(icon);
    shadow.appendChild(notch);

    // Create toast (hidden initially)
    const toast = document.createElement("div");
    toast.className = "toast";

    const toastText = document.createElement("p");
    toastText.className = "toast-text";
    toast.appendChild(toastText);

    const toastLink = document.createElement("a");
    toastLink.className = "toast-link";
    toastLink.textContent = "View Details";
    toast.appendChild(toastLink);
    shadow.appendChild(toast);

    document.body.appendChild(host);

    // --- Toast Logic ---
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    function showToast(message: string, pageId?: string) {
      toastText.textContent = message;
      if (pageId) {
        toastLink.style.display = "inline-block";
        toastLink.onclick = (e) => {
          e.preventDefault();
          const url = browser.runtime.getURL(`/index.html#/page/${pageId}`);
          window.open(url, "_blank");
          hideToast();
        };
      } else {
        toastLink.style.display = "none";
      }
      // Update position to match current notch position
      toast.style.top = `${positionY}%`;
      requestAnimationFrame(() => toast.classList.add("visible"));
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 4000);
    }

    function hideToast() {
      toast.classList.remove("visible");
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    }

    // --- Click & Drag Logic ---
    let isDragging = false;
    let dragStartY = 0;
    let dragStartPos = 0;
    let dragMoved = false;
    let mouseDownTime = 0;

    notch.addEventListener("mousedown", (e: MouseEvent) => {
      isDragging = true;
      dragStartY = e.clientY;
      dragStartPos = positionY;
      dragMoved = false;
      mouseDownTime = Date.now();
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = e.clientY - dragStartY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      if (Math.abs(deltaY) > 5) dragMoved = true;
      positionY = Math.max(10, Math.min(90, dragStartPos + deltaPercent));
      notch.style.top = `${positionY}%`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;

      if (dragMoved) {
        // Save position
        browser.storage.local.set({ [NOTCH_POS_KEY]: positionY });
        return;
      }

      // Short click — handle as save action
      const elapsed = Date.now() - mouseDownTime;
      if (elapsed < 300) {
        handleClick();
      }
    });

    async function handleClick() {
      if (isSaved) {
        showToast("Already saved", savedPageId);
        return;
      }

      // Show saving state
      notch.classList.add("saving");
      icon.innerHTML = checkSvg;

      try {
        // Get current tab ID via background
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error("No active tab");

        const response = await browser.runtime.sendMessage({ type: "CAPTURE_PAGE", tabId: tab.id });
        if (response?.type === "ERROR") {
          showToast("Could not save");
          icon.innerHTML = bookmarkSvg;
          notch.classList.remove("saving");
          return;
        }

        // Get the saved page ID
        const urlCheck = await browser.runtime.sendMessage({ type: "IS_URL_SAVED", url: window.location.href });
        if (urlCheck?.type === "URL_SAVED" && urlCheck.saved) {
          savedPageId = urlCheck.pageId;
        }

        isSaved = true;
        notch.className = "notch saved";
        showToast("Saved to Tab Zen", savedPageId);
      } catch {
        showToast("Could not save");
        icon.innerHTML = bookmarkSvg;
        notch.classList.remove("saving");
      }
    }

    // --- Onboarding Tooltip ---
    const onboardingDismissed = stored[ONBOARDING_KEY] === true;

    if (!onboardingDismissed) {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";

      const tooltipText = document.createElement("p");
      tooltipText.className = "tooltip-text";
      tooltipText.textContent = "Click to save pages to Tab Zen. Drag to reposition.";
      tooltip.appendChild(tooltipText);

      const tooltipBtn = document.createElement("button");
      tooltipBtn.className = "tooltip-btn";
      tooltipBtn.textContent = "Got it";
      tooltipBtn.onclick = () => {
        tooltip.classList.remove("visible");
        browser.storage.local.set({ [ONBOARDING_KEY]: true });
        setTimeout(() => tooltip.remove(), 300);
      };
      tooltip.appendChild(tooltipBtn);
      shadow.appendChild(tooltip);

      // Show after a short delay
      setTimeout(() => tooltip.classList.add("visible"), 500);

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (tooltip.isConnected) {
          tooltip.classList.remove("visible");
          browser.storage.local.set({ [ONBOARDING_KEY]: true });
          setTimeout(() => { if (tooltip.isConnected) tooltip.remove(); }, 300);
        }
      }, 10000);
    }

    // --- Viewport Resize Handling ---
    window.addEventListener("resize", () => {
      // Clamp position to viewport
      positionY = Math.max(10, Math.min(90, positionY));
      notch.style.top = `${positionY}%`;
    });

    // --- Settings Change Listener ---
    browser.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        const newSettings = changes[STORAGE_KEY].newValue || {};
        // Check if notch was disabled
        if (newSettings.notchEnabled === false) {
          host.remove();
          return;
        }
        // Check if side changed
        if (newSettings.notchSide && newSettings.notchSide !== side) {
          // Reload to re-inject with new side (simplest approach)
          host.remove();
        }
      }
    });

    // --- Helper: Domain Blocking ---
    function shouldSkip(url: string, blocked: string[]): boolean {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") return true;
        const domain = u.hostname.replace("www.", "").toLowerCase();
        return blocked.some((b) => {
          const nb = b.replace("www.", "").toLowerCase();
          return domain === nb || domain.endsWith("." + nb);
        });
      } catch {
        return true;
      }
    }
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/entrypoints/notch.ts
git commit -m "feat: add capture notch content script with shadow DOM, toast, drag, onboarding"
```

---

## Task 3: Add notch settings UI

**Files:**
- Modify: `apps/extension/components/SettingsPanel.tsx`

- [ ] **Step 1: Add capture button section in the General tab**

In `SettingsPanel.tsx`, find the General tab section. After the existing "Browser / Profile Name" field (after the closing `</div>` of that field block, around line 138), add:

```tsx
<div class="pt-4 border-t border-muted-foreground/10">
  <div class="flex items-center justify-between mb-3">
    <div>
      <p class="text-sm text-foreground">Capture button on pages</p>
      <p class="text-xs text-muted-foreground mt-0.5">Show a floating save button on every web page</p>
    </div>
    <button
      class={`w-10 h-6 rounded-full transition-colors ${
        s().notchEnabled ? "bg-sky-500" : "bg-muted/60"
      }`}
      onClick={() => save({ notchEnabled: !s().notchEnabled })}
    >
      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
        s().notchEnabled ? "translate-x-4" : "translate-x-0"
      }`} />
    </button>
  </div>
  <Show when={s().notchEnabled}>
    <div>
      <label class="block text-sm text-muted-foreground mb-1.5">
        Button position
      </label>
      <div class="flex gap-2">
        <button
          class={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            s().notchSide === "left"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() => save({ notchSide: "left" })}
        >
          Left
        </button>
        <button
          class={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            s().notchSide === "right"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() => save({ notchSide: "right" })}
        >
          Right
        </button>
      </div>
    </div>
  </Show>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/extension/components/SettingsPanel.tsx
git commit -m "feat: add capture button toggle and side selector in settings"
```

---

## Task 4: Build verification

**Files:** Various (fix any compilation errors)

- [ ] **Step 1: Run TypeScript compilation**

```bash
cd apps/extension && pnpm run compile
```

Fix any type errors.

- [ ] **Step 2: Run the build**

```bash
pnpm run build
```

Fix any build errors. Verify the output includes a `notch.js` content script.

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Fix any test failures.

- [ ] **Step 4: Verify manifest**

Check `.output/chrome-mv3/manifest.json` to confirm the notch content script is registered with `matches: ["<all_urls>"]` and `run_at: "document_idle"`.

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve any build errors from capture notch feature"
```
