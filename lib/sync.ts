import type { SyncPayload } from "./types";
import { getSettings } from "./settings";

function getSyncUrl(syncUrl: string, syncLocalUrl: string, syncEnv: string): string {
  if (syncEnv === "local") return syncLocalUrl || "http://localhost:8787";
  return syncUrl;
}

async function syncRequest(
  endpoint: string,
  body?: unknown,
  tokenOverride?: string | null,
): Promise<Response> {
  const settings = await getSettings();
  const baseUrl = getSyncUrl(settings.syncUrl, settings.syncLocalUrl, settings.syncEnv);
  const activeToken = settings.syncEnv === "local" ? settings.syncLocalToken : settings.syncToken;
  const token = tokenOverride ?? activeToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync error: ${response.status} - ${text}`);
  }

  return response;
}

export async function initSync(): Promise<string> {
  // Init doesn't need a token -- it creates one
  const response = await syncRequest("/sync/init", undefined, "init");
  const data = await response.json();
  return data.token;
}

export async function checkConnection(): Promise<boolean> {
  try {
    const settings = await getSettings();
    const baseUrl = getSyncUrl(settings.syncUrl, settings.syncLocalUrl, settings.syncEnv);
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok || response.status === 404; // 404 means server is up, just no route for GET /
  } catch {
    return false;
  }
}

export async function verifySync(): Promise<boolean> {
  try {
    const response = await syncRequest("/sync/verify");
    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export async function pushSync(payload: SyncPayload): Promise<void> {
  await syncRequest("/sync/push", payload);
}

export async function pullSync(
  lastSyncedAt: string,
): Promise<SyncPayload | null> {
  const response = await syncRequest("/sync/pull", { since: lastSyncedAt });
  const data = await response.json();
  if (!data.tabs?.length && !data.groups?.length && !data.captures?.length) {
    return null;
  }
  return data;
}
