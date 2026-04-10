export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    // --- Settings & State ---
    // WXT storage strips the "local:" prefix — raw key in chrome.storage.local is just "settings"
    const STORAGE_KEY = "settings";
    const NOTCH_POS_KEY = "notchPositionY";
    const ONBOARDING_KEY = "notchOnboardingDismissed";

    // Read settings
    const stored = await browser.storage.local.get([STORAGE_KEY, NOTCH_POS_KEY, ONBOARDING_KEY]) as Record<string, any>;
    const settings = (stored[STORAGE_KEY] || {}) as Record<string, any>;

    // Check if notch is enabled
    if (settings.notchEnabled === false) return;

    // Check blocked domains
    const blockedDomains: string[] = settings.blockedDomains || [];
    if (shouldSkip(window.location.href, blockedDomains)) return;

    // Skip extension pages
    if (window.location.protocol === "chrome-extension:" || window.location.protocol === "chrome:") return;

    const side: "left" | "right" = settings.notchSide || "right";
    let positionY: number = stored[NOTCH_POS_KEY] ?? 50;

    // Detect if page background is light or dark
    function isPageLight(): boolean {
      try {
        const bg = getComputedStyle(document.documentElement).backgroundColor || getComputedStyle(document.body).backgroundColor;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return true;
        const [, r, g, b] = match.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5;
      } catch {
        return true;
      }
    }
    let pageIsLight = isPageLight();
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
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        pointer-events: none;
        overflow: visible;
      }

      .notch-zone {
        position: fixed;
        ${side}: 0;
        top: ${positionY}%;
        transform: translateY(-50%);
        pointer-events: none;
        width: 110px;
        height: 160px;
        display: flex;
        align-items: center;
        ${side === "right" ? "justify-content: flex-end;" : "justify-content: flex-start;"}
      }

      .notch-zone .notch {
        pointer-events: auto;
      }

      .notch {
        position: static;
        width: 8px;
        height: 40px;
        background: var(--tz-notch-bg);
        border: 1px solid var(--tz-notch-border);
        ${side === "right" ? `border-right: none; border-radius: 8px 0 0 8px;` : `border-left: none; border-radius: 0 8px 8px 0;`}
        transition: width 0.15s ease, background 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        opacity: 0.85;
        cursor: pointer;
        box-shadow: var(--tz-notch-shadow);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .notch-icon {
        opacity: 0;
        transition: opacity 0.15s ease;
        color: var(--tz-notch-icon);
        display: flex;
        flex-shrink: 0;
      }

      .notch-zone:hover .notch-icon,
      .notch-zone.open .notch-icon {
        opacity: 1;
      }

      .notch.saved {
        background: linear-gradient(135deg, #34d399, #059669);
        border-color: rgba(52, 211, 153, 0.3);
      }

      .notch-zone:hover .notch,
      .notch-zone.open .notch {
        width: 36px;
        opacity: 1;
        box-shadow: var(--tz-notch-shadow-hover);
      }

      .notch.saving {
        opacity: 1;
      }

      /* Fan-out buttons */
      .fan-btn {
        position: absolute;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        border: 1px solid var(--tz-notch-border);
        background: var(--tz-notch-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--tz-notch-shadow);
        color: var(--tz-notch-icon);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.1s ease, transform 0.1s ease, background 0.15s ease, box-shadow 0.15s ease;
      }

      /* Positions relative to zone (150px tall, notch centered) */
      .fan-top {
        top: 0;
        ${side === "right" ? "right: 20px;" : "left: 20px;"}
        transform: translateY(6px);
      }

      .fan-side {
        top: 52px;
        ${side === "right" ? "right: 56px;" : "left: 56px;"}
        transform: translateX(${side === "right" ? "6px" : "-6px"});
      }

      .fan-bottom {
        bottom: 0;
        ${side === "right" ? "right: 20px;" : "left: 20px;"}
        transform: translateY(-6px);
      }

      .notch-zone.open .fan-btn {
        opacity: 1;
        pointer-events: auto;
        transform: translate(0, 0);
        transition: opacity 0.25s ease 0.05s, transform 0.25s ease 0.05s, background 0.15s ease, box-shadow 0.15s ease;
      }

      .notch-zone.open .fan-btn:hover {
        filter: brightness(1.15);
        box-shadow: var(--tz-notch-shadow-hover), 0 0 12px rgba(255,255,255,0.15);
      }

      .fan-btn.save-btn {
        background: linear-gradient(135deg, #a78bfa, #7c3aed);
        border-color: rgba(139, 92, 246, 0.3);
        color: white;
      }

      .fan-btn.save-btn.saved {
        background: linear-gradient(135deg, #34d399, #059669);
        border-color: rgba(52, 211, 153, 0.3);
        color: white;
      }

      .fan-btn.collections-btn {
        background: linear-gradient(135deg, #fbbf24, #d97706);
        border-color: rgba(245, 158, 11, 0.3);
        color: white;
      }

      .fan-btn.settings-btn {
        background: linear-gradient(135deg, #94a3b8, #475569);
        border-color: rgba(100, 116, 139, 0.3);
        color: white;
      }

      .toast {
        position: fixed;
        ${side}: 56px;
        top: ${positionY}%;
        transform: translateY(-50%) translateX(${side === "right" ? "20px" : "-20px"});
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        padding: 10px 14px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        max-width: 220px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
      }

      .toast.visible {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
        pointer-events: auto;
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
        ${side}: 56px;
        top: ${positionY}%;
        transform: translateY(-50%);
        background: #1e1e22;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 14px 16px;
        pointer-events: auto;
        max-width: 240px;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
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

    // SVG icons (14px for fan buttons)
    const bookmarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>`;
    const settingsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

    // Create notch (the slim bar)
    // Tab Zen logo
    const notchIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="23" viewBox="0 0 112 163" fill="none"><circle cx="85.0842" cy="85.0616" r="26" fill="currentColor"/><rect x="59" y="59" width="25" height="27" fill="currentColor"/><circle cx="85.0842" cy="26.0616" r="26" fill="currentColor" opacity="0.95"/><rect x="59" y="25" width="25" height="27" fill="currentColor" opacity="0.95"/><rect x="59" width="25" height="27" fill="currentColor" opacity="0.95"/><circle cx="26" cy="26.0616" r="26" transform="rotate(-180 26 26.0616)" fill="currentColor" opacity="0.6"/><rect x="52.0842" y="52.1233" width="25" height="27" transform="rotate(-180 52.0842 52.1233)" fill="currentColor" opacity="0.6"/><rect x="52.0842" y="27.1233" width="25" height="27" transform="rotate(-180 52.0842 27.1233)" fill="currentColor" opacity="0.6"/><rect y="0.00012207" width="52" height="162.026" rx="26" fill="currentColor" opacity="0.95"/><ellipse cx="26" cy="40.8998" rx="26" ry="40.8998" transform="rotate(-180 26 40.8998)" fill="currentColor" opacity="0.95"/><rect x="52.0842" y="42.5699" width="25" height="42.4729" transform="rotate(-180 52.0842 42.5699)" fill="currentColor" opacity="0.95"/><rect x="25.0842" y="162.123" width="25" height="42.4729" transform="rotate(-180 25.0842 162.123)" fill="currentColor" opacity="0.95"/></svg>`;

    const notch = document.createElement("div");
    notch.className = isSaved ? "notch saved" : "notch";
    notch.innerHTML = `<div class="notch-icon">${notchIconSvg}</div>`;

    // Fan-out buttons with CSS-only positioning
    const saveBtn = document.createElement("button");
    saveBtn.className = isSaved ? "fan-btn fan-top save-btn saved" : "fan-btn fan-top save-btn";
    saveBtn.innerHTML = isSaved ? checkSvg : bookmarkSvg;
    saveBtn.title = isSaved ? "View details" : "Save page";

    const collectionsBtn = document.createElement("button");
    collectionsBtn.className = "fan-btn fan-side collections-btn";
    collectionsBtn.innerHTML = gridSvg;
    collectionsBtn.title = "Collections";

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "fan-btn fan-bottom settings-btn";
    settingsBtn.innerHTML = settingsSvg;
    settingsBtn.title = "Settings";

    // Zone wraps everything — notch is the position anchor
    const zone = document.createElement("div");
    zone.className = "notch-zone";
    zone.appendChild(notch);
    zone.appendChild(saveBtn);
    zone.appendChild(collectionsBtn);
    zone.appendChild(settingsBtn);
    shadow.appendChild(zone);

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

    // --- Theme Detection & Live Update ---
    function applyTheme(light: boolean) {
      // Sky-500 base on light pages, lighter sky on dark pages
      host.style.setProperty("--tz-notch-bg", light ? "rgba(14, 165, 233, 0.9)" : "rgba(56, 189, 248, 0.85)");
      host.style.setProperty("--tz-notch-border", light ? "rgba(14, 165, 233, 0.4)" : "rgba(56, 189, 248, 0.3)");
      host.style.setProperty("--tz-notch-shadow", light ? "-2px 0 8px rgba(14, 165, 233, 0.25)" : "-2px 0 8px rgba(56, 189, 248, 0.15)");
      host.style.setProperty("--tz-notch-shadow-hover", light ? "-2px 0 14px rgba(14, 165, 233, 0.4)" : "-2px 0 14px rgba(56, 189, 248, 0.25)");
      host.style.setProperty("--tz-notch-icon", "white");
    }
    applyTheme(pageIsLight);

    // Watch for theme changes (class/attribute toggles on html/body)
    const themeObserver = new MutationObserver(() => {
      const nowLight = isPageLight();
      if (nowLight !== pageIsLight) {
        pageIsLight = nowLight;
        applyTheme(pageIsLight);
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-scheme", "style"] });

    // Also listen for system theme changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const nowLight = isPageLight();
      if (nowLight !== pageIsLight) {
        pageIsLight = nowLight;
        applyTheme(pageIsLight);
      }
    });

    // --- Toast Logic ---
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    let toastHovered = false;

    toast.addEventListener("mouseenter", () => {
      toastHovered = true;
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    });
    toast.addEventListener("mouseleave", () => {
      toastHovered = false;
      toastTimer = setTimeout(hideToast, 2000);
    });

    function showToast(message: string, pageId?: string) {
      toastText.textContent = message;
      if (pageId) {
        toastLink.style.display = "inline-block";
        toastLink.onclick = async (e) => {
          e.preventDefault();
          hideToast(true);
          // Use background to open/focus the SPA tab (content scripts can't reliably open extension URLs)
          const appUrl = browser.runtime.getURL("/index.html");
          try {
            await browser.runtime.sendMessage({
              type: "OPEN_EXTENSION_PAGE",
              url: `${appUrl}#/page/${pageId}`,
            });
          } catch {
            // Fallback
            window.open(`${appUrl}#/page/${pageId}`, "_blank");
          }
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

    function hideToast(force = false) {
      if (toastHovered && !force) return;
      toastHovered = false;
      toast.classList.remove("visible");
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    }

    // --- Fan Open/Close ---
    function openFan() {
      zone.classList.add("open");
    }

    function closeFan() {
      zone.classList.remove("open");
    }

    // --- Fan Button Handlers ---
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeFan();
      handleSaveClick();
    });

    collectionsBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeFan();
      const appUrl = browser.runtime.getURL("/index.html");
      try {
        await browser.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", url: `${appUrl}#/` });
      } catch {}
    });

    settingsBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeFan();
      const appUrl = browser.runtime.getURL("/index.html");
      try {
        await browser.runtime.sendMessage({ type: "OPEN_EXTENSION_PAGE", url: `${appUrl}#/settings` });
      } catch {}
    });

    // --- Drag Logic (notch bar only) ---
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
      zone.style.top = `${positionY}%`;
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;

      if (dragMoved) {
        // Save position
        browser.storage.local.set({ [NOTCH_POS_KEY]: positionY });
        return;
      }

      // Short click — toggle fan menu
      const elapsed = Date.now() - mouseDownTime;
      if (elapsed < 300) {
        zone.classList.contains("open") ? closeFan() : openFan();
      }
    });

    // Close fan when clicking outside
    document.addEventListener("click", (e) => {
      if (!host.contains(e.target as Node) && zone.classList.contains("open")) {
        closeFan();
      }
    });

    async function handleSaveClick() {
      if (isSaved) {
        // Navigate directly to detail page
        if (savedPageId) {
          const appUrl = browser.runtime.getURL("/index.html");
          try {
            await browser.runtime.sendMessage({
              type: "OPEN_EXTENSION_PAGE",
              url: `${appUrl}#/page/${savedPageId}`,
            });
          } catch {}
        }
        return;
      }

      // Show saving state
      notch.classList.add("saving");

      try {
        const response = await browser.runtime.sendMessage({ type: "CAPTURE_PAGE", tabId: -1 });
        if (response?.type === "ERROR") {
          showToast("Could not save");
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
        saveBtn.className = "fan-btn fan-top save-btn saved";
        saveBtn.innerHTML = checkSvg;
        saveBtn.title = "View details";
        showToast("Saved to Tab Zen", savedPageId);
      } catch {
        showToast("Could not save");
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

      // Pause auto-dismiss while hovered
      let tooltipHovered = false;
      let tooltipAutoTimer: ReturnType<typeof setTimeout> | null = null;

      tooltip.addEventListener("mouseenter", () => {
        tooltipHovered = true;
        if (tooltipAutoTimer) { clearTimeout(tooltipAutoTimer); tooltipAutoTimer = null; }
      });
      tooltip.addEventListener("mouseleave", () => {
        tooltipHovered = false;
        tooltipAutoTimer = setTimeout(dismissTooltip, 3000);
      });

      function dismissTooltip() {
        if (tooltipHovered) return;
        tooltip.classList.remove("visible");
        browser.storage.local.set({ [ONBOARDING_KEY]: true });
        setTimeout(() => { if (tooltip.isConnected) tooltip.remove(); }, 300);
      }

      // Show after a short delay
      setTimeout(() => tooltip.classList.add("visible"), 500);

      // Auto-dismiss after 10 seconds (unless hovered)
      tooltipAutoTimer = setTimeout(dismissTooltip, 10000);
    }

    // --- Viewport Resize Handling ---
    window.addEventListener("resize", () => {
      // Clamp position to viewport
      positionY = Math.max(10, Math.min(90, positionY));
      zone.style.top = `${positionY}%`;
    });

    // --- Settings Change Listener ---
    browser.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        const newSettings = (changes[STORAGE_KEY].newValue || {}) as Record<string, any>;
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
