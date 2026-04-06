import { storage } from "@wxt-dev/storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS_KEY = "local:settings";

export async function getSettings(): Promise<Settings> {
  const stored = await storage.getItem<Settings>(SETTINGS_KEY);
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  // If blockedDomains was saved as empty but defaults exist, use defaults
  if (stored && (!stored.blockedDomains || stored.blockedDomains.length === 0) && DEFAULT_SETTINGS.blockedDomains.length > 0) {
    merged.blockedDomains = DEFAULT_SETTINGS.blockedDomains;
  }
  return merged;
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
