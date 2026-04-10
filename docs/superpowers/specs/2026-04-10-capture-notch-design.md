# Capture Notch — Floating Save Button

## Overview

A minimal floating button injected into every web page via content script, allowing one-click page capture without opening the extension popup. Lives in a Shadow DOM for complete style isolation.

## Problems Solved

- Saving a page requires clicking the extension icon in the toolbar — extra friction
- Power users want a persistent, always-visible save affordance
- No visual indicator on a page telling you whether it's already saved

## Architecture

A new WXT content script (`entrypoints/notch.ts`) that injects a Shadow DOM container into every page. All UI (notch, toast, onboarding tooltip) lives inside the shadow root with inline styles — no external CSS, no SolidJS, no framework dependencies. Pure vanilla TypeScript + DOM APIs.

Communication with the extension uses the existing message passing system (`browser.runtime.sendMessage`).

### Startup Flow

1. Read settings from `chrome.storage.local` — check `notchEnabled`, `notchSide`, `notchPositionY`
2. Read blocked domains from settings — if current URL is blocked, don't inject
3. Inject shadow DOM container
4. Send `IS_URL_SAVED` message to background to check if current page is already saved
5. Render notch with appropriate color (saved vs unsaved)
6. Check if onboarding has been dismissed — if not, show tooltip

### Style Isolation

All styles are inline within the shadow DOM. No Tailwind classes, no external stylesheets. This prevents:
- Page CSS from affecting the notch
- Notch CSS from leaking into the page
- CSP issues with external stylesheet loading

## Notch Element

### Idle State

- Thin tab: ~6px wide, ~40px tall
- Clings to the right (or left) viewport edge using `position: fixed`
- Semi-transparent dark background (`rgba(22, 22, 24, 0.8)`)
- Rounded corners on the exposed side (e.g., `border-radius: 6px 0 0 6px` for right edge)
- **Unsaved pages:** Neutral dark color
- **Saved pages:** Brand gradient (sky-500 → indigo-600) indicating "already captured"

### Hover State

- Expands to ~32px wide with smooth transition (~200ms)
- Reveals a simple icon (bookmark or plus icon, rendered as inline SVG)
- Cursor changes to pointer
- Slight opacity increase

### Click Behavior

- **If not saved:** Sends `CAPTURE_PAGE` message to background with the browser tab ID. Notch briefly shows a checkmark animation. Toast appears confirming the save.
- **If already saved:** Toast appears with "Already saved" message and "View Details" link.
- Click is debounced to prevent double-saves

### Drag Behavior

- `mousedown` on the notch initiates drag mode
- `mousemove` updates vertical position (`top` style)
- `mouseup` ends drag, stores position as percentage in `chrome.storage.local` (`notchPositionY`)
- Position is clamped so the notch never goes offscreen (10% to 90% of viewport height)
- Short clicks (< 200ms, < 5px movement) are treated as clicks, not drags
- Position persists across pages and browser sessions

## Toast

A self-contained notification that slides in from the same edge as the notch.

### Appearance

- Small rounded card, dark background matching the notch
- Positioned near the notch vertically, offset horizontally so it doesn't overlap
- Slides in with a smooth animation (~300ms)

### Content

- **After save:** "Saved to Tab Zen" with a "View Details" link
- **If already saved:** "Already saved" with a "View Details" link
- **On error:** "Could not save" (no link)

### Behavior

- Auto-dismisses after 4 seconds
- "View Details" opens `chrome-extension://<id>/index.html#/page/<pageId>` in a new tab (or focuses existing SPA tab using the same tab-reuse pattern as the popup)
- Dismisses immediately when "View Details" is clicked

## Onboarding Tooltip

### When it shows

On the very first page load where the notch appears (when `notchOnboardingDismissed` is not set in `chrome.storage.local`).

### Appearance

- Speech bubble with a subtle pointer/arrow aimed at the notch
- Dark background, consistent with the notch styling
- Text: "Click to save pages to Tab Zen. Drag to reposition."
- "Got it" button

### Behavior

- Clicking "Got it" dismisses the tooltip and sets `notchOnboardingDismissed: true` in `chrome.storage.local`
- Tooltip does not reappear after dismissal
- Tooltip auto-dismisses after 10 seconds if not interacted with (also sets the flag)

## Settings

### New Settings fields (in `lib/types.ts`)

```typescript
notchEnabled: boolean        // default: true
notchSide: "left" | "right"  // default: "right"
```

### Separate storage (not in Settings — per-device UI state)

```
notchPositionY: number       // default: 50 (percentage from top)
notchOnboardingDismissed: boolean  // default: false
```

These are stored directly in `chrome.storage.local` outside the settings object because they're device-specific UI state, not user preferences that should sync.

### Settings UI

In the General tab of SettingsPanel, a new section:

**Capture Button**
- Toggle: "Show capture button on pages" (controls `notchEnabled`)
- Selector: "Button position" — Left / Right (controls `notchSide`)

The notch content script watches for storage changes and updates in real-time when settings change (no page reload needed).

## Blocked Domain Handling

The notch reads the `blockedDomains` list from settings. If the current page's domain is on the list, the notch is not injected. This reuses the existing `shouldSkipUrl` logic (or a simplified version of it for the content script context).

## File Structure

- `entrypoints/notch.ts` — WXT content script definition + all notch logic
- Modify: `lib/types.ts` — Add `notchEnabled` and `notchSide` to Settings
- Modify: `components/SettingsPanel.tsx` — Add capture button settings section

No new components, no new CSS files. Everything is self-contained in the content script.

## What's NOT in scope

- Notch on extension pages (only injected on web pages)
- Customizing the notch icon or color
- Multiple notch actions (it only saves)
- Keyboard shortcut for the notch (existing Ctrl+Shift+S handles bulk capture)

## Testing Checklist

- [ ] Notch appears on a regular web page (right edge, middle of viewport)
- [ ] Notch does not appear on blocked domain pages
- [ ] Hover expands the notch with icon visible
- [ ] Click saves the page — toast confirms "Saved to Tab Zen"
- [ ] Click on already-saved page shows "Already saved" toast
- [ ] "View Details" link in toast opens the SPA detail page
- [ ] Toast auto-dismisses after 4 seconds
- [ ] Drag moves the notch vertically, position persists across pages
- [ ] Notch stays within viewport bounds when window is resized
- [ ] Onboarding tooltip shows on first visit, dismisses with "Got it"
- [ ] Onboarding tooltip never shows again after dismissal
- [ ] Notch color changes for saved vs unsaved pages
- [ ] Settings toggle enables/disables the notch
- [ ] Settings side selector moves the notch to left/right edge
- [ ] Notch styles don't leak into the page
- [ ] Page styles don't affect the notch
