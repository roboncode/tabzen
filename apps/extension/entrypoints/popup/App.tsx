import { createSignal, createResource, Show } from "solid-js";
import { ShieldBan, Settings as SettingsIcon, Maximize, PanelRight } from "lucide-solid";
import { sendMessage } from "@/lib/messages";
import { shouldSkipUrl } from "@/lib/duplicates";
import { getSettings } from "@/lib/settings";
import { getDomain } from "@/lib/domains";

async function openOrFocusSPA(hash: string = "") {
  const appUrl = browser.runtime.getURL("/index.html");
  const existing = await browser.tabs.query({ url: `${appUrl}*` });
  if (existing.length > 0 && existing[0].id) {
    await browser.tabs.update(existing[0].id, { url: `${appUrl}#${hash}`, active: true });
    if (existing[0].windowId) {
      await browser.windows.update(existing[0].windowId, { focused: true });
    }
  } else {
    await browser.tabs.create({ url: `${appUrl}#${hash}` });
  }
  window.close();
}

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [captureResult, setCaptureResult] = createSignal<{
    saved: number;
    skipped: number;
  } | null>(null);
  const [justSaved, setJustSaved] = createSignal(false);

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

  const [uncapturedCount, { refetch: refetchCount }] = createResource(async () => {
    const response = await sendMessage({ type: "GET_UNCAPTURED_COUNT" });
    return response.type === "UNCAPTURED_COUNT" ? response.count : 0;
  });

  const domain = () => getDomain(activeTab()?.url || "");

  const faviconSrc = () => {
    const fav = activeTab()?.favIconUrl;
    if (fav && !fav.startsWith("chrome://")) return fav;
    const d = domain();
    return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=32` : "";
  };

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
  const [savedStatus, { mutate: mutateSavedStatus }] = createResource(
    () => activeTab()?.url,
    async (url) => {
      const response = await sendMessage({ type: "IS_URL_SAVED", url });
      if (response.type === "URL_SAVED" && response.saved) {
        return { saved: true, pageId: response.pageId };
      }
      return { saved: false };
    },
  );

  const saved = () => justSaved() || !!savedStatus()?.saved;
  const savedPageId = () => savedStatus()?.pageId;

  const handleCardClick = async () => {
    if (saved()) {
      const pageId = savedPageId();
      if (pageId) {
        await openOrFocusSPA(`/page/${pageId}`);
      }
    } else {
      const tab = activeTab();
      if (tab?.id) {
        const saveResponse = await sendMessage({ type: "CAPTURE_PAGE", tabId: tab.id });
        if (saveResponse.type === "ERROR") return;
        // Look up the saved page ID so we can link to details
        const response = await sendMessage({ type: "IS_URL_SAVED", url: tab.url });
        if (response.type === "URL_SAVED" && response.saved) {
          mutateSavedStatus({ saved: true, pageId: response.pageId });
        }
        setJustSaved(true);
        refetchCount();
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
    refetchCount();
  };

  const openSidePanel = async () => {
    const tab = activeTab();
    if (tab?.id) {
      await browser.sidePanel.open({ tabId: tab.id });
    }
    window.close();
  };

  const openFullPage = () => {
    openOrFocusSPA("/");
  };

  return (
    <div class="bg-background text-foreground p-4 w-[340px]">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-foreground">Tab Zen</h1>
        <div class="flex items-center gap-1.5">
          <Show when={capturing() || (!uncapturedCount.loading && (uncapturedCount() ?? 0) > 0)}>
            <button
              class="text-sm text-muted-foreground hover:text-sky-400 px-2.5 py-1 rounded-lg transition-colors"
              onClick={handleCaptureAll}
              disabled={capturing()}
            >
              {capturing() ? "Saving..." : `Save all (${uncapturedCount()})`}
            </button>
          </Show>
          <button
            class="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors"
            onClick={() => openOrFocusSPA("/settings")}
            aria-label="Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>

      {/* Sync error banner */}
      <Show when={syncError()}>
        <div class="flex items-center gap-2 bg-red-500/10 rounded-lg px-3 py-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <p class="text-xs text-red-300 flex-1">{syncError()}</p>
          <button
            class="text-xs text-red-300 hover:text-red-200 transition-colors flex-shrink-0"
            onClick={() => openOrFocusSPA("/settings")}
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
            onClick={() => openOrFocusSPA("/settings")}
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
            class={`group/card w-full text-left rounded-xl overflow-hidden mb-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
              saved()
                ? "bg-muted/30 hover:bg-muted/40"
                : "bg-muted/20 hover:bg-sky-950"
            }`}
            onClick={handleCardClick}
          >
            {/* Thumbnail */}
            <div class="aspect-video overflow-hidden">
              {tab().ogImage ? (
                <img
                  src={tab().ogImage!}
                  alt=""
                  class="w-full h-full object-cover object-top"
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
                  {faviconSrc() ? (
                    <img
                      src={faviconSrc()}
                      alt=""
                      class="w-8 h-8 rounded"
                    />
                  ) : (
                    <span class="text-muted-foreground text-sm">
                      {domain()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div class="p-3">
              <div class="flex gap-2.5 items-start">
                {faviconSrc() ? (
                  <img
                    src={faviconSrc()}
                    alt=""
                    class="w-5 h-5 rounded-full mt-0.5 flex-shrink-0"
                  />
                ) : (
                  <div class="w-5 h-5 rounded-full bg-muted/50 mt-0.5 flex-shrink-0" />
                )}
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-sm font-medium leading-snug line-clamp-2 text-foreground"
                  >
                    {tab().ogTitle || tab().title}
                  </h3>
                  <p
                    class="text-xs mt-1 text-muted-foreground"
                  >
                    {tab().creator || domain()}
                  </p>
                  <Show when={tab().ogDescription}>
                    <p
                      class="text-xs mt-0.5 line-clamp-1 text-muted-foreground"
                    >
                      {tab().ogDescription}
                    </p>
                  </Show>
                </div>
              </div>

            </div>

            {/* Action footer */}
            <div
              class={`text-center text-sm py-2.5 transition-colors duration-200 ${
                saved()
                  ? "bg-muted/20 text-muted-foreground"
                  : "bg-muted/30 text-muted-foreground/60 group-hover/card:text-foreground group-hover/card:bg-sky-400 group-hover/card:text-sky-950"
              }`}
            >
              {saved() ? "View Details \u2192" : "Save Page"}
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
            <p class="text-xs text-muted-foreground mt-1">
              Metadata and AI grouping updating in the background
            </p>
          </div>
        )}
      </Show>

      {/* Navigation buttons */}
      <div class="flex gap-2.5">
        <button
          class="flex-1 bg-muted/25 rounded-xl px-4 py-3 flex items-center gap-2.5 transition-colors duration-200 hover:bg-sky-950 hover:text-foreground text-muted-foreground group"
          onClick={openFullPage}
        >
          <Maximize size={16} class="flex-shrink-0 transition-colors duration-200 group-hover:text-sky-400" />
          <span class="text-sm">Full Page</span>
        </button>
        <button
          class="flex-1 bg-muted/25 rounded-xl px-4 py-3 flex items-center gap-2.5 transition-colors duration-200 hover:bg-sky-950 hover:text-foreground text-muted-foreground group"
          onClick={openSidePanel}
        >
          <PanelRight size={16} class="flex-shrink-0 transition-colors duration-200 group-hover:text-sky-400" />
          <span class="text-sm">Side Panel</span>
        </button>
      </div>
    </div>
  );
}
