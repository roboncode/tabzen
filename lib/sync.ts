import type { SyncPayload } from "./types";
import { getSettings } from "./settings";

const LOCAL_URL = "http://localhost:8787";

function getSyncUrl(syncUrl: string, syncEnv: string): string {
  if (syncEnv === "local") return LOCAL_URL;
  return syncUrl;
}

async function syncRequest(
  endpoint: string,
  body?: unknown,
  tokenOverride?: string | null,
): Promise<Response> {
  const settings = await getSettings();
  const baseUrl = getSyncUrl(settings.syncUrl, settings.syncEnv);
  const token = tokenOverride ?? settings.syncToken;

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
