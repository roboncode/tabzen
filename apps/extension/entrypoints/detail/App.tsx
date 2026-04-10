import { createResource, Show } from "solid-js";
import { Toaster } from "solid-sonner";
import { getPage } from "@/lib/db";
import DetailPage from "@/components/detail/DetailPage";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const tabId = params.get("tabId");

  const [tab] = createResource(
    () => tabId,
    async (id) => (id ? getPage(id) : undefined),
  );

  return (
    <>
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
        {(t) => <DetailPage page={t()} />}
      </Show>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1e1e22",
            border: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      />
      <style>{`
        [data-sonner-toast] [data-title] {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #dfdfd6 !important;
          margin-bottom: 4px !important;
        }
        [data-sonner-toast] [data-description] {
          font-size: 14px !important;
          font-weight: 400 !important;
          color: rgba(223,223,214,0.35) !important;
        }
        [data-sonner-toast] [data-button] {
          margin-left: 6px !important;
        }
      `}</style>
    </>
  );
}
