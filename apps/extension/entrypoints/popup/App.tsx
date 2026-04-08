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
            class={`group/card w-full text-left rounded-xl overflow-hidden mb-4 transition-all duration-200 ${
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
                      : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
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
                          saved()
                            ? ""
                            : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
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
                        saved()
                          ? ""
                          : "grayscale brightness-75 group-hover/card:grayscale-[30%] group-hover/card:brightness-[0.85]"
                      }`}
                    />
                  ) : (
                    <div class="w-5 h-5 rounded-full bg-muted/50 mt-0.5 flex-shrink-0" />
                  );
                })()}
                <div class="flex-1 min-w-0">
                  <h3
                    class={`text-sm font-medium leading-snug line-clamp-2 transition-colors duration-300 ${
                      saved()
                        ? "text-foreground"
                        : "text-muted-foreground group-hover/card:text-foreground/80"
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
                    : "text-muted-foreground/60 group-hover/card:text-foreground"
                }`}
              >
                {saved() ? "View Details \u2192" : "Save Tab"}
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
