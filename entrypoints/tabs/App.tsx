import { createSignal, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import TabCollection from "@/components/TabCollection";
import SettingsPanel from "@/components/SettingsPanel";
import type { Settings } from "@/lib/types";

export default function App() {
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");
  const params = new URLSearchParams(window.location.search);
  const [showSettings, setShowSettings] = createSignal(params.get("settings") === "true");

  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full min-h-screen bg-background flex">
      <div class="flex-1 h-screen min-w-0">
        <TabCollection
          viewMode={viewMode()}
          onViewModeChange={handleViewModeChange}
          showExpandButton={false}
          onOpenSettings={() => setShowSettings(!showSettings())}
        />
      </div>
      <Show when={showSettings()}>
        <div class="w-[480px] h-screen flex-shrink-0 border-l border-muted/30 overflow-hidden">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      </Show>
    </div>
  );
}
