import { describe, it, expect } from 'vitest';
import { cosineSimilarity, findTopK } from '../../src/services/vector-store';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
});

describe('findTopK', () => {
  it('returns top K results sorted by score', () => {
    const query = [1, 0, 0];
    const entries = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0, 1, 0] },
      { id: 'c', embedding: [0.7, 0.7, 0] },
    ];
    const results = findTopK(query, entries, 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('a');
    expect(results[1].id).toBe('c');
  });
});
