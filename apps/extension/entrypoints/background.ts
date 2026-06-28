import { v4 as uuidv4 } from "uuid";
import {
  getAllPages,
  getAllGroups,
  getAllData,
  addPages,
  addGroups,
  addCapture,
  updatePage,
  getPage,
  getPageByUrl,
  searchPages,
  importData,
  purgeDeletedPages,
  getAllTags,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normalizeUrl, buildUrlSet, isDuplicate, shouldSkipUrl } from "@/lib/duplicates";
import { closeableCapturedTabIds, duplicateTabIdsToClose } from "@/lib/tab-status";
import { includeUrlForCapture } from "@/lib/media-types";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { CURRENT_CONTENT_VERSION } from "@/lib/page-extract";
import { isInjectableTab, mapWithConcurrency, youtubeThumbnailUrl } from "@/lib/capture-utils";
import type { TranscriptSegment } from "@tab-zen/shared";
import { aiSearch, generateTags, generateChapters } from "@/lib/ai";
import { pushSync, pullSync, getRemoteStatus } from "@/lib/sync";
import { encrypt, decrypt } from "@/lib/crypto";
import { updateSettings } from "@/lib/settings";
import type {
  Page,
  Group,
  Capture,
  CapturePreviewData,
} from "@/lib/types";
import type { MessageRequest, MessageResponse } from "@/lib/messages";
import { seedTemplatesIfNeeded } from "@/lib/templates";
import { initDataLayer, refreshAdapterIfNeeded } from "@/lib/data-layer";
import { processEmbedQueue, countPendingEmbeds } from "@/lib/chat/embed-queue";

// Max number of tabs to extract from concurrently during capture. Keeps us from
// waking/flooding many background tabs (and their media) all at once.
const CAPTURE_EXTRACT_CONCURRENCY = 3;

// Guards the auto transcript queue so only one drain runs at a time. Module-level
// (not inside defineBackground) so the startup trigger can't reference it inside a
// temporal dead zone before it's initialized.
let transcriptQueueRunning = false;

export default defineBackground(() => {
  // --- Notify UI views of data changes ---
  function notifyDataChanged(): void {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {
      // No listeners - that's fine (no UI views open)
    });
    debouncedSyncPush();
  }

  // --- Sync ---
  let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSyncedAt = "1970-01-01T00:00:00Z";
  const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  async function isSyncActive(): Promise<boolean> {
    const settings = await getSettings();
    if (!settings.syncEnabled) return false;
    if (settings.syncError) return false; // Don't retry after auth failure
    const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
    return !!token;
  }

  async function syncPush(): Promise<void> {
    try {
      if (!(await isSyncActive())) return;

      const data = await getAllData();
      await pushSync({
        pages: data.pages,
        groups: data.groups,
        captures: data.captures,
        aiTemplates: data.aiTemplates,
        aiDocuments: data.aiDocuments,
        lastSyncedAt: new Date().toISOString(),
      });
      lastSyncedAt = new Date().toISOString();
      // Clear any previous sync error on success
      const currentSettings = await getSettings();
      if (currentSettings.syncError) {
        await updateSettings({ syncError: null });
        await updateBadge();
        browser.runtime.sendMessage({ type: "SYNC_ERROR_CLEARED" }).catch(() => {});
      }
    } catch (e) {
      const msg = String(e);
      console.warn("[TabZen] Sync push failed:", msg);
      if (msg.includes("401")) {
        await updateSettings({ syncError: "Sync token is invalid or expired. Reconnect in Settings." });
        browser.action.setBadgeText({ text: "!" });
        browser.action.setBadgeBackgroundColor({ color: "#ef4444" });
        browser.runtime.sendMessage({
          type: "SYNC_ERROR",
          message: "Sync token is invalid or expired. Reconnect in Settings.",
        }).catch(() => {});
      }
    }
  }

  function debouncedSyncPush(): void {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => syncPush(), 2000);
  }

  async function syncPullIfNeeded(): Promise<void> {
    try {
      if (!(await isSyncActive())) return;

      // Lightweight check: is there anything newer on the server?
      const remoteTimestamp = await getRemoteStatus();

      // If we got here without throwing, the token is valid - clear any error
      const currentSettings = await getSettings();
      if (currentSettings.syncError) {
        await updateSettings({ syncError: null });
        await updateBadge();
        browser.runtime.sendMessage({ type: "SYNC_ERROR_CLEARED" }).catch(() => {});
      }

      if (!remoteTimestamp || remoteTimestamp <= lastSyncedAt) {
        return;
      }

      // Server has newer data, do a full pull
      const remote = await pullSync(lastSyncedAt);
      if (remote && (remote.pages.length || remote.groups.length || remote.captures.length)) {
        const pages = remote.pages.map((t) => ({ ...t, starred: t.starred ?? false }));
        await importData({ pages, groups: remote.groups, captures: remote.captures });
        lastSyncedAt = remote.lastSyncedAt;
        if (remote.aiTemplates?.length) {
          const { putTemplates } = await import("@/lib/db");
          await putTemplates(remote.aiTemplates);
        }
        if (remote.aiDocuments?.length) {
          const { putDocuments } = await import("@/lib/db");
          await putDocuments(remote.aiDocuments);
        }
        // Notify UI without triggering another push
        browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
        await updateBadge();
      }
    } catch (e) {
      const msg = String(e);
      console.warn("[TabZen] Sync pull failed:", msg);
      if (msg.includes("401")) {
        await updateSettings({ syncError: "Sync token is invalid or expired. Reconnect in Settings." });
        browser.action.setBadgeText({ text: "!" });
        browser.action.setBadgeBackgroundColor({ color: "#ef4444" });
        browser.runtime.sendMessage({
          type: "SYNC_ERROR",
          message: "Sync token is invalid or expired. Reconnect in Settings.",
        }).catch(() => {});
      }
    }
  }

  // Auto-purge soft-deleted pages older than 30 days on startup
  purgeDeletedPages(30).catch((e) => console.warn("[TabZen] Auto-purge failed:", e));
  seedTemplatesIfNeeded().catch((e) => console.warn("[TabZen] Template seed failed:", e));

  // Initialize data layer (service adapter delegation)
  initDataLayer().catch((e) => console.warn("[TabZen] Data layer init failed:", e));

  // Backfill creator field for existing pages that don't have one
  (async () => {
    try {
      const { extractCreator } = await import("@/lib/domains");
      const pages = await getAllPages();
      let updated = 0;
      for (const page of pages) {
        if (!page.creator) {
          const creator = extractCreator(page);
          if (creator) {
            await updatePage(page.id, { creator });
            updated++;
          }
        }
      }
      if (updated > 0) {
        notifyDataChanged();
      }
    } catch (e) {
      console.warn("[TabZen] Creator backfill failed:", e);
    }
  })();

  // Pull on startup
  syncPullIfNeeded();

  // Drain any pending YouTube transcripts in the background (auto queue).
  processTranscriptQueue().catch((e) => console.warn("[TabZen] Transcript queue failed:", e));

  // Embed any pending content into the local knowledge base (rides behind the
  // transcript/content queues, since a page is only embeddable once it has content).
  processEmbedQueue().catch((e) => console.warn("[TabZen] Embed queue failed:", e));

  // Pull on interval (every 5 minutes) and refresh data layer adapter
  setInterval(() => {
    syncPullIfNeeded();
    refreshAdapterIfNeeded().catch((e) => console.warn("[TabZen] Adapter refresh failed:", e));
    // Resume the transcript queue in case a previous drain was interrupted
    // (e.g. the MV3 service worker was suspended mid-run).
    processTranscriptQueue().catch((e) => console.warn("[TabZen] Transcript queue failed:", e));
    // Resume the embed queue (safety net for an interrupted drain / new content).
    processEmbedQueue().catch((e) => console.warn("[TabZen] Embed queue failed:", e));
  }, SYNC_INTERVAL);

  // Pull when browser regains focus
  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== browser.windows.WINDOW_ID_NONE) {
      syncPullIfNeeded();
    }
  });

  // --- Auto-detect device ID and source label ---
  (async () => {
    const settings = await getSettings();
    const updates: Partial<typeof settings> = {};

    // Generate device ID if missing
    if (!settings.deviceId) {
      updates.deviceId = uuidv4();
    }

    // Auto-detect source label on first run
    if (settings.sourceLabel === "Chrome - Default") {
      try {
        const userInfo = await browser.identity.getProfileUserInfo({ accountStatus: "ANY" as any });
        if (userInfo.email) {
          const browserName = navigator.userAgent.includes("Edg/") ? "Edge"
            : navigator.userAgent.includes("OPR/") ? "Opera"
            : navigator.userAgent.includes("Brave") ? "Brave"
            : "Chrome";
          updates.sourceLabel = `${browserName} - ${userInfo.email}`;
        }
      } catch {
        // Could not detect profile email, using default
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateSettings(updates);
    }
  })();

  // --- Badge: Uncaptured tab count ---
  async function updateBadge(): Promise<void> {
    const settings = await getSettings();

    // Show error badge if sync has a problem
    if (settings.syncError) {
      await browser.action.setBadgeText({ text: "!" });
      await browser.action.setBadgeBackgroundColor({ color: "#ef4444" });
      return;
    }

    const existingPages = await getAllPages();
    const existingUrls = buildUrlSet(existingPages.map((p) => p.url));

    const openTabs = await browser.tabs.query({});
    let uncaptured = 0;
    for (const tab of openTabs) {
      if (
        tab.url &&
        !shouldSkipUrl(tab.url, settings.blockedDomains)
      ) {
        if (!isDuplicate(tab.url, existingUrls)) {
          uncaptured++;
        }
      }
    }

    if (uncaptured > 0) {
      await browser.action.setBadgeText({ text: String(uncaptured) });
      await browser.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    } else {
      await browser.action.setBadgeText({ text: "" });
    }
  }

  // Update badge on tab events
  browser.tabs.onCreated.addListener(() => updateBadge());
  browser.tabs.onRemoved.addListener(() => updateBadge());
  browser.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      updateBadge();
    }
  });

  // Initial badge update
  updateBadge();

  // --- Context Menu ---
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "save-tab-to-tabzen",
      title: "Save to Tab Zen",
      contexts: ["page", "link"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-tab-to-tabzen" && tab) {
      const url = info.linkUrl || tab.url;
      const title = tab.title || url || "Untitled";
      if (url) {
        await captureSingleTab(tab.id!, url, title, tab.favIconUrl || "");
      }
    }
  });

  // --- Keyboard shortcuts ---
  browser.commands.onCommand.addListener(async (command) => {
    if (command === "capture-all-tabs") {
      const preview = await buildCapturePreview();
      if (preview.pages.length > 0) {
        await confirmCapture(preview);
      }
    }
  });

  // --- Message handler ---
  browser.runtime.onMessage.addListener(
    (message: any, sender, sendResponse) => {
      // Handle untyped messages from content scripts
      if (message.type === "OPEN_EXTENSION_PAGE" && message.url) {
        (async () => {
          const appUrl = browser.runtime.getURL("/index.html");
          const existing = await browser.tabs.query({ url: `${appUrl}*` });
          if (existing.length > 0 && existing[0].id) {
            // Always set URL to force navigation (even if hash changes)
            await browser.tabs.update(existing[0].id, { url: message.url, active: true });
            if (existing[0].windowId) {
              await browser.windows.update(existing[0].windowId, { focused: true });
            }
          } else {
            await browser.tabs.create({ url: message.url });
          }
          sendResponse({ type: "SUCCESS" });
        })();
        return true;
      }
      handleMessage(message, sender).then(sendResponse);
      return true;
    },
  );

  async function handleMessage(
    message: MessageRequest,
    sender: Browser.runtime.MessageSender,
  ): Promise<MessageResponse> {
    switch (message.type) {
      case "CAPTURE_ALL_TABS":
        return handleCaptureAllTabs();
      case "CAPTURE_PAGE":
        return handleCapturePage(message.tabId === -1 && sender.tab?.id ? sender.tab.id : message.tabId);
      case "CONFIRM_CAPTURE":
        return handleConfirmCapture(message.captureData);
      case "GET_UNCAPTURED_COUNT":
        return handleGetUncapturedCount();
      case "SEARCH_PAGES":
        return handleSearchPages(message.query);
      case "AI_SEARCH":
        return handleAISearch(message.query);
      case "OPEN_PAGE":
        return handleOpenPage(message.pageId);
      case "GET_TRANSCRIPT":
        return handleGetTranscript(message.pageId);
      case "GET_CONTENT":
        return handleGetContent(message.pageId);
      case "RE_EXTRACT_CONTENT":
        return handleReExtractContent(message.pageId);
      case "BACKFILL_TRANSCRIPTS":
        return handleBackfillTranscripts();
      case "COUNT_MISSING_TRANSCRIPTS":
        return handleCountMissingTranscripts();
      case "INDEX_COLLECTION":
        return handleIndexCollection();
      case "COUNT_PENDING_EMBEDS":
        return handleCountPendingEmbeds();
      case "SYNC_NOW":
        return handleSyncNow();
      case "QUICK_CAPTURE":
        return handleQuickCapture();
      case "GET_METADATA":
        return handleGetMetadata(message.url);
      case "LOOKUP_PRODUCT":
        return handleLookupProduct(message.name);
      case "LOOKUP_WIKI_IMAGE":
        return handleLookupWikiImage(message.title);
      case "CAPTURE_URL":
        return handleCaptureUrl(message.url);
      case "IS_URL_SAVED":
        return handleIsUrlSaved(message.url);
      case "GET_CAPTURED_TABS_COUNT":
        return handleGetCapturedTabsCount();
      case "CLOSE_CAPTURED_TABS":
        return handleCloseCapturedTabs();
      case "GET_DUPLICATE_TABS_COUNT":
        return handleGetDuplicateTabsCount();
      case "CLOSE_DUPLICATE_TABS":
        return handleCloseDuplicateTabs();
      default:
        return { type: "ERROR", message: "Unknown message type" };
    }
  }

  async function handleCaptureAllTabs(): Promise<MessageResponse> {
    try {
      const preview = await buildCapturePreview();
      return { type: "CAPTURE_PREVIEW", data: preview };
    } catch (e) {
      console.error("[TabZen] Capture preview error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleCapturePage(
    browserTabId: number,
  ): Promise<MessageResponse> {
    try {
      const tab = await browser.tabs.get(browserTabId);
      if (!tab.url) return { type: "ERROR", message: "Tab has no URL" };
      await captureSingleTab(
        browserTabId,
        tab.url,
        tab.title || "Untitled",
        tab.favIconUrl || "",
      );
      await updateBadge();
      return { type: "SUCCESS" };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleConfirmCapture(
    captureData: CapturePreviewData,
  ): Promise<MessageResponse> {
    try {
      await confirmCapture(captureData);
      // Auto-fetch transcripts for the newly captured YouTube pages in the background.
      processTranscriptQueue().catch((e) => console.warn("[TabZen] Transcript queue failed:", e));
      // Embed any pages that already have content (transcript pages get embedded
      // on a later drain once their transcript lands).
      processEmbedQueue().catch((e) => console.warn("[TabZen] Embed queue failed:", e));
      return { type: "SUCCESS" };
    } catch (e) {
      console.error("[TabZen] Confirm capture error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleGetUncapturedCount(): Promise<MessageResponse> {
    const settings = await getSettings();
    const existingPages = await getAllPages();
    const existingUrls = buildUrlSet(existingPages.map((p) => p.url));
    const openTabs = await browser.tabs.query({});
    let count = 0;
    for (const tab of openTabs) {
      if (
        tab.url &&
        !shouldSkipUrl(tab.url, settings.blockedDomains)
      ) {
        if (!isDuplicate(tab.url, existingUrls)) {
          count++;
        }
      }
    }
    return { type: "UNCAPTURED_COUNT", count };
  }

  async function handleGetCapturedTabsCount(): Promise<MessageResponse> {
    try {
      const existingPages = await getAllPages();
      const capturedUrlSet = buildUrlSet(existingPages.map((p) => p.url));
      const tabs = await browser.tabs.query({});
      const count = closeableCapturedTabIds(tabs, capturedUrlSet).length;
      return { type: "CAPTURED_TABS_COUNT", count };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleCloseCapturedTabs(): Promise<MessageResponse> {
    try {
      const existingPages = await getAllPages();
      const capturedUrlSet = buildUrlSet(existingPages.map((p) => p.url));
      const tabs = await browser.tabs.query({});
      const ids = closeableCapturedTabIds(tabs, capturedUrlSet);
      if (ids.length) await browser.tabs.remove(ids);
      return { type: "CLOSE_CAPTURED_TABS_DONE", closed: ids.length };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleGetDuplicateTabsCount(): Promise<MessageResponse> {
    const tabs = await browser.tabs.query({});
    return { type: "DUPLICATE_TABS_COUNT", count: duplicateTabIdsToClose(tabs).length };
  }

  async function handleCloseDuplicateTabs(): Promise<MessageResponse> {
    try {
      const tabs = await browser.tabs.query({});
      const ids = duplicateTabIdsToClose(tabs);
      if (ids.length) await browser.tabs.remove(ids);
      return { type: "CLOSE_DUPLICATE_TABS_DONE", closed: ids.length };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleSearchPages(query: string): Promise<MessageResponse> {
    const pages = await searchPages(query);
    return { type: "SEARCH_RESULTS", pages };
  }

  async function handleAISearch(query: string): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      if (!settings.openRouterApiKey) {
        return { type: "ERROR", message: "OpenRouter API key not configured" };
      }
      const allPages = await getAllPages();
      const pageData = allPages.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        description: p.ogDescription || p.metaDescription,
        notes: p.notes,
      }));
      const matchingIds = await aiSearch(
        settings.openRouterApiKey,
        settings.aiModel,
        query,
        pageData,
      );
      const results = allPages.filter((p) => matchingIds.includes(p.id));
      return { type: "SEARCH_RESULTS", pages: results };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleOpenPage(pageId: string): Promise<MessageResponse> {
    const page = await getPage(pageId);
    if (!page) return { type: "ERROR", message: "Page not found" };

    const settings = await getSettings();
    if (settings.openMode === "current-tab") {
      // Find the active non-extension tab in the current window
      const allTabs = await browser.tabs.query({ currentWindow: true });
      const targetTab = allTabs.find(
        (t) => t.active && t.url && !t.url.startsWith("chrome-extension://") && !t.url.startsWith("chrome://"),
      ) || allTabs.find(
        (t) => t.url && !t.url.startsWith("chrome-extension://") && !t.url.startsWith("chrome://"),
      );

      if (targetTab?.id) {
        await browser.tabs.update(targetTab.id, { url: page.url, active: true });
      } else {
        await browser.tabs.create({ url: page.url });
      }
    } else {
      await browser.tabs.create({ url: page.url });
    }
    await updatePage(pageId, {
      viewCount: page.viewCount + 1,
      lastViewedAt: new Date().toISOString(),
    });
    notifyDataChanged();

    const updated = await getPage(pageId);
    return { type: "PAGE_OPENED", page: updated! };
  }

  // Shared single-page transcript fetch: already-open AWAKE tab → throwaway
  // (muted, background) tab → content API. Persists on success and returns the
  // segments (or null). Used by both the on-demand button and the bulk backfill.
  async function fetchAndStoreTranscript(page: Page): Promise<TranscriptSegment[] | null> {
    const persist = async (segments: TranscriptSegment[]) => {
      const { addPage } = await import("@/lib/db");
      // Re-read so a concurrent backfill doesn't clobber other fields.
      const current = (await getPage(page.id)) || page;
      await addPage({
        ...current,
        transcript: segments,
        contentKey: `transcripts/${page.id}`,
        contentType: "transcript",
        contentFetchedAt: new Date().toISOString(),
      });
      const { storeTranscriptToApi } = await import("@/lib/content-api");
      storeTranscriptToApi(page.id, segments).catch(() => {});
      notifyDataChanged();
    };

    if (isYouTubeWatchUrl(page.url)) {
      const { extractYouTubeTranscript, extractYouTubeTranscriptDirect } =
        await import("@/lib/youtube-extract");

      // Use an already-open AWAKE tab (fast, and never reloads a discarded tab).
      let awakeTabId: number | undefined;
      try {
        const openTabs = await browser.tabs.query({ url: page.url });
        awakeTabId = openTabs.find((t) => isInjectableTab(t))?.id;
      } catch {
        // tabs.query can throw when a stored URL isn't a valid match pattern; fall back.
      }
      if (awakeTabId != null) {
        try {
          const result = await extractYouTubeTranscript(awakeTabId, page.url);
          if (result?.hasTranscript) {
            await persist(result.segments);
            return result.segments;
          }
        } catch (e) {
          console.warn("[TabZen] Transcript extraction (open tab) failed:", e);
        }
      }

      // No awake tab — open a single throwaway (muted, background) tab, extract,
      // and close it. One at a time, so it can't cause the mass-reload lockup.
      try {
        const result = await extractYouTubeTranscriptDirect(page.url);
        if (result?.hasTranscript) {
          await persist(result.segments);
          return result.segments;
        }
      } catch (e) {
        console.warn("[TabZen] Transcript extraction (background tab) failed:", e);
      }
    }

    // Last resort: content-youtube API (only if a backend token is configured)
    const settings = await getSettings();
    const hasApi = settings.syncEnabled && (settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken);
    if (hasApi) {
      const { fetchTranscriptFromApi } = await import("@/lib/content-api");
      const segments = await fetchTranscriptFromApi(page.url);
      if (segments) {
        await persist(segments);
        return segments;
      }
    }

    return null;
  }

  async function handleGetTranscript(pageId: string): Promise<MessageResponse> {
    const page = await getPage(pageId);
    if (!page) return { type: "ERROR", message: "Page not found" };
    if (page.transcript) {
      return { type: "TRANSCRIPT", transcript: page.transcript };
    }
    const segments = await fetchAndStoreTranscript(page);
    return { type: "TRANSCRIPT", transcript: segments };
  }

  // Pages still waiting on a transcript: YouTube, no transcript yet, and the
  // queue hasn't already tried them (so caption-less videos aren't retried
  // forever). Also drives the "pending" indicator in the UI.
  function pendingTranscriptPages(pages: Page[]): Page[] {
    return pages.filter(
      (p) => !p.deletedAt && !p.transcript && !p.transcriptCheckedAt && isYouTubeWatchUrl(p.url),
    );
  }

  async function handleCountMissingTranscripts(): Promise<MessageResponse> {
    const count = pendingTranscriptPages(await getAllPages()).length;
    return { type: "MISSING_TRANSCRIPTS_COUNT", count };
  }

  // Mark that the queue attempted this page but found no transcript, so it stops
  // showing as pending and isn't retried automatically. Manual Fetch Transcript
  // ignores this flag, so the user can always force a retry.
  async function markTranscriptChecked(pageId: string): Promise<void> {
    const p = await getPage(pageId);
    if (p && !p.transcript) {
      await updatePage(pageId, { transcriptCheckedAt: new Date().toISOString() });
      notifyDataChanged();
    }
  }

  // Auto transcript queue: drains every pending YouTube page, a few at a time
  // via muted background tabs (never wakes/floods all tabs at once). Re-queries
  // each round so items captured mid-run get picked up; stops when none remain.
  // Guarded (module-level transcriptQueueRunning) so only one drain runs at a time.
  async function processTranscriptQueue(): Promise<{ fetched: number; failed: number; total: number }> {
    if (transcriptQueueRunning) return { fetched: 0, failed: 0, total: 0 };
    transcriptQueueRunning = true;
    let fetched = 0;
    let failed = 0;
    let total = 0;
    try {
      for (;;) {
        const targets = pendingTranscriptPages(await getAllPages());
        if (targets.length === 0) break;
        total += targets.length;
        console.log(`[TabZen] Transcript queue: draining ${targets.length} pending page(s)`);
        await mapWithConcurrency(targets, CAPTURE_EXTRACT_CONCURRENCY, async (page) => {
          try {
            const segments = await fetchAndStoreTranscript(page);
            if (segments) fetched++;
            else {
              await markTranscriptChecked(page.id);
              failed++;
            }
          } catch {
            await markTranscriptChecked(page.id);
            failed++;
          }
        });
      }
    } finally {
      transcriptQueueRunning = false;
    }
    if (total > 0) {
      console.log(`[TabZen] Transcript queue done: ${fetched} fetched, ${failed} without captions/failed (of ${total})`);
    }
    return { fetched, failed, total };
  }

  async function handleBackfillTranscripts(): Promise<MessageResponse> {
    const { fetched, failed, total } = await processTranscriptQueue();
    return { type: "BACKFILL_DONE", fetched, failed, total };
  }

  // Manual "Index existing collection" action: drain the embed queue now.
  async function handleIndexCollection(): Promise<MessageResponse> {
    const { embedded, failed, total } = await processEmbedQueue();
    return { type: "INDEX_DONE", embedded, failed, total };
  }

  async function handleCountPendingEmbeds(): Promise<MessageResponse> {
    const count = countPendingEmbeds(await getAllPages());
    return { type: "PENDING_EMBEDS_COUNT", count };
  }

  async function handleGetContent(pageId: string): Promise<MessageResponse> {
    const page = await getPage(pageId);
    if (!page) return { type: "ERROR", message: "Page not found" };

    // 1. Check if content is already stored locally
    if (page.content) {
      return { type: "CONTENT", content: page.content };
    }

    // 2. Try extracting from open browser tab
    const openTabs = await browser.tabs.query({ url: page.url });
    if (openTabs.length > 0 && openTabs[0].id) {
      try {
        const { extractPageContent } = await import("@/lib/page-extract");
        const result = await extractPageContent(openTabs[0].id, page.url);
        if (result) {
          const { addPage } = await import("@/lib/db");
          await addPage({
            ...page,
            content: result.content,
            contentKey: `content/${page.id}`,
            contentType: "markdown",
            contentFetchedAt: new Date().toISOString(),
          });
          notifyDataChanged();
          return { type: "CONTENT", content: result.content };
        }
      } catch (e) {
        console.warn("[TabZen] Page content extraction failed:", e);
      }
    }

    return { type: "CONTENT", content: null };
  }

  async function handleReExtractContent(pageId: string): Promise<MessageResponse> {
    const page = await getPage(pageId);
    if (!page) return { type: "ERROR", message: "Page not found" };

    const { extractPageContent, extractPageContentViaFetch, CURRENT_CONTENT_VERSION } = await import("@/lib/page-extract");

    let result = null;

    // 1. Try open browser tab first (best quality — gets JS-rendered content)
    const openTabs = await browser.tabs.query({ url: page.url });
    if (openTabs.length > 0 && openTabs[0].id) {
      try {
        result = await extractPageContent(openTabs[0].id, page.url);
      } catch (e) {
        console.warn("[TabZen] executeScript re-extraction failed, trying fetch:", e);
      }
    }

    // 2. Fall back to fetch (works without tab open)
    if (!result) {
      result = await extractPageContentViaFetch(page.url);
    }

    if (!result) {
      return { type: "ERROR", message: "Could not extract content from this page" };
    }

    // Update the page with new content and version
    const { addPage } = await import("@/lib/db");
    await addPage({
      ...page,
      content: result.content,
      contentKey: `content/${page.id}`,
      contentType: "markdown",
      contentFetchedAt: new Date().toISOString(),
      contentVersion: CURRENT_CONTENT_VERSION,
    });
    notifyDataChanged();

    return { type: "CONTENT", content: result.content };
  }

  async function handleSyncNow(): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      const activeToken = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;

      if (!activeToken) {
        return { type: "ERROR", message: "No sync token configured" };
      }

      // Push local data + settings
      const data = await getAllData();
      let pushed = data.pages.length;

      // Encrypt API key if present
      let encryptedApiKey: string | null = null;
      if (settings.openRouterApiKey && activeToken) {
        encryptedApiKey = await encrypt(settings.openRouterApiKey, activeToken);
      }

      await pushSync({
        pages: data.pages,
        groups: data.groups,
        captures: data.captures,
        settings: {
          aiModel: settings.aiModel,
          encryptedApiKey,
        },
        lastSyncedAt: new Date().toISOString(),
      });
      // Then pull remote data
      let pulled = 0;
      const remote = await pullSync("1970-01-01T00:00:00Z");
      if (remote) {
        if (remote.pages.length || remote.groups.length || remote.captures.length) {
          const pages = remote.pages.map((p) => ({ ...p, starred: p.starred ?? false }));
          const result = await importData({ pages, groups: remote.groups, captures: remote.captures });
          pulled = result.imported;
          if (pulled > 0) {
            browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
            await updateBadge();
          }
        }

        // Apply synced settings
        if (remote.settings && activeToken) {
          const updates: Record<string, string> = {};
          if (remote.settings.aiModel && remote.settings.aiModel !== settings.aiModel) {
            updates.aiModel = remote.settings.aiModel;
          }
          if (remote.settings.encryptedApiKey && !settings.openRouterApiKey) {
            try {
              updates.openRouterApiKey = await decrypt(remote.settings.encryptedApiKey, activeToken);
            } catch (e) {
              console.warn("[TabZen] Could not decrypt API key:", e);
            }
          }
          if (Object.keys(updates).length > 0) {
            await updateSettings(updates);
          }
        }

        lastSyncedAt = remote.lastSyncedAt;
      }

      lastSyncedAt = new Date().toISOString();
      return { type: "SYNC_COMPLETE", pushed, pulled };
    } catch (e) {
      console.error("[TabZen] Manual sync error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleQuickCapture(): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      const existingPages = await getAllPages();
      const existingUrls = buildUrlSet(existingPages.map((p) => p.url));
      const openTabs = await browser.tabs.query({});
      const captureId = uuidv4();

      // Filter new tabs
      const candidateTabs = openTabs.filter(
        (t) =>
          t.url &&
          !shouldSkipUrl(t.url!, settings.blockedDomains) &&
          !isDuplicate(t.url!, existingUrls) &&
          includeUrlForCapture(t.url!, settings.captureTypes, settings.domainTypeOverrides),
      );

      const seenUrls = new Set<string>();
      const newBrowserTabs = candidateTabs.filter((t) => {
        const normalized = normalizeUrl(t.url!);
        if (seenUrls.has(normalized)) return false;
        seenUrls.add(normalized);
        return true;
      });

      if (newBrowserTabs.length === 0) {
        return { type: "QUICK_CAPTURE_DONE", saved: 0, skipped: 0 };
      }

      // Pass 1: Instant save with basic data + domain grouping
      // Reuse existing non-archived groups for the same domain
      const existingGroups = await getAllGroups();
      const byDomain = new Map<string, { groupId: string; pages: Page[]; isExisting: boolean }>();

      // Pre-populate with existing groups
      for (const g of existingGroups) {
        if (!g.archived && !byDomain.has(g.name)) {
          byDomain.set(g.name, { groupId: g.id, pages: [], isExisting: true });
        }
      }

      const pages: Page[] = newBrowserTabs.map((bt) => {
        const domain = (() => {
          try { return new URL(bt.url!).hostname.replace("www.", ""); }
          catch { return "Other"; }
        })();

        if (!byDomain.has(domain)) {
          byDomain.set(domain, { groupId: uuidv4(), pages: [], isExisting: false });
        }
        const group = byDomain.get(domain)!;

        const page: Page = {
          id: uuidv4(),
          url: bt.url!,
          title: bt.title || "Untitled",
          favicon: bt.favIconUrl || "",
          ogTitle: null,
          ogDescription: null,
          ogImage: isYouTubeWatchUrl(bt.url!) ? youtubeThumbnailUrl(bt.url!) : null,
          metaDescription: null,
          creator: null,
          creatorAvatar: null,
          creatorUrl: null,
          publishedAt: null,
          tags: [],
          notes: null,
          viewCount: 0,
          lastViewedAt: null,
          capturedAt: new Date().toISOString(),
          sourceLabel: settings.sourceLabel,
          deviceId: settings.deviceId,
          archived: false,
          starred: false,
          deletedAt: null,
          groupId: group.groupId,
          contentKey: null,
          contentType: null,
          contentFetchedAt: null,
        };
        group.pages.push(page);
        return page;
      });

      // Only create groups that don't already exist
      const newGroups: Group[] = Array.from(byDomain.entries())
        .filter(([, { isExisting, pages }]) => !isExisting && pages.length > 0)
        .map(([domain, { groupId }], i) => ({
          id: groupId,
          name: domain,
          captureId,
          position: i,
          archived: false,
        }));

      const capture: Capture = {
        id: captureId,
        capturedAt: new Date().toISOString(),
        sourceLabel: settings.sourceLabel,
        tabCount: pages.length,
      };

      await addCapture(capture);
      if (newGroups.length > 0) {
        await addGroups(newGroups);
      }
      await addPages(pages);
      await updateBadge();
      notifyDataChanged();

      // Pass 2: Background enrichment (metadata + creator + publishedAt)
      (async () => {
        let enriched = 0;
        for (const page of pages) {
          try {
            const browserTab = newBrowserTabs.find((bt) => bt.url === page.url);
            // Only enrich awake tabs — never wake a discarded tab (forces a
            // reload + media autoplay across every background tab).
            if (browserTab && isInjectableTab(browserTab)) {
              const meta = await fetchMetadata(browserTab.id, page.url);
              const updates: Partial<Page> = {};
              if (meta.ogTitle) updates.ogTitle = meta.ogTitle;
              if (meta.ogDescription) updates.ogDescription = meta.ogDescription;
              if (meta.ogImage) updates.ogImage = meta.ogImage;
              if (meta.metaDescription) updates.metaDescription = meta.metaDescription;
              if (meta.creator) updates.creator = meta.creator;
              if (meta.creatorAvatar) updates.creatorAvatar = meta.creatorAvatar;
              if (meta.creatorUrl) updates.creatorUrl = meta.creatorUrl;
              if (meta.publishedAt) updates.publishedAt = meta.publishedAt;
              if (Object.keys(updates).length > 0) {
                await updatePage(page.id, updates);
                enriched++;
              }

              // Extract transcript for YouTube videos
              if (isYouTubeWatchUrl(page.url)) {
                try {
                  const { extractYouTubeTranscript } = await import("@/lib/youtube-extract");
                  const result = await extractYouTubeTranscript(browserTab.id, page.url);
                  if (result?.hasTranscript) {
                    const currentPage = await getPage(page.id);
                    if (currentPage) {
                      const { addPage } = await import("@/lib/db");
                      await addPage({
                        ...currentPage,
                        transcript: result.segments,
                        contentKey: `transcripts/${page.id}`,
                        contentType: "transcript",
                        contentFetchedAt: new Date().toISOString(),
                      });
                    }
                  }
                } catch (e) {
                  console.warn("[TabZen] Transcript extraction failed for", page.url, e);
                }
              }

              // Extract content for non-YouTube pages
              if (!isYouTubeWatchUrl(page.url)) {
                try {
                  const { extractPageContent } = await import("@/lib/page-extract");
                  const result = await extractPageContent(browserTab.id, page.url);
                  if (result) {
                    const currentPage = await getPage(page.id);
                    if (currentPage) {
                      const { addPage } = await import("@/lib/db");
                      await addPage({
                        ...currentPage,
                        content: result.content,
                        contentKey: `content/${page.id}`,
                        contentType: "markdown",
                        contentFetchedAt: new Date().toISOString(),
                      });
                    }
                  }
                } catch (e) {
                  console.warn("[TabZen] Content extraction failed for", page.url, e);
                }
              }
            }
          } catch {}
        }
        if (enriched > 0) {
          notifyDataChanged();
        }

        // Pass 3: AI tagging (if API key configured)
        if (settings.autoTagging && settings.openRouterApiKey) {
          try {
            const enrichedPages = await Promise.all(
              pages.map(async (p) => (await getPage(p.id)) || p),
            );
            const allTags = await getAllTags();
            const existingTagNames = allTags.map((t) => t.tag);
            const tagResults = await generateTags(
              settings.openRouterApiKey,
              settings.aiModel,
              enrichedPages.map((p) => ({
                id: p.id,
                title: p.ogTitle || p.title,
                url: p.url,
                description: p.ogDescription || p.metaDescription,
              })),
              existingTagNames,
            );
            let tagged = 0;
            for (const result of tagResults) {
              if (result.tags?.length) {
                await updatePage(result.id, { tags: result.tags });
                tagged++;
              }
            }
            if (tagged > 0) {
              notifyDataChanged();
            }
          } catch (e) {
            console.warn("[TabZen] AI tagging failed:", e);
          }
        }

        // Pass 4: AI chapters for video transcripts
        if (settings.autoChapters && settings.openRouterApiKey) {
          try {
            for (const p of pages) {
              const freshPage = await getPage(p.id);
              if (freshPage?.contentType === "transcript" && freshPage.transcript?.length && !freshPage.chapters?.length) {
                const chapters = await generateChapters(
                  settings.openRouterApiKey,
                  settings.aiModel,
                  freshPage.transcript,
                );
                if (chapters?.length) {
                  await updatePage(p.id, { chapters });
                }
              }
            }
            notifyDataChanged();
          } catch {}
        }

      })();

      // Auto-fetch transcripts for the newly captured YouTube pages in the background.
      processTranscriptQueue().catch((e) => console.warn("[TabZen] Transcript queue failed:", e));
      // Embed any pages that already have content into the knowledge base.
      processEmbedQueue().catch((e) => console.warn("[TabZen] Embed queue failed:", e));
      return { type: "QUICK_CAPTURE_DONE", saved: pages.length, skipped: candidateTabs.length - newBrowserTabs.length };
    } catch (e) {
      console.error("[TabZen] Quick capture error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleLookupProduct(name: string): Promise<MessageResponse> {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(name)}&format=json&no_html=1`,
        { signal: AbortSignal.timeout(5000) },
      );
      const data = await response.json();

      // Extract official website from Infobox
      let url: string | null = null;
      const infobox = data.Infobox?.content || [];
      for (const item of infobox) {
        if (item.label?.toLowerCase() === "official website" && item.value?.startsWith("http")) {
          url = item.value;
          break;
        }
        if (item.label?.toLowerCase() === "website" && !url) {
          // Extract URL from "[domain]" or "http://..." format
          const val = item.value || "";
          if (val.startsWith("http")) {
            url = val;
          } else {
            const match = val.match(/\[?(https?:\/\/[^\]\s]+|[\w.-]+\.\w{2,}[^\]\s]*)\]?/);
            if (match) {
              url = match[1].startsWith("http") ? match[1] : `https://${match[1]}`;
            }
          }
        }
      }

      // DDG image (relative path)
      let image = data.Image || null;
      if (image && !image.startsWith("http")) {
        image = `https://duckduckgo.com${image}`;
      }

      // If we found a URL, also fetch OG metadata for it
      if (url) {
        try {
          const meta = await fetchMetadataViaHttp(url);
          return {
            type: "PRODUCT_LOOKUP",
            url,
            image: meta.ogImage || image,
            description: meta.ogDescription || data.AbstractText || null,
          };
        } catch {
          // OG fetch failed, still return what we have from DDG
        }
      }

      return {
        type: "PRODUCT_LOOKUP",
        url,
        image,
        description: data.AbstractText || null,
      };
    } catch (e) {
      console.warn("[TabZen] Product lookup failed for", name, e);
      return { type: "PRODUCT_LOOKUP", url: null, image: null, description: null };
    }
  }

  async function handleLookupWikiImage(title: string): Promise<MessageResponse> {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) return { type: "WIKI_IMAGE", url: null };
      const data = await response.json();
      const imageUrl = data.thumbnail?.source || data.originalimage?.source || null;
      return { type: "WIKI_IMAGE", url: imageUrl };
    } catch {
      return { type: "WIKI_IMAGE", url: null };
    }
  }

  async function handleGetMetadata(url: string): Promise<MessageResponse> {
    try {
      const meta = await fetchMetadataViaHttp(url);
      return {
        type: "METADATA",
        ogTitle: meta.ogTitle,
        ogDescription: meta.ogDescription,
        ogImage: meta.ogImage,
        metaDescription: null,
      };
    } catch (e) {
      console.warn("[TabZen] Metadata fetch failed for", url, e);
      return { type: "METADATA", ogTitle: null, ogDescription: null, ogImage: null, metaDescription: null };
    }
  }

  async function handleIsUrlSaved(url: string): Promise<MessageResponse> {
    try {
      // Try original URL first (DB stores original), then normalized
      let page = await getPageByUrl(url);
      if (!page) {
        page = await getPageByUrl(normalizeUrl(url));
      }
      return { type: "URL_SAVED", saved: !!page, pageId: page?.id };
    } catch {
      return { type: "URL_SAVED", saved: false };
    }
  }

  // --- Capture helpers ---

  function parseOgFromHtml(html: string): {
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
  } {
    const getMetaContent = (pattern: RegExp): string | null => {
      const match = html.match(pattern);
      return match?.[1]?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">") || null;
    };

    return {
      ogTitle: getMetaContent(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
        || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i),
      ogDescription: getMetaContent(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
        || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i),
      ogImage: getMetaContent(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
        || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i),
      metaDescription: getMetaContent(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || getMetaContent(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
    };
  }

  function getYoutubeThumbnail(url: string): string | null {
    try {
      const u = new URL(url);
      let videoId: string | null = null;
      if (u.hostname.includes("youtube.com")) {
        videoId = u.searchParams.get("v");
      } else if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1);
      }
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    } catch {}
    return null;
  }

  async function fetchMetadataViaHttp(url: string): Promise<{
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
    creator: string | null;
    creatorAvatar: string | null;
    creatorUrl: string | null;
    publishedAt: string | null;
  }> {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TabZen/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      const html = await response.text();
      const meta = parseOgFromHtml(html);
      if (!meta.ogImage) {
        meta.ogImage = getYoutubeThumbnail(url);
      }
      let creator: string | null = null;
      let publishedAt: string | null = null;

      // Parse JSON-LD from HTML
      const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of jsonLdMatches) {
        try {
          const data = JSON.parse(m[1]);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (!creator) {
              const author = item.author || item.creator;
              if (typeof author === "string") creator = author;
              else if (author?.name) creator = author.name;
            }
            if (!publishedAt) {
              publishedAt = item.datePublished || item.uploadDate || item.dateCreated || null;
            }
          }
        } catch {}
      }

      // YouTube JSON fallback
      if (!creator) {
        const authorMatch = html.match(/"(?:ownerChannelName|author)"\s*:\s*"([^"]+)"/);
        if (authorMatch) creator = authorMatch[1];
      }
      if (!publishedAt) {
        const dateMatch = html.match(/"(?:publishDate|uploadDate)"\s*:\s*"([^"]+)"/);
        if (dateMatch) publishedAt = dateMatch[1];
      }

      // Generic meta fallback
      if (!publishedAt) {
        const pubMatch = html.match(/(?:property|name)="(?:article:published_time|date)"\s+content="([^"]+)"/);
        if (pubMatch) publishedAt = pubMatch[1];
      }

      // Creator avatar + URL from HTML
      let creatorAvatar: string | null = null;
      let creatorUrl: string | null = null;
      try {
        const avatarMatch = html.match(/"thumbnail":\{"thumbnails":\[.*?"url":"(https:\/\/yt3[^"]+)"/);
        if (avatarMatch) creatorAvatar = avatarMatch[1];
        // Channel ID for stable URL
        const channelIdMatch = html.match(/"channelId"\s*:\s*"(UC[^"]+)"/);
        if (channelIdMatch) {
          creatorUrl = `https://www.youtube.com/channel/${channelIdMatch[1]}`;
        }
      } catch {}

      return { ...meta, creator, creatorAvatar, creatorUrl, publishedAt };
    } catch {
      return {
        ogTitle: null,
        ogDescription: null,
        ogImage: getYoutubeThumbnail(url),
        metaDescription: null,
        creator: null,
        creatorAvatar: null,
        creatorUrl: null,
        publishedAt: null,
      };
    }
  }

  async function fetchMetadata(browserTabId: number, url: string): Promise<{
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
    creator: string | null;
    creatorAvatar: string | null;
    creatorUrl: string | null;
    publishedAt: string | null;
  }> {
    // Try content script first (works for tabs loaded after extension install)
    try {
      const response = await browser.tabs.sendMessage(browserTabId, {
        type: "GET_METADATA",
      });
      if (response?.ogTitle || response?.ogImage || response?.ogDescription) {
        return response;
      }
    } catch {}

    // Fallback: fetch the page HTML directly
    return fetchMetadataViaHttp(url);
  }

  async function buildCapturePreview(): Promise<CapturePreviewData> {
    const settings = await getSettings();
    const existingPages = await getAllPages();
    const existingUrls = buildUrlSet(existingPages.map((p) => p.url));
    const openTabs = await browser.tabs.query({});
    const captureId = uuidv4();

    // Filter out chrome:// URLs and existing duplicates
    const candidateTabs = openTabs.filter(
      (t) =>
        t.url &&
        !shouldSkipUrl(t.url!, settings.blockedDomains) &&
        !isDuplicate(t.url!, existingUrls),
    );

    // Deduplicate within the batch itself
    const seenUrls = new Set<string>();
    const newBrowserTabs = candidateTabs.filter((t) => {
      const normalized = normalizeUrl(t.url!);
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    });

    // Build lightweight records for EVERY tab first — no tab injection.
    // Title/url/favicon come from the tab object; YouTube gets a thumbnail
    // derived from the video id. This alone never wakes a sleeping tab.
    const pagesWithMeta: Page[] = newBrowserTabs.map((bt): Page => ({
      id: uuidv4(),
      url: bt.url!,
      title: bt.title || "Untitled",
      favicon: bt.favIconUrl || "",
      ogTitle: null,
      ogDescription: null,
      ogImage: isYouTubeWatchUrl(bt.url!) ? youtubeThumbnailUrl(bt.url!) : null,
      metaDescription: null,
      creator: null,
      creatorAvatar: null,
      creatorUrl: null,
      publishedAt: null,
      tags: [],
      notes: null,
      viewCount: 0,
      lastViewedAt: null,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      deviceId: settings.deviceId,
      archived: false,
      starred: false,
      deletedAt: null,
      groupId: "",
      contentKey: null,
      contentType: null,
      contentFetchedAt: null,
    }));

    // Enrich only AWAKE tabs (active + non-discarded), at most a few at a time.
    // We never inject into discarded/asleep tabs — that forces a reload and
    // autoplays media across every background tab, which freezes the browser.
    const enrichable = newBrowserTabs
      .map((bt, i) => ({ bt, page: pagesWithMeta[i] }))
      .filter(({ bt }) => isInjectableTab(bt));

    await mapWithConcurrency(enrichable, CAPTURE_EXTRACT_CONCURRENCY, async ({ bt, page }) => {
      try {
        const meta = await fetchMetadata(bt.id!, bt.url!);
        if (meta.ogTitle) page.ogTitle = meta.ogTitle;
        if (meta.ogDescription) page.ogDescription = meta.ogDescription;
        if (meta.ogImage) page.ogImage = meta.ogImage;
        if (meta.metaDescription) page.metaDescription = meta.metaDescription;
        if (meta.creator) page.creator = meta.creator;
        if (meta.creatorAvatar) page.creatorAvatar = meta.creatorAvatar;
        if (meta.creatorUrl) page.creatorUrl = meta.creatorUrl;
        if (meta.publishedAt) page.publishedAt = meta.publishedAt;
      } catch {}

      try {
        if (isYouTubeWatchUrl(bt.url!)) {
          const { extractYouTubeTranscript } = await import("@/lib/youtube-extract");
          const result = await extractYouTubeTranscript(bt.id!, bt.url!);
          if (result?.hasTranscript) {
            page.contentKey = `transcripts/${page.id}`;
            page.contentType = "transcript";
            page.contentFetchedAt = new Date().toISOString();
            page.contentVersion = CURRENT_CONTENT_VERSION;
            page.transcript = result.segments;
          }
        } else {
          const { extractPageContent } = await import("@/lib/page-extract");
          const result = await extractPageContent(bt.id!, bt.url!);
          if (result) {
            page.contentKey = `content/${page.id}`;
            page.contentType = "markdown";
            page.contentFetchedAt = new Date().toISOString();
            page.contentVersion = CURRENT_CONTENT_VERSION;
            page.content = result.content;
          }
        }
      } catch (e) {
        console.warn("[TabZen] Capture extraction failed for", bt.url, e);
      }
    });

    let aiGroups: { groupName: string; pageIds: string[] }[];
    {
      aiGroups = groupByDomain(pagesWithMeta);
    }

    // Build a lookup of valid page IDs for fast matching
    const validPageIds = new Set(pagesWithMeta.map((p) => p.id));

    // Assign group IDs to pages, tracking which pages got assigned
    const assignedPageIds = new Set<string>();
    const groupObjects: { groupName: string; groupId: string; pageIds: string[] }[] = [];

    for (const g of aiGroups) {
      const groupId = uuidv4();
      const matchedPageIds: string[] = [];
      for (const pageId of g.pageIds) {
        if (validPageIds.has(pageId)) {
          const page = pagesWithMeta.find((p) => p.id === pageId);
          if (page) {
            page.groupId = groupId;
            assignedPageIds.add(pageId);
            matchedPageIds.push(pageId);
          }
        }
      }
      if (matchedPageIds.length > 0) {
        groupObjects.push({ groupName: g.groupName, groupId, pageIds: matchedPageIds });
      }
    }

    // Catch any unassigned pages (AI missed them or returned wrong IDs)
    const unassigned = pagesWithMeta.filter((p) => !assignedPageIds.has(p.id));
    if (unassigned.length > 0) {
      const otherGroupId = uuidv4();
      for (const page of unassigned) {
        page.groupId = otherGroupId;
      }
      groupObjects.push({
        groupName: "Other",
        groupId: otherGroupId,
        pageIds: unassigned.map((p) => p.id),
      });
    }

    return {
      captureId,
      groups: groupObjects.map((g) => ({ groupName: g.groupName, pageIds: g.pageIds })),
      pages: pagesWithMeta,
    };
  }

  function groupByDomain(
    pages: Page[],
  ): { groupName: string; pageIds: string[] }[] {
    const byDomain = new Map<string, string[]>();
    for (const page of pages) {
      try {
        const domain = new URL(page.url).hostname.replace("www.", "");
        const list = byDomain.get(domain) || [];
        list.push(page.id);
        byDomain.set(domain, list);
      } catch {
        const list = byDomain.get("Other") || [];
        list.push(page.id);
        byDomain.set("Other", list);
      }
    }
    return Array.from(byDomain.entries()).map(([domain, pageIds]) => ({
      groupName: domain,
      pageIds,
    }));
  }

  async function confirmCapture(preview: CapturePreviewData): Promise<void> {
    const settings = await getSettings();

    // Build groups from the pages' groupIds (already assigned in buildCapturePreview)
    const groupIdToName = new Map<string, string>();
    for (const g of preview.groups) {
      for (const pageId of g.pageIds) {
        const page = preview.pages.find((p) => p.id === pageId);
        if (page && page.groupId) {
          groupIdToName.set(page.groupId, g.groupName);
          break;
        }
      }
    }

    const groups: Group[] = Array.from(groupIdToName.entries()).map(
      ([groupId, name], i) => ({
        id: groupId,
        name,
        captureId: preview.captureId,
        position: i,
        archived: false,
      }),
    );

    const capture: Capture = {
      id: preview.captureId,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      tabCount: preview.pages.length,
    };

    await addCapture(capture);
    await addGroups(groups);
    await addPages(preview.pages);
    await updateBadge();
    notifyDataChanged();
  }

  async function handleCaptureUrl(url: string): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      const existingPages = await getAllPages();
      const existingUrls = buildUrlSet(existingPages.map((p) => p.url));

      if (isDuplicate(url, existingUrls)) {
        // Already saved — return the existing page ID
        const existing = existingPages.find((p) => normalizeUrl(p.url) === normalizeUrl(url));
        return { type: "URL_SAVED", saved: true, pageId: existing?.id };
      }

      const meta = await fetchMetadataViaHttp(url);
      const pageId = uuidv4();

      const domain = (() => {
        try { return new URL(url).hostname.replace("www.", ""); }
        catch { return "Other"; }
      })();

      const existingGroups = await getAllGroups();
      const existingGroup = existingGroups.find((g) => g.name === domain && !g.archived);

      let groupId: string;
      let captureId: string;

      if (existingGroup) {
        groupId = existingGroup.id;
        captureId = existingGroup.captureId;
      } else {
        groupId = uuidv4();
        captureId = uuidv4();
      }

      // Extract content based on URL type
      let transcriptSegments: TranscriptSegment[] | null = null;
      let markdownContent: string | null = null;

      if (isYouTubeWatchUrl(url)) {
        try {
          const { extractYouTubeTranscriptDirect } = await import("@/lib/youtube-extract");
          const result = await extractYouTubeTranscriptDirect(url);
          if (result?.hasTranscript) {
            transcriptSegments = result.segments;
            if (!meta.ogTitle && result.title) meta.ogTitle = result.title;
          }
        } catch {
        }
      } else {
        try {
          const { extractPageContentViaFetch } = await import("@/lib/page-extract");
          const result = await extractPageContentViaFetch(url);
          if (result) {
            markdownContent = result.content;
            if (!meta.ogTitle && result.title) meta.ogTitle = result.title;
          }
        } catch {
        }
      }

      const hasTranscript = transcriptSegments && transcriptSegments.length > 0;
      const hasContent = !!markdownContent;

      const page: Page = {
        id: pageId,
        url,
        title: meta.ogTitle || domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        ...meta,
        tags: [],
        notes: null,
        viewCount: 0,
        lastViewedAt: null,
        capturedAt: new Date().toISOString(),
        sourceLabel: settings.sourceLabel,
        deviceId: settings.deviceId,
        archived: false,
        starred: false,
        deletedAt: null,
        groupId,
        contentKey: hasTranscript ? `transcripts/${pageId}` : hasContent ? `content/${pageId}` : null,
        contentType: hasTranscript ? "transcript" : hasContent ? "markdown" : null,
        contentFetchedAt: (hasTranscript || hasContent) ? new Date().toISOString() : null,
        transcript: hasTranscript ? transcriptSegments! : undefined,
        content: hasContent ? markdownContent! : undefined,
      };

      if (!existingGroup) {
        await addCapture({ id: captureId, capturedAt: new Date().toISOString(), sourceLabel: settings.sourceLabel, tabCount: 1 });
        await addGroups([{ id: groupId, name: domain, captureId, position: 0, archived: false }]);
      }

      await addPages([page]);
      notifyDataChanged();

      // AI tagging (async, non-blocking)
      if (settings.autoTagging && settings.openRouterApiKey) {
        (async () => {
          try {
            const allTags = await getAllTags();
            const existingTagNames = allTags.map((t) => t.tag);
            const tagResults = await generateTags(
              settings.openRouterApiKey,
              settings.aiModel,
              [{ id: pageId, title: page.ogTitle || page.title, url: page.url, description: page.ogDescription || page.metaDescription }],
              existingTagNames,
            );
            for (const result of tagResults) {
              if (result.tags?.length) {
                await updatePage(result.id, { tags: result.tags });
              }
            }
            notifyDataChanged();
          } catch {}
        })();
      }

      // AI chapters for YouTube (async, non-blocking)
      if (settings.autoChapters && settings.openRouterApiKey && hasTranscript) {
        (async () => {
          try {
            const chapters = await generateChapters(
              settings.openRouterApiKey,
              settings.aiModel,
              transcriptSegments!,
            );
            if (chapters?.length) {
              await updatePage(pageId, { chapters });
              notifyDataChanged();
            }
          } catch {}
        })();
      }

      return { type: "URL_SAVED", saved: true, pageId };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function captureSingleTab(
    browserTabId: number,
    url: string,
    title: string,
    favicon: string,
  ): Promise<void> {
    const settings = await getSettings();
    const existingPages = await getAllPages();
    const existingUrls = buildUrlSet(existingPages.map((p) => p.url));

    if (isDuplicate(url, existingUrls)) return;

    const meta = await fetchMetadata(browserTabId, url);
    const pageId = uuidv4();

    // Try to find an existing non-archived group for this domain
    const domain = (() => {
      try { return new URL(url).hostname.replace("www.", ""); }
      catch { return "Other"; }
    })();

    const existingGroups = await getAllGroups();
    const existingGroup = existingGroups.find((g) => g.name === domain && !g.archived);

    let groupId: string;
    let captureId: string;

    if (existingGroup) {
      // Reuse existing group and its capture
      groupId = existingGroup.id;
      captureId = existingGroup.captureId;
    } else {
      // Create new group and capture
      groupId = uuidv4();
      captureId = uuidv4();
    }

    // Extract transcript for YouTube videos, or page content for other pages
    let transcriptSegments: TranscriptSegment[] | null = null;
    let markdownContent: string | null = null;

    if (isYouTubeWatchUrl(url)) {
      try {
        const { extractYouTubeTranscript } = await import("@/lib/youtube-extract");
        const result = await extractYouTubeTranscript(browserTabId, url);
        if (result?.hasTranscript) {
          transcriptSegments = result.segments;
        }
      } catch (e) {
        console.warn("[TabZen] captureSingleTab - Transcript extraction failed:", e);
      }
    } else {
      try {
        const { extractPageContent } = await import("@/lib/page-extract");
        const result = await extractPageContent(browserTabId, url);
        if (result) {
          markdownContent = result.content;
        }
      } catch (e) {
        console.warn("[TabZen] captureSingleTab - Page content extraction failed:", e);
      }
    }

    const hasTranscript = transcriptSegments && transcriptSegments.length > 0;
    const hasContent = !!markdownContent;

    const page: Page = {
      id: pageId,
      url,
      title,
      favicon,
      ...meta,
      tags: [],
      notes: null,
      viewCount: 0,
      lastViewedAt: null,
      capturedAt: new Date().toISOString(),
      sourceLabel: settings.sourceLabel,
      deviceId: settings.deviceId,
      archived: false,
      starred: false,
      deletedAt: null,
      groupId,
      contentKey: hasTranscript ? `transcripts/${pageId}` : hasContent ? `content/${pageId}` : null,
      contentType: hasTranscript ? "transcript" : hasContent ? "markdown" : null,
      contentFetchedAt: (hasTranscript || hasContent) ? new Date().toISOString() : null,
      contentVersion: (hasTranscript || hasContent) ? CURRENT_CONTENT_VERSION : undefined,
      transcript: hasTranscript ? transcriptSegments! : undefined,
      content: hasContent ? markdownContent! : undefined,
    };

    if (!existingGroup) {
      const group: Group = {
        id: groupId,
        name: domain,
        captureId,
        position: 0,
        archived: false,
      };

      const capture: Capture = {
        id: captureId,
        capturedAt: new Date().toISOString(),
        sourceLabel: settings.sourceLabel,
        tabCount: 1,
      };

      await addCapture(capture);
      await addGroups([group]);
    }

    await addPages([page]);
    notifyDataChanged();

    // AI tagging (async, non-blocking)
    if (settings.autoTagging && settings.openRouterApiKey) {
      (async () => {
        try {
          const allTags = await getAllTags();
          const existingTagNames = allTags.map((t) => t.tag);
          const tagResults = await generateTags(
            settings.openRouterApiKey,
            settings.aiModel,
            [{ id: pageId, title: page.ogTitle || page.title, url: page.url, description: page.ogDescription || page.metaDescription }],
            existingTagNames,
          );
          for (const result of tagResults) {
            if (result.tags?.length) {
              await updatePage(result.id, { tags: result.tags });
            }
          }
          notifyDataChanged();
        } catch {}
      })();
    }

    // AI chapters (async, non-blocking)
    if (settings.autoChapters && settings.openRouterApiKey && hasTranscript) {
      (async () => {
        try {
          const chapters = await generateChapters(
            settings.openRouterApiKey,
            settings.aiModel,
            transcriptSegments!,
          );
          if (chapters?.length) {
            await updatePage(pageId, { chapters });
            notifyDataChanged();
          }
        } catch {}
      })();
    }
  }
});
