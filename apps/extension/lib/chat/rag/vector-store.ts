export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

interface EmbeddingEntry {
  id: string;
  embedding: number[];
}

interface ScoredEntry {
  id: string;
  score: number;
}

export function findTopK(
  query: number[],
  entries: EmbeddingEntry[],
  k: number,
): ScoredEntry[] {
  const scored = entries.map((entry) => ({
    id: entry.id,
    score: cosineSimilarity(query, entry.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
