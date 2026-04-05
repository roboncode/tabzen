import { createSignal, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import TabCollection from "@/components/TabCollection";
import SettingsPanel from "@/components/SettingsPanel";
import type { Settings } from "@/lib/types";

export default function App() {
  const [viewMode, setViewMode] = createSignal<Settings["viewMode"]>("cards");
  const [showSettings, setShowSettings] = createSignal(false);

  getSettings().then((s) => setViewMode(s.viewMode));

  const handleViewModeChange = (mode: "cards" | "rows") => {
    setViewMode(mode);
    updateSettings({ viewMode: mode });
  };

  return (
    <div class="w-full h-screen">
      <Show
        when={!showSettings()}
        fallback={<SettingsPanel onClose={() => setShowSettings(false)} />}
      >
        <TabCollection
          viewMode={viewMode()}
          onViewModeChange={handleViewModeChange}
          showExpandButton={true}
        />
      </Show>
    </div>
  );
}
