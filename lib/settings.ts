import { storage } from "@wxt-dev/storage";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, type Settings } from "./types";

const SETTINGS_KEY = "local:settings";

type Migration = (settings: Settings) => Settings;

// Each migration upgrades from version N-1 to N.
// Add new migrations here when changing defaults or adding fields.
const MIGRATIONS: Record<number, Migration> = {
  1: (s) => ({
    ...s,
    settingsVersion: 1,
    // Backfill blocked domains if empty
    blockedDomains: s.blockedDomains?.length ? s.blockedDomains : DEFAULT_SETTINGS.blockedDomains,
    // Backfill new fields with defaults
    openMode: s.openMode || DEFAULT_SETTINGS.openMode,
    aiGrouping: s.aiGrouping ?? DEFAULT_SETTINGS.aiGrouping,
    deviceId: s.deviceId || DEFAULT_SETTINGS.deviceId,
  }),
  2: (s) => ({ ...s, settingsVersion: 2 }),
  3: (s) => {
    // Force default blocked domains - merge user's custom ones with defaults
    const userDomains = (s.blockedDomains || []).filter(
      (d: string) => !DEFAULT_SETTINGS.blockedDomains.includes(d),
    );
    return {
      ...s,
      settingsVersion: 3,
      blockedDomains: [...DEFAULT_SETTINGS.blockedDomains, ...userDomains],
    };
  },
};

function migrateSettings(settings: Settings): Settings {
  let current = { ...settings };
  const fromVersion = current.settingsVersion || 0;

  for (let v = fromVersion + 1; v <= SETTINGS_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (migration) {
      current = migration(current);
      console.log(`[TabZen] Settings migrated to v${v}`);
    }
  }

  return current;
}

export async function getSettings(): Promise<Settings> {
  const stored = await storage.getItem<Settings>(SETTINGS_KEY);
  if (!stored) return DEFAULT_SETTINGS;

  let settings = { ...DEFAULT_SETTINGS, ...stored };

  // Run migrations if needed
  if ((settings.settingsVersion || 0) < SETTINGS_VERSION) {
    settings = migrateSettings(settings);
    await storage.setItem(SETTINGS_KEY, settings);
  }

  return settings;
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
