import { createSignal, onMount, onCleanup, For, Show } from "solid-js";
import { AppWindow, Bookmark, ExternalLink } from "lucide-solid";
import { sendMessage } from "@/lib/messages";
import { getDomain } from "@/lib/domains";
import type { UncapturedTab } from "@/lib/tab-status";

export default function OpenTabsPage() {
  const [tabs, setTabs] = createSignal<UncapturedTab[]>([]);
  const [savingAll, setSavingAll] = createSignal(false);

  const loadTabs = async () => {
    const res = await sendMessage({ type: "GET_UNCAPTURED_TABS" });
    if (res.type === "UNCAPTURED_TABS") setTabs(res.tabs);
  };

  // Refetch whenever the collection changes (e.g. another view saved a tab) so
  // freshly-captured tabs drop off this list. Mirrors the DATA_CHANGED listener
  // pattern used by KbChatPage / PageCollection.
  onMount(() => {
    void loadTabs();

    const listener = (message: unknown) => {
      if ((message as { type?: string } | null)?.type === "DATA_CHANGED") {
        void loadTabs();
      }
    };
    browser.runtime.onMessage.addListener(listener);
    onCleanup(() => browser.runtime.onMessage.removeListener(listener));
  });

  // Favicon from the live tab, falling back to Google's favicon service by
  // domain (mirrors getFaviconUrl's fallback for stored pages).
  const faviconFor = (t: UncapturedTab): string => {
    if (t.favIconUrl) return t.favIconUrl;
    const domain = getDomain(t.url);
    return domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      : "";
  };

  const handleSave = async (tabId: number) => {
    await sendMessage({ type: "CAPTURE_PAGE", tabId });
    await loadTabs();
  };

  const handleOpen = (tabId: number) => {
    void sendMessage({ type: "FOCUS_TAB", tabId });
  };

  const handleSaveAll = async () => {
    if (savingAll()) return;
    setSavingAll(true);
    try {
      await sendMessage({ type: "QUICK_CAPTURE" });
      await loadTabs();
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div class="h-full overflow-y-auto bg-background text-foreground">
      <div class="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div class="flex items-center gap-3 mb-4">
          <AppWindow size={18} class="text-muted-foreground flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <h1 class="text-sm font-semibold text-foreground">Open Tabs</h1>
            <p class="text-xs text-muted-foreground mt-0.5">
              {tabs().length} uncaptured
            </p>
          </div>
          <Show when={tabs().length > 0}>
            <button
              class="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex-shrink-0"
              disabled={savingAll()}
              onClick={handleSaveAll}
            >
              <Bookmark size={14} />
              {savingAll() ? "Saving…" : "Save all"}
            </button>
          </Show>
        </div>

        {/* List / empty state */}
        <Show
          when={tabs().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-20 text-center">
              <AppWindow size={28} class="mb-3 text-muted-foreground/20" />
              <p class="text-sm text-muted-foreground">
                All your open tabs are captured.
              </p>
            </div>
          }
        >
          <div class="space-y-0.5">
            <For each={tabs()}>
              {(t) => (
                <div class="group">
                  <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 rounded-lg transition-colors">
                    {faviconFor(t) ? (
                      <img
                        src={faviconFor(t)}
                        alt=""
                        class="w-5 h-5 rounded flex-shrink-0"
                      />
                    ) : (
                      <div class="w-5 h-5 bg-muted/50 rounded flex-shrink-0" />
                    )}
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-foreground truncate">
                        {t.title}
                      </div>
                      <div class="text-xs text-muted-foreground truncate">
                        {getDomain(t.url)}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        class="flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        onClick={() => handleSave(t.id)}
                        title="Save to collection"
                      >
                        <Bookmark size={13} />
                        Save
                      </button>
                      <button
                        class="flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={() => handleOpen(t.id)}
                        title="Switch to this tab"
                      >
                        <ExternalLink size={13} />
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
