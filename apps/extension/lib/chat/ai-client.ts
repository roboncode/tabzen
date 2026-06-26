import { getSettings, updateSettings } from "@/lib/settings";

export interface AiEndpoint {
  baseUrl: string;
  token: string;
}

/**
 * Resolves the AI proxy endpoint (the deployed sync worker) used for embeddings
 * and chat. Keys live on the worker, so the client only needs a sync token.
 *
 * Always targets the REMOTE worker (`settings.syncUrl`), regardless of
 * `syncEnv` — AI is centralized on the deployed worker. Returns `null` when no
 * worker URL is configured or a token cannot be minted (AI unavailable).
 */
export async function getAiEndpoint(): Promise<AiEndpoint | null> {
  const settings = await getSettings();
  const baseUrl = settings.syncUrl;
  if (!baseUrl) return null;

  let token = settings.syncToken;
  if (!token) {
    try {
      const res = await fetch(`${baseUrl}/sync/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data: { token?: string } = await res.json();
      if (!data.token) return null;
      token = data.token;
      await updateSettings({ syncToken: token });
    } catch {
      return null;
    }
  }

  return { baseUrl, token };
}
