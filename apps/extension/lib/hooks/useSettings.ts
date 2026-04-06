import { createSignal, createResource } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import type { Settings } from "@/lib/types";

export function useSettings() {
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [settings, { refetch }] = createResource(refreshKey, async () => getSettings());

  const save = async (updates: Partial<Settings>) => {
    await updateSettings(updates);
    setRefreshKey((k) => k + 1);
  };

  return { settings, save, refetch: () => setRefreshKey((k) => k + 1) };
}
