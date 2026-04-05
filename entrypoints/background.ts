import { v4 as uuidv4 } from "uuid";
import {
  getAllTabs,
  addTabs,
  addGroups,
  addCapture,
  updateTab,
  getTab,
  searchTabs,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normalizeUrl, buildUrlSet, isDuplicate } from "@/lib/duplicates";
import { groupTabsWithAI, aiSearch } from "@/lib/ai";
import type {
  Tab,
  Group,
  Capture,
  CapturePreviewData,
} from "@/lib/types";
import type { MessageRequest, MessageResponse } from "@/lib/messages";

export default defineBackground(() => {
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
  browser.contextMenus.create({
    id: "save-tab-to-tabzen",
    title: "Save to Tab Zen",
    contexts: ["page", "link"],
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
      const preview = await buildCapturePreview();
      return { type: "CAPTURE_PREVIEW", data: preview };
    } catch (e) {
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
      await confirmCapture(captureData);
      return { type: "SUCCESS" };
    } catch (e) {
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
          groupId: "",
        };
      }),
    );

    let groups: { groupName: string; tabIds: string[] }[];
    if (settings.openRouterApiKey && tabsWithMeta.length > 0) {
      try {
        groups = await groupTabsWithAI(
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
        groups = groupByDomain(tabsWithMeta);
      }
    } else {
      groups = groupByDomain(tabsWithMeta);
    }

    const groupObjects: { groupName: string; tabIds: string[] }[] = [];
    for (const g of groups) {
      const groupId = uuidv4();
      groupObjects.push({ groupName: g.groupName, tabIds: g.tabIds });
      for (const tabId of g.tabIds) {
        const tab = tabsWithMeta.find((t) => t.id === tabId);
        if (tab) tab.groupId = groupId;
      }
    }

    return {
      captureId,
      groups: groupObjects,
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

    const groups: Group[] = preview.groups.map((g, i) => {
      const groupId =
        preview.tabs.find((t) => g.tabIds.includes(t.id))?.groupId ||
        uuidv4();
      return {
        id: groupId,
        name: g.groupName,
        captureId: preview.captureId,
        position: i,
        archived: false,
      };
    });

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
  }
});
