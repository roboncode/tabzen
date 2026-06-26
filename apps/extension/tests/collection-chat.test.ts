import { describe, it, expect } from 'vitest';
import type { Chunk, ChunkResult, DocumentContext, SearchFilters } from '@tab-zen/shared';
import {
  scopeToFilters,
  buildSourcesBlock,
  buildCollectionSystemPrompt,
  buildCollectionMessages,
  parseCitations,
} from '@/lib/chat/collection-chat';

function makeContext(overrides: Partial<DocumentContext> = {}): DocumentContext {
  return {
    documentId: 'doc-1',
    title: 'Doc One',
    url: 'https://example.com/one',
    capturedAt: '2026-06-25T00:00:00.000Z',
    contentType: 'markdown',
    framingContent: 'framing',
    ...overrides,
  };
}

function makeChunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    text: 'chunk text',
    embedding: [0, 0, 0],
    position: 0,
    metadata: {},
    ...overrides,
  };
}

function makeResult(overrides: {
  context?: Partial<DocumentContext>;
  chunk?: Partial<Chunk>;
  score?: number;
} = {}): ChunkResult {
  return {
    chunk: makeChunk(overrides.chunk),
    context: makeContext(overrides.context),
    score: overrides.score ?? 0.9,
  };
}

describe('scopeToFilters', () => {
  it('returns the filters for a collection scope that has them', () => {
    const filters: SearchFilters = { authors: ['Ada'], contentType: 'transcript' };
    expect(scopeToFilters({ type: 'collection', filters })).toBe(filters);
  });

  it('returns undefined for a collection scope without filters', () => {
    expect(scopeToFilters({ type: 'collection' })).toBeUndefined();
  });

  it('returns undefined for a collection scope with an empty filters object', () => {
    expect(scopeToFilters({ type: 'collection', filters: {} })).toBeUndefined();
  });

  it('returns undefined for a document scope even when filters are present', () => {
    expect(
      scopeToFilters({ type: 'document', documentId: 'doc-1', filters: { authors: ['Ada'] } }),
    ).toBeUndefined();
  });
});

describe('buildSourcesBlock', () => {
  it('numbers entries 1..N and includes title, author, and timestamp', () => {
    const results = [
      makeResult({
        context: { title: 'First', author: 'Ada' },
        chunk: { text: 'alpha', metadata: { timestampStart: '1:23' } },
      }),
      makeResult({
        context: { documentId: 'doc-2', title: 'Second' },
        chunk: { chunkId: 'chunk-2', documentId: 'doc-2', text: 'beta', metadata: {} },
      }),
    ];

    const block = buildSourcesBlock(results);

    expect(block).toContain('[1] First — Ada (1:23)');
    expect(block).toContain('alpha');
    expect(block).toContain('[2] Second');
    expect(block).toContain('beta');
    // second entry has no author dash and no timestamp parens
    expect(block).not.toContain('[2] Second —');
    expect(block).not.toContain('[2] Second (');
    // entries separated by a blank line
    expect(block).toContain('alpha\n\n[2] Second');
  });

  it('truncates long chunk text to roughly the snippet limit', () => {
    const longText = 'x'.repeat(900);
    const block = buildSourcesBlock([makeResult({ chunk: { text: longText } })]);

    expect(block).toContain('…');
    expect(block).not.toContain(longText);
    // header line + truncated body well under the original 900 chars
    expect(block.length).toBeLessThan(700);
  });
});

describe('buildCollectionSystemPrompt', () => {
  it('includes the sources block and a citation instruction', () => {
    const sourcesBlock = buildSourcesBlock([
      makeResult({ context: { title: 'Cited Doc' }, chunk: { text: 'fact' } }),
    ]);
    const prompt = buildCollectionSystemPrompt(sourcesBlock);

    expect(prompt).toContain(sourcesBlock);
    expect(prompt).toContain('Sources');
    // citation instruction references bracketed indices
    expect(prompt).toMatch(/\[1\]/);
  });
});

describe('buildCollectionMessages', () => {
  it('places the system message first and the question last with history in between', () => {
    const results = [makeResult()];
    const history = [
      { role: 'user' as const, content: 'earlier question' },
      { role: 'assistant' as const, content: 'earlier answer' },
    ];

    const messages = buildCollectionMessages('new question', results, history);

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'earlier question' });
    expect(messages[2]).toEqual({ role: 'assistant', content: 'earlier answer' });
    expect(messages[3]).toEqual({ role: 'user', content: 'new question' });
  });

  it('works with empty history', () => {
    const messages = buildCollectionMessages('only question', [makeResult()], []);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: 'only question' });
  });
});

describe('parseCitations', () => {
  const results: ChunkResult[] = [
    makeResult({
      context: { documentId: 'doc-1', title: 'One', url: 'https://example.com/1' },
      chunk: {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        text: 'first chunk body',
        metadata: { timestampStart: '0:30' },
      },
    }),
    makeResult({
      context: { documentId: 'doc-2', title: 'Two', url: 'https://example.com/2' },
      chunk: {
        chunkId: 'chunk-2',
        documentId: 'doc-2',
        text: 'second chunk body',
        metadata: {},
      },
    }),
  ];

  it('dedupes repeated references and maps fields correctly', () => {
    const citations = parseCitations('See [1][1] for details.', results);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      documentId: 'doc-1',
      chunkId: 'chunk-1',
      title: 'One',
      snippet: 'first chunk body',
      url: 'https://example.com/1',
      timestamp: '0:30',
    });
  });

  it('ignores out-of-range references', () => {
    const citations = parseCitations('Per [9] and [2].', results);

    expect(citations).toHaveLength(1);
    expect(citations[0].documentId).toBe('doc-2');
    expect(citations[0].timestamp).toBeUndefined();
  });

  it('returns citations in ascending source-number order', () => {
    const citations = parseCitations('Look at [2] then [1].', results);

    expect(citations.map((c) => c.documentId)).toEqual(['doc-1', 'doc-2']);
  });

  it('returns an empty array when there are no references', () => {
    expect(parseCitations('No citations here.', results)).toEqual([]);
  });

  it('truncates the citation snippet to 200 chars', () => {
    const longResults: ChunkResult[] = [
      makeResult({ chunk: { text: 'y'.repeat(500) } }),
    ];
    const citations = parseCitations('[1]', longResults);
    expect(citations[0].snippet).toHaveLength(200);
  });
});
