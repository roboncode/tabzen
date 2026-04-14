// Adapter state -- determines whether to use the local service or IndexedDB.
// Works across all extension contexts (background, popup, index, sidepanel)
// by reading from WXT storage and checking service health.

import { storage } from "@wxt-dev/storage";

let _serviceActive = false;
let _initPromise: Promise<void> | null = null;

export function setServiceActive(active: boolean) {
  _serviceActive = active;
  // Clear the init promise so future ensureAdapterInit() calls are instant
  _initPromise = Promise.resolve();
}

export function isServiceActive(): boolean {
  return _serviceActive;
}

// Must be awaited before first db operation in any context.
// Safe to call multiple times -- only runs once.
export async function ensureAdapterInit(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = doInit();
  return _initPromise;
}

async function doInit() {
  try {
    const settings = await storage.getItem<Record<string, unknown>>("local:settings");
    if (!settings || settings.dataSource === "local") {
      _serviceActive = false;
      return;
    }

    // dataSource is "service" or "auto" -- check health
    const res = await fetch("http://localhost:7824/api/health", {
      signal: AbortSignal.timeout(2000),
    });
    _serviceActive = res.ok;
  } catch {
    _serviceActive = false;
  }
}
