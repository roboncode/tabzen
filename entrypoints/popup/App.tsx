import { createSignal, createResource, Show } from "solid-js";
import { PanelRight, Maximize2 } from "lucide-solid";
import { sendMessage } from "@/lib/messages";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [captureResult, setCaptureResult] = createSignal<{ saved: number; skipped: number } | null>(null);

  const [activeTab] = createResource(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return null;

    // Fetch full metadata from the tab
    let ogTitle: string | null = null;
    let ogDescription: string | null = null;
    let ogImage: string | null = null;
    let creator: string | null = null;
    let publishedAt: string | null = null;

    try {
      const response = await browser.tabs.sendMessage(tab.id!, {
        type: "GET_METADATA",
      });
      if (response) {
        ogTitle = response.ogTitle || null;
        ogDescription = response.ogDescription || null;
        ogImage = response.ogImage || null;
        creator = response.creator || null;
        publishedAt = response.publishedAt || null;
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
      publishedAt,
    };
  });

  const [uncapturedCount] = createResource(async () => {
    const response = await sendMessage({ type: "GET_UNCAPTURED_COUNT" });
    return response.type === "UNCAPTURED_COUNT" ? response.count : 0;
  });

  const domain = () => {
    try {
      return new URL(activeTab()?.url || "").hostname.replace("www.", "");
    } catch {
      return "";
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

  const handleSaveCurrentTab = async () => {
    const tab = activeTab();
    if (tab?.id) {
      await sendMessage({ type: "CAPTURE_SINGLE_TAB", tabId: tab.id });
      window.close();
    }
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
      {/* Header with open-in buttons */}
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-base font-semibold text-foreground">Tab Zen</h1>
        <div class="flex bg-muted/40 rounded-lg p-1 gap-0.5">
          <button
            class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={openFullPage}
            title="Open full page"
          >
            <Maximize2 size={16} />
          </button>
          <button
            class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={openSidePanel}
            title="Open side panel"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>

      {/* Current tab card */}
      <Show when={activeTab()}>
        {(tab) => (
          <div class="mb-4">
            <div class="aspect-video rounded-xl overflow-hidden bg-muted/40 mb-3">
              {tab().ogImage ? (
                <img
                  src={tab().ogImage}
                  alt=""
                  class="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div class="w-full h-full flex items-center justify-center">
                  {tab().favIconUrl ? (
                    <img src={tab().favIconUrl} alt="" class="w-8 h-8 rounded" />
                  ) : (
                    <span class="text-muted-foreground text-sm">{domain()}</span>
                  )}
                </div>
              )}
            </div>
            <div class="flex gap-3">
              {tab().favIconUrl ? (
                <img src={tab().favIconUrl} alt="" class="w-6 h-6 rounded-full mt-0.5 flex-shrink-0" />
              ) : (
                <div class="w-6 h-6 rounded-full bg-muted/50 mt-0.5 flex-shrink-0" />
              )}
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {tab().ogTitle || tab().title}
                </h3>
                <p class="text-xs text-muted-foreground mt-1">
                  {tab().creator || domain()}
                </p>
                {tab().ogDescription && (
                  <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {tab().ogDescription}
                  </p>
                )}
                <div class="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground/60">
                  {tab().publishedAt && (
                    <>
                      <span>{formatTimeAgo(tab().publishedAt!)}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{domain()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Capture result */}
      <Show when={captureResult()}>
        {(result) => (
          <div class="bg-muted/30 rounded-lg p-3 mb-3">
            <p class="text-sm text-foreground">
              Saved {result().saved} tabs
              {result().skipped > 0 && ` (${result().skipped} duplicates skipped)`}
            </p>
            <p class="text-xs text-muted-foreground mt-1">
              Metadata and AI grouping updating in the background
            </p>
          </div>
        )}
      </Show>

      {/* Action buttons */}
      <div class="space-y-2">
        <button
          class="w-full px-3 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          onClick={handleCaptureAll}
          disabled={capturing() || uncapturedCount() === 0}
        >
          {capturing()
            ? "Saving..."
            : uncapturedCount() === 0
              ? "All tabs captured"
              : `Capture All Tabs (${uncapturedCount()} new)`}
        </button>
        <button
          class="w-full px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
          onClick={handleSaveCurrentTab}
        >
          Save This Tab
        </button>
      </div>
    </div>
  );
}
