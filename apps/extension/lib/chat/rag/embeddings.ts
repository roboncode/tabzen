const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';

export async function generateEmbedding(
  apiKey: string,
  model: string,
  text: string,
): Promise<number[]> {
  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding error (${response.status}): ${error}`);
  }
  const data = await response.json();
  return data.data[0].embedding;
}
