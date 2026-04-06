import { createResource, Show } from "solid-js";
import { getTab } from "@/lib/db";
import DetailPage from "@/components/detail/DetailPage";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  const [tab] = createResource(
    () => tabId,
    async (id) => (id ? getTab(id) : undefined),
  );

  return (
    <Show
      when={tab()}
      fallback={
        <div class="flex items-center justify-center h-screen bg-background">
          <p class="text-muted-foreground text-sm">
            {tab.loading ? "Loading..." : "Tab not found"}
          </p>
        </div>
      }
    >
      {(t) => <DetailPage tab={t()} />}
    </Show>
  );
}
