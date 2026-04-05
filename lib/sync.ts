import type { SyncPayload } from "./types";
import { getSettings } from "./settings";

async function syncRequest(endpoint: string, body?: unknown): Promise<Response> {
  const settings = await getSettings();
  if (!settings.syncToken) throw new Error("No sync token configured");

  const response = await fetch(`${settings.syncUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.syncToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync error: ${response.status} - ${text}`);
  }

  return response;
}

export async function initSync(): Promise<string> {
  const response = await syncRequest("/sync/init");
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

export async function pullSync(lastSyncedAt: string): Promise<SyncPayload | null> {
  const response = await syncRequest("/sync/pull", { since: lastSyncedAt });
  const data = await response.json();
  if (!data.tabs?.length && !data.groups?.length && !data.captures?.length) {
    return null;
  }
  return data;
}
