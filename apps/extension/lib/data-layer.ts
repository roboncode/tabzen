import { setServiceActive, isServiceActive } from "./adapter-state";
import { serviceAdapter } from "./adapters/service-adapter";
import { getSettings } from "./settings";
import * as db from "./db";

const SERVICE_HEALTH_URL = "http://localhost:7824/api/health";
const HEALTH_CHECK_INTERVAL = 30_000;

let lastHealthCheck = 0;

export async function checkServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(SERVICE_HEALTH_URL, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function initDataLayer(): Promise<void> {
  const settings = await getSettings();
  const { dataSource } = settings;

  if (dataSource === "local") {
    setServiceActive(false);
    return;
  }

  const healthy = await checkServiceHealth();
  lastHealthCheck = Date.now();

  if (healthy) {
    setServiceActive(true);
  } else if (dataSource === "auto") {
    // Fall back silently to IndexedDB
    setServiceActive(false);
  } else if (dataSource === "service") {
    console.warn("[TabZen] Local service unavailable -- data operations will fail until service is reachable");
    setServiceActive(false);
  }
}

export { isServiceActive };

export async function refreshAdapterIfNeeded(): Promise<void> {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return;
  }
  const settings = await getSettings();
  if (settings.dataSource === "local") {
    setServiceActive(false);
    return;
  }
  const healthy = await checkServiceHealth();
  lastHealthCheck = Date.now();

  if (settings.dataSource === "service" || settings.dataSource === "auto") {
    setServiceActive(healthy);
  }
}

export async function migrateToService(): Promise<{ imported: number; skipped: number }> {
  // Temporarily disable service delegation so we read from IndexedDB
  const wasActive = isServiceActive();
  setServiceActive(false);
  const data = await db.getAllData();
  setServiceActive(wasActive);

  return serviceAdapter.importData({
    pages: data.pages,
    groups: data.groups,
    captures: data.captures,
    templates: data.aiTemplates,
    documents: data.aiDocuments,
  });
}
