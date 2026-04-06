import { v4 as uuidv4 } from "uuid";
import {
  getAllTabs,
  getAllGroups,
  getAllData,
  addTabs,
  addGroups,
  addCapture,
  updateTab,
  getTab,
  searchTabs,
  importData,
  purgeDeletedTabs,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normalizeUrl, buildUrlSet, isDuplicate, isDomainBlocked } from "@/lib/duplicates";
import { groupTabsWithAI, aiSearch } from "@/lib/ai";
import { pushSync, pullSync, getRemoteStatus } from "@/lib/sync";
import { encrypt, decrypt } from "@/lib/crypto";
import { updateSettings } from "@/lib/settings";
import type {
  Tab,
  Group,
  Capture,
  CapturePreviewData,
} from "@/lib/types";
import type { MessageRequest, MessageResponse } from "@/lib/messages";

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
    const token = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
    return !!token;
  }

  async function syncPush(): Promise<void> {
    try {
      if (!(await isSyncActive())) return;

      const data = await getAllData();
      await pushSync({
        tabs: data.tabs,
        groups: data.groups,
        captures: data.captures,
        lastSyncedAt: new Date().toISOString(),
      });
      lastSyncedAt = new Date().toISOString();
      console.log("[TabZen] Sync pushed", data.tabs.length, "tabs");
    } catch (e) {
      console.warn("[TabZen] Sync push failed:", e);
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
      if (!remoteTimestamp || remoteTimestamp <= lastSyncedAt) {
        console.log("[TabZen] Sync check: server has no new data");
        return;
      }

      // Server has newer data, do a full pull
      const remote = await pullSync(lastSyncedAt);
      if (remote && (remote.tabs.length || remote.groups.length || remote.captures.length)) {
        const tabs = remote.tabs.map((t) => ({ ...t, starred: t.starred ?? false }));
        await importData({ tabs, groups: remote.groups, captures: remote.captures });
        lastSyncedAt = remote.lastSyncedAt;
        console.log("[TabZen] Sync pulled", tabs.length, "tabs");
        // Notify UI without triggering another push
        browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
        await updateBadge();
      }
    } catch (e) {
      console.warn("[TabZen] Sync pull failed:", e);
    }
  }

  // Auto-purge soft-deleted tabs older than 30 days on startup
  purgeDeletedTabs(30).catch((e) => console.warn("[TabZen] Auto-purge failed:", e));

  // Backfill creator field for existing tabs that don't have one
  (async () => {
    try {
      const { extractCreator } = await import("@/lib/domains");
      const tabs = await getAllTabs();
      let updated = 0;
      for (const tab of tabs) {
        if (!tab.creator) {
          const creator = extractCreator(tab);
          if (creator) {
            await updateTab(tab.id, { creator });
            updated++;
          }
        }
      }
      if (updated > 0) {
        console.log(`[TabZen] Backfilled creator for ${updated} tabs`);
        notifyDataChanged();
      }
    } catch (e) {
      console.warn("[TabZen] Creator backfill failed:", e);
    }
  })();

  // Pull on startup
  syncPullIfNeeded();

  // Pull on interval (every 5 minutes)
  setInterval(() => syncPullIfNeeded(), SYNC_INTERVAL);

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
      console.log("[TabZen] Generated device ID:", updates.deviceId);
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
          console.log("[TabZen] Auto-detected source label:", updates.sourceLabel);
        }
      } catch (e) {
        console.log("[TabZen] Could not detect profile email, using default");
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateSettings(updates);
    }
  })();

  // --- Badge: Uncaptured tab count ---
  async function updateBadge(): Promise<void> {
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));
    const settings = await getSettings();

    const openTabs = await browser.tabs.query({});
    let uncaptured = 0;
    for (const tab of openTabs) {
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://") &&
        !isDomainBlocked(tab.url, settings.blockedDomains)
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
      if (preview.tabs.length > 0) {
        await confirmCapture(preview);
      }
    }
  });

  // --- Message handler ---
  browser.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      handleMessage(message).then(sendResponse);
      return true;
    },
  );

  async function handleMessage(
    message: MessageRequest,
  ): Promise<MessageResponse> {
    switch (message.type) {
      case "CAPTURE_ALL_TABS":
        return handleCaptureAllTabs();
      case "CAPTURE_SINGLE_TAB":
        return handleCaptureSingleTab(message.tabId);
      case "CONFIRM_CAPTURE":
        return handleConfirmCapture(message.captureData);
      case "GET_UNCAPTURED_COUNT":
        return handleGetUncapturedCount();
      case "SEARCH_TABS":
        return handleSearchTabs(message.query);
      case "AI_SEARCH":
        return handleAISearch(message.query);
      case "OPEN_TAB":
        return handleOpenTab(message.tabId);
      case "SYNC_NOW":
        return handleSyncNow();
      default:
        return { type: "ERROR", message: "Unknown message type" };
    }
  }

  async function handleCaptureAllTabs(): Promise<MessageResponse> {
    try {
      console.log("[TabZen] Building capture preview...");
      const preview = await buildCapturePreview();
      console.log("[TabZen] Preview built:", preview.tabs.length, "tabs,", preview.groups.length, "groups");
      console.log("[TabZen] Groups:", preview.groups.map((g) => `${g.groupName} (${g.tabIds.length})`));
      console.log("[TabZen] Tabs with groupIds:", preview.tabs.filter((t) => t.groupId).length, "/", preview.tabs.length);
      return { type: "CAPTURE_PREVIEW", data: preview };
    } catch (e) {
      console.error("[TabZen] Capture preview error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleCaptureSingleTab(
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
      console.log("[TabZen] Confirming capture:", captureData.tabs.length, "tabs");
      console.log("[TabZen] Tabs groupIds check:", captureData.tabs.map((t) => ({ id: t.id.slice(0, 8), groupId: t.groupId?.slice(0, 8) || "EMPTY" })));
      await confirmCapture(captureData);
      const savedTabs = await getAllTabs();
      const savedGroups = await getAllGroups();
      console.log("[TabZen] After save - DB has", savedTabs.length, "tabs,", savedGroups.length, "groups");
      return { type: "SUCCESS" };
    } catch (e) {
      console.error("[TabZen] Confirm capture error:", e);
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleGetUncapturedCount(): Promise<MessageResponse> {
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));
    const openTabs = await browser.tabs.query({});
    let count = 0;
    for (const tab of openTabs) {
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
      ) {
        if (!isDuplicate(tab.url, existingUrls)) {
          count++;
        }
      }
    }
    return { type: "UNCAPTURED_COUNT", count };
  }

  async function handleSearchTabs(query: string): Promise<MessageResponse> {
    const tabs = await searchTabs(query);
    return { type: "SEARCH_RESULTS", tabs };
  }

  async function handleAISearch(query: string): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      if (!settings.openRouterApiKey) {
        return { type: "ERROR", message: "OpenRouter API key not configured" };
      }
      const allTabs = await getAllTabs();
      const tabData = allTabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        description: t.ogDescription || t.metaDescription,
        notes: t.notes,
      }));
      const matchingIds = await aiSearch(
        settings.openRouterApiKey,
        settings.aiModel,
        query,
        tabData,
      );
      const results = allTabs.filter((t) => matchingIds.includes(t.id));
      return { type: "SEARCH_RESULTS", tabs: results };
    } catch (e) {
      return { type: "ERROR", message: String(e) };
    }
  }

  async function handleOpenTab(tabId: string): Promise<MessageResponse> {
    const tab = await getTab(tabId);
    if (!tab) return { type: "ERROR", message: "Tab not found" };

    await browser.tabs.create({ url: tab.url });
    await updateTab(tabId, {
      viewCount: tab.viewCount + 1,
      lastViewedAt: new Date().toISOString(),
    });

    const updated = await getTab(tabId);
    return { type: "TAB_OPENED", tab: updated! };
  }

  async function handleSyncNow(): Promise<MessageResponse> {
    try {
      const settings = await getSettings();
      const activeToken = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
      console.log("[TabZen] Sync Now:", {
        syncEnabled: settings.syncEnabled,
        syncEnv: settings.syncEnv,
        hasToken: !!activeToken,
        tokenPreview: activeToken?.slice(0, 8),
      });

      if (!activeToken) {
        return { type: "ERROR", message: "No sync token configured" };
      }

      // Push local data + settings
      const data = await getAllData();
      let pushed = data.tabs.length;
      console.log("[TabZen] Pushing", pushed, "tabs,", data.groups.length, "groups,", data.captures.length, "captures");

      // Encrypt API key if present
      let encryptedApiKey: string | null = null;
      if (settings.openRouterApiKey && activeToken) {
        encryptedApiKey = await encrypt(settings.openRouterApiKey, activeToken);
      }

      await pushSync({
        tabs: data.tabs,
        groups: data.groups,
        captures: data.captures,
        settings: {
          aiModel: settings.aiModel,
          encryptedApiKey,
        },
        lastSyncedAt: new Date().toISOString(),
      });
      console.log("[TabZen] Manual sync: pushed", pushed, "tabs + settings");

      // Then pull remote data
      let pulled = 0;
      const remote = await pullSync("1970-01-01T00:00:00Z");
      if (remote) {
        if (remote.tabs.length || remote.groups.length || remote.captures.length) {
          const tabs = remote.tabs.map((t) => ({ ...t, starred: t.starred ?? false }));
          const result = await importData({ tabs, groups: remote.groups, captures: remote.captures });
          pulled = result.imported;
          console.log("[TabZen] Manual sync: pulled", pulled, "new tabs");
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
            console.log("[TabZen] Applied synced settings:", Object.keys(updates));
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
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        if (domain === "youtube.com") {
          const authorMatch = html.match(/"(?:author|ownerChannelName)"\s*:\s*"([^"]+)"/);
          if (authorMatch) creator = authorMatch[1];
          const dateMatch = html.match(/"(?:publishDate|uploadDate)"\s*:\s*"([^"]+)"/);
          if (dateMatch) publishedAt = dateMatch[1];
        }
      } catch {}
      // Generic publish date
      if (!publishedAt) {
        const pubMatch = html.match(/property="article:published_time"\s+content="([^"]+)"/);
        if (pubMatch) publishedAt = pubMatch[1];
      }
      return { ...meta, creator, publishedAt };
    } catch {
      return {
        ogTitle: null,
        ogDescription: null,
        ogImage: getYoutubeThumbnail(url),
        metaDescription: null,
        creator: null,
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
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));
    const openTabs = await browser.tabs.query({});
    const captureId = uuidv4();

    // Filter out chrome:// URLs and existing duplicates
    const candidateTabs = openTabs.filter(
      (t) =>
        t.url &&
        !t.url.startsWith("chrome://") &&
        !t.url.startsWith("chrome-extension://") &&
        !isDuplicate(t.url!, existingUrls) &&
        !isDomainBlocked(t.url!, settings.blockedDomains),
    );

    // Deduplicate within the batch itself
    const seenUrls = new Set<string>();
    const newBrowserTabs = candidateTabs.filter((t) => {
      const normalized = normalizeUrl(t.url!);
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    });

    const tabsWithMeta: Tab[] = await Promise.all(
      newBrowserTabs.map(async (bt) => {
        const meta = await fetchMetadata(bt.id!, bt.url!);
        return {
          id: uuidv4(),
          url: bt.url!,
          title: bt.title || "Untitled",
          favicon: bt.favIconUrl || "",
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
          ogImage: meta.ogImage,
          metaDescription: meta.metaDescription,
          creator: meta.creator || null,
          publishedAt: meta.publishedAt || null,
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
        };
      }),
    );

    let aiGroups: { groupName: string; tabIds: string[] }[];
    if (settings.openRouterApiKey && tabsWithMeta.length > 0) {
      try {
        aiGroups = await groupTabsWithAI(
          settings.openRouterApiKey,
          settings.aiModel,
          tabsWithMeta.map((t) => ({
            id: t.id,
            title: t.title,
            url: t.url,
            description: t.ogDescription || t.metaDescription,
          })),
        );
      } catch {
        aiGroups = groupByDomain(tabsWithMeta);
      }
    } else {
      aiGroups = groupByDomain(tabsWithMeta);
    }

    // Build a lookup of valid tab IDs for fast matching
    const validTabIds = new Set(tabsWithMeta.map((t) => t.id));

    // Assign group IDs to tabs, tracking which tabs got assigned
    const assignedTabIds = new Set<string>();
    const groupObjects: { groupName: string; groupId: string; tabIds: string[] }[] = [];

    for (const g of aiGroups) {
      const groupId = uuidv4();
      const matchedTabIds: string[] = [];
      for (const tabId of g.tabIds) {
        if (validTabIds.has(tabId)) {
          const tab = tabsWithMeta.find((t) => t.id === tabId);
          if (tab) {
            tab.groupId = groupId;
            assignedTabIds.add(tabId);
            matchedTabIds.push(tabId);
          }
        }
      }
      if (matchedTabIds.length > 0) {
        groupObjects.push({ groupName: g.groupName, groupId, tabIds: matchedTabIds });
      }
    }

    // Catch any unassigned tabs (AI missed them or returned wrong IDs)
    const unassigned = tabsWithMeta.filter((t) => !assignedTabIds.has(t.id));
    if (unassigned.length > 0) {
      const otherGroupId = uuidv4();
      for (const tab of unassigned) {
        tab.groupId = otherGroupId;
      }
      groupObjects.push({
        groupName: "Other",
        groupId: otherGroupId,
        tabIds: unassigned.map((t) => t.id),
      });
    }

    return {
      captureId,
      groups: groupObjects.map((g) => ({ groupName: g.groupName, tabIds: g.tabIds })),
      tabs: tabsWithMeta,
    };
  }

  function groupByDomain(
    tabs: Tab[],
  ): { groupName: string; tabIds: string[] }[] {
    const byDomain = new Map<string, string[]>();
    for (const tab of tabs) {
      try {
        const domain = new URL(tab.url).hostname.replace("www.", "");
        const list = byDomain.get(domain) || [];
        list.push(tab.id);
        byDomain.set(domain, list);
      } catch {
        const list = byDomain.get("Other") || [];
        list.push(tab.id);
        byDomain.set("Other", list);
      }
    }
    return Array.from(byDomain.entries()).map(([domain, tabIds]) => ({
      groupName: domain,
      tabIds,
    }));
  }

  async function confirmCapture(preview: CapturePreviewData): Promise<void> {
    const settings = await getSettings();

    // Build groups from the tabs' groupIds (already assigned in buildCapturePreview)
    const groupIdToName = new Map<string, string>();
    for (const g of preview.groups) {
      for (const tabId of g.tabIds) {
        const tab = preview.tabs.find((t) => t.id === tabId);
        if (tab && tab.groupId) {
          groupIdToName.set(tab.groupId, g.groupName);
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
      tabCount: preview.tabs.length,
    };

    await addCapture(capture);
    await addGroups(groups);
    await addTabs(preview.tabs);
    await updateBadge();
    notifyDataChanged();
  }

  async function captureSingleTab(
    browserTabId: number,
    url: string,
    title: string,
    favicon: string,
  ): Promise<void> {
    const settings = await getSettings();
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));

    if (isDuplicate(url, existingUrls)) return;

    const meta = await fetchMetadata(browserTabId, url);
    const captureId = uuidv4();
    const groupId = uuidv4();

    const tab: Tab = {
      id: uuidv4(),
      url,
      title,
      favicon,
      ...meta,
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
    };

    const group: Group = {
      id: groupId,
      name: new URL(url).hostname.replace("www.", ""),
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
    await addTabs([tab]);
    notifyDataChanged();
  }
});
