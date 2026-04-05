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
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normalizeUrl, buildUrlSet, isDuplicate } from "@/lib/duplicates";
import { groupTabsWithAI, aiSearch } from "@/lib/ai";
import { pushSync, pullSync } from "@/lib/sync";
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

  async function syncPush(): Promise<void> {
    try {
      const settings = await getSettings();
      if (!settings.syncEnabled) return;
      const activeToken = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
      if (!activeToken) return;

      const data = await getAllData();
      await pushSync({
        tabs: data.tabs,
        groups: data.groups,
        captures: data.captures,
        lastSyncedAt: new Date().toISOString(),
      });
      console.log("[TabZen] Sync pushed", data.tabs.length, "tabs");
    } catch (e) {
      console.warn("[TabZen] Sync push failed:", e);
    }
  }

  function debouncedSyncPush(): void {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => syncPush(), 2000);
  }

  async function syncPull(): Promise<void> {
    try {
      const settings = await getSettings();
      if (!settings.syncEnabled) return;
      const activeToken = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
      if (!activeToken) return;

      const remote = await pullSync(lastSyncedAt);
      if (remote && (remote.tabs.length || remote.groups.length || remote.captures.length)) {
        // Ensure starred field exists on pulled tabs
        const tabs = remote.tabs.map((t) => ({ ...t, starred: t.starred ?? false }));
        await importData({ tabs, groups: remote.groups, captures: remote.captures });
        lastSyncedAt = remote.lastSyncedAt;
        console.log("[TabZen] Sync pulled", tabs.length, "tabs");
        notifyDataChanged();
        await updateBadge();
      }
    } catch (e) {
      console.warn("[TabZen] Sync pull failed:", e);
    }
  }

  // Pull on startup
  syncPull();

  // --- Badge: Uncaptured tab count ---
  async function updateBadge(): Promise<void> {
    const existingTabs = await getAllTabs();
    const existingUrls = buildUrlSet(existingTabs.map((t) => t.url));

    const openTabs = await browser.tabs.query({});
    let uncaptured = 0;
    for (const tab of openTabs) {
      if (
        tab.url &&
        !tab.url.startsWith("chrome://") &&
        !tab.url.startsWith("chrome-extension://")
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
  }> {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TabZen/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      const html = await response.text();
      const meta = parseOgFromHtml(html);
      // YouTube fallback: if no og:image found, construct from video ID
      if (!meta.ogImage) {
        meta.ogImage = getYoutubeThumbnail(url);
      }
      return meta;
    } catch {
      // Last resort: try YouTube thumbnail
      return {
        ogTitle: null,
        ogDescription: null,
        ogImage: getYoutubeThumbnail(url),
        metaDescription: null,
      };
    }
  }

  async function fetchMetadata(browserTabId: number, url: string): Promise<{
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    metaDescription: string | null;
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
          notes: null,
          viewCount: 0,
          lastViewedAt: null,
          capturedAt: new Date().toISOString(),
          sourceLabel: settings.sourceLabel,
          archived: false,
          starred: false,
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
      archived: false,
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
