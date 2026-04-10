import { createSignal } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import PageCollection from "@/components/PageCollection";
import type { Settings } from "@/lib/types";

export default function PageList() {
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");

  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full min-h-screen bg-background flex">
      <div class="flex-1 h-screen min-w-0">
        <PageCollection
          viewMode={viewMode()}
          onViewModeChange={handleViewModeChange}
        />
      </div>
    </div>
  );
}
