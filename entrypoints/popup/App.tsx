import { createSignal, createResource, Show } from "solid-js";
import { sendMessage } from "@/lib/messages";
import type { CapturePreviewData } from "@/lib/types";

export default function App() {
  const [capturing, setCapturing] = createSignal(false);
  const [capturePreview, setCapturePreview] = createSignal<CapturePreviewData | null>(null);

  const [uncapturedCount] = createResource(async () => {
    const response = await sendMessage({ type: "GET_UNCAPTURED_COUNT" });
    return response.type === "UNCAPTURED_COUNT" ? response.count : 0;
  });

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
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await sendMessage({ type: "CAPTURE_SINGLE_TAB", tabId: tab.id });
      window.close();
    }
  };

  const openSidePanel = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
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
    <div class="bg-background text-foreground p-4">
      <h1 class="text-base font-bold text-foreground mb-4">Tab Zen</h1>

      <Show when={!capturePreview()}>
        <div class="space-y-2">
          <button
            class="w-full px-3 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
            class="w-full px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60"
            onClick={handleSaveCurrentTab}
          >
            Save This Tab
          </button>
        </div>

        <div class="mt-4 pt-3 border-t border-transparent flex gap-2">
          <button
            class="flex-1 px-3 py-1.5 text-xs bg-muted/40 text-muted-foreground rounded hover:text-foreground"
            onClick={openSidePanel}
          >
            Side Panel
          </button>
          <button
            class="flex-1 px-3 py-1.5 text-xs bg-muted/40 text-muted-foreground rounded hover:text-foreground"
            onClick={openFullPage}
          >
            Full Page
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
            <div class="space-y-1 max-h-48 overflow-y-auto mb-3">
              {preview().groups.map((g) => (
                <div class="text-xs text-muted-foreground">
                  <span class="text-foreground font-medium">{g.groupName}</span>{" "}
                  ({g.tabIds.length})
                </div>
              ))}
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded"
                onClick={() => setCapturePreview(null)}
              >
                Cancel
              </button>
              <button
                class="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
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
