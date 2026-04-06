import { createResource, Show } from "solid-js";
import { getTab } from "@/lib/db";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  const [tab] = createResource(
    () => tabId,
    async (id) => (id ? getTab(id) : undefined),
  );

  return (
    <div class="w-full min-h-screen bg-background text-foreground">
      <Show
        when={tab()}
        fallback={
          <div class="flex items-center justify-center h-screen">
            <p class="text-muted-foreground text-sm">
              {tab.loading ? "Loading..." : "Tab not found"}
            </p>
          </div>
        }
      >
        {(t) => (
          <div class="p-8">
            <h1 class="text-lg font-semibold">{t().title}</h1>
            <p class="text-sm text-muted-foreground mt-2">{t().url}</p>
          </div>
        )}
      </Show>
    </div>
  );
}
