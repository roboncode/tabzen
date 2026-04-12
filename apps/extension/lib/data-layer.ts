import type { DataAdapter } from "./adapters/types";
import { indexeddbAdapter } from "./adapters/indexeddb-adapter";
import { serviceAdapter } from "./adapters/service-adapter";
import { getSettings } from "./settings";

const SERVICE_HEALTH_URL = "http://localhost:7824/api/health";
const HEALTH_CHECK_INTERVAL = 30_000;

let activeAdapter: DataAdapter = indexeddbAdapter;
let serviceHealthy = false;
let lastHealthCheck = 0;

async function checkServiceHealth(): Promise<boolean> {
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

function selectAdapter(dataSource: "local" | "service" | "auto", healthy: boolean): DataAdapter {
  if (dataSource === "service" && healthy) return serviceAdapter;
  if (dataSource === "auto" && healthy) return serviceAdapter;
  return indexeddbAdapter;
}

export async function initDataLayer(): Promise<DataAdapter> {
  const settings = await getSettings();
  serviceHealthy = await checkServiceHealth();
  lastHealthCheck = Date.now();
  activeAdapter = selectAdapter(settings.dataSource, serviceHealthy);
  return activeAdapter;
}

export function getAdapter(): DataAdapter {
  return activeAdapter;
}

export function isServiceActive(): boolean {
  return activeAdapter === serviceAdapter;
}

export async function refreshAdapterIfNeeded(): Promise<DataAdapter> {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return activeAdapter;
  }
  const settings = await getSettings();
  if (settings.dataSource === "local") {
    activeAdapter = indexeddbAdapter;
    return activeAdapter;
  }
  serviceHealthy = await checkServiceHealth();
  lastHealthCheck = Date.now();
  activeAdapter = selectAdapter(settings.dataSource, serviceHealthy);
  return activeAdapter;
}

export async function migrateToService(): Promise<{ imported: number; skipped: number }> {
  const allData = await indexeddbAdapter.getAllData();
  return serviceAdapter.importData({
    pages: allData.pages,
    groups: allData.groups,
    captures: allData.captures,
    templates: allData.aiTemplates,
    documents: allData.aiDocuments,
  });
}
