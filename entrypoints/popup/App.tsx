import { createSignal, createResource, Show } from "solid-js";
import { PanelRight, Maximize2 } from "lucide-solid";
import { sendMessage } from "@/lib/messages";
import type { CapturePreviewData } from "@/lib/types";

interface ActiveTab {
  title: string;
  url: string;
  favIconUrl: string;
  id: number;
}

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [capturePreview, setCapturePreview] =
    createSignal<CapturePreviewData | null>(null);

  const [activeTab] = createResource(async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return null;

    // Try to get OG image for current tab
    let ogImage: string | null = null;
    try {
      const response = await browser.tabs.sendMessage(tab.id!, {
        type: "GET_METADATA",
      });
      ogImage = response?.ogImage || null;
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
      ogImage,
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
    const response = await sendMessage({ type: "CAPTURE_ALL_TABS" });
    if (response.type === "CAPTURE_PREVIEW") {
      setCapturePreview(response.data);
    }
    setCapturing(false);
  };

  const handleConfirm = async () => {
    const preview = capturePreview();
    if (preview) {
      await sendMessage({ type: "CONFIRM_CAPTURE", captureData: preview });
      setCapturePreview(null);
      window.close();
    }
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

      <Show when={!capturePreview()}>
        {/* Current tab card */}
        <Show when={activeTab()}>
          {(tab) => (
            <div class="mb-4 rounded-xl overflow-hidden bg-card">
              {/* Thumbnail */}
              <div class="aspect-video bg-muted/40 overflow-hidden">
                {(tab() as any).ogImage ? (
                  <img
                    src={(tab() as any).ogImage}
                    alt=""
                    class="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div class="w-full h-full flex items-center justify-center">
                    {tab().favIconUrl ? (
                      <img
                        src={tab().favIconUrl}
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
              {/* Info */}
              <div class="p-3">
                <div class="flex items-center gap-2 mb-1.5">
                  {tab().favIconUrl && (
                    <img
                      src={tab().favIconUrl}
                      alt=""
                      class="w-4 h-4 rounded-sm"
                    />
                  )}
                  <span class="text-xs text-muted-foreground">{domain()}</span>
                </div>
                <h3 class="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {tab().title}
                </h3>
              </div>
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
              ? "Analyzing..."
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
      </Show>

      <Show when={capturePreview()}>
        {(preview) => (
          <div>
            <p class="text-sm text-foreground mb-3">
              {preview().tabs.length} new tabs in {preview().groups.length}{" "}
              groups
            </p>
            <div class="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {preview().groups.map((g) => (
                <div class="text-sm text-muted-foreground">
                  <span class="text-foreground font-medium">
                    {g.groupName}
                  </span>{" "}
                  ({g.tabIds.length})
                </div>
              ))}
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                onClick={() => setCapturePreview(null)}
              >
                Cancel
              </button>
              <button
                class="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
