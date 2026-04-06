import { storage } from "@wxt-dev/storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS_KEY = "local:settings";

function reconcileSettings(stored: Partial<Settings>): Settings {
  const settings = { ...DEFAULT_SETTINGS };

  // Copy over stored values for simple fields (non-array)
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (key === "blockedDomains") continue; // handled separately
    if (stored[key] !== undefined && stored[key] !== null) {
      (settings as any)[key] = stored[key];
    }
  }

  // Blocked domains: merge defaults with any user-added custom domains
  if (stored.blockedDomains && stored.blockedDomains.length > 0) {
    const defaults = new Set(DEFAULT_SETTINGS.blockedDomains);
    const userAdded = stored.blockedDomains.filter((d) => !defaults.has(d));
    // Keep what the user has (including any defaults they kept) + their custom ones
    settings.blockedDomains = stored.blockedDomains;
    // But if they have NONE of the defaults, they probably have stale settings - add defaults
    const hasAnyDefault = stored.blockedDomains.some((d) => defaults.has(d));
    if (!hasAnyDefault) {
      settings.blockedDomains = [...DEFAULT_SETTINGS.blockedDomains, ...userAdded];
    }
  }

  return settings;
}

export async function getSettings(): Promise<Settings> {
  const stored = await storage.getItem<Partial<Settings>>(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;
  return reconcileSettings(stored);
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await storage.setItem(SETTINGS_KEY, updated);
  return updated;
}

export function watchSettings(callback: (newValue: Settings) => void): () => void {
  return storage.watch<Settings>(SETTINGS_KEY, (newValue) => {
    callback(reconcileSettings(newValue || {}));
  });
}
