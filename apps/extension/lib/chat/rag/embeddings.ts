import { getAiEndpoint } from "../ai-client";

export async function generateEmbedding(text: string): Promise<number[]> {
  const ep = await getAiEndpoint();
  if (!ep) {
    throw new Error(
      "Knowledge base unavailable: configure the sync worker URL",
    );
  }

  const res = await fetch(`${ep.baseUrl}/ai/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ep.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Embedding error (${res.status}): ${error}`);
  }

  const data: { embedding: number[] } = await res.json();
  return data.embedding;
}
