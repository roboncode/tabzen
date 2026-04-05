import { storage } from "@wxt-dev/storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS_KEY = "local:settings";

export async function getSettings(): Promise<Settings> {
  const stored = await storage.getItem<Settings>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await storage.setItem(SETTINGS_KEY, updated);
  return updated;
}

export function watchSettings(callback: (newValue: Settings) => void): () => void {
  return storage.watch<Settings>(SETTINGS_KEY, (newValue) => {
    callback({ ...DEFAULT_SETTINGS, ...newValue });
  });
}
