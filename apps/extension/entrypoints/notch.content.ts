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
        ${side}: 2px;
        top: ${positionY}%;
        transform: translateY(-50%);
        width: 12px;
        height: 56px;
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.5), rgba(99, 102, 241, 0.5));
        ${side === "right" ? "border-radius: 8px 0 0 8px;" : "border-radius: 0 8px 8px 0;"}
        cursor: pointer;
        transition: width 0.2s ease, background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
        opacity: 0.7;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        box-shadow: -2px 0 8px rgba(14, 165, 233, 0.15);
      }

      .notch.saved {
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        opacity: 0.85;
      }

      .notch:hover {
        width: 36px;
        opacity: 1;
        box-shadow: -2px 0 12px rgba(14, 165, 233, 0.3);
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
        // Content scripts can't access browser.tabs — send message and let
        // background use sender.tab.id when tabId is -1
        const response = await browser.runtime.sendMessage({ type: "CAPTURE_PAGE", tabId: -1 });
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
