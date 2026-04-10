import { describe, it, expect } from 'vitest';
import { chunkTranscript, chunkMarkdown, generateDocumentContext } from '../../src/services/chunking';

describe('chunkTranscript', () => {
  it('chunks transcript segments by time window', () => {
    const segments = [
      { start: 0, text: 'Hello everyone' },
      { start: 30, text: 'Today we talk about databases' },
      { start: 60, text: 'First up is Postgres' },
      { start: 120, text: 'Next is SQLite' },
      { start: 180, text: 'And finally Turso' },
      { start: 240, text: 'Thanks for watching' },
    ];
    const chunks = chunkTranscript(segments, { windowSeconds: 120 });
    expect(chunks.length).toBe(3);
    expect(chunks[0].text).toContain('Hello everyone');
    expect(chunks[0].text).toContain('First up is Postgres');
    expect(chunks[0].metadata.timestampStart).toBe('0:00');
  });
});

describe('chunkMarkdown', () => {
  it('chunks by headings', () => {
    const markdown = `# Introduction\nSome intro text here.\n\n## Section One\nContent of section one.\n\n## Section Two\nContent of section two.`;
    const chunks = chunkMarkdown(markdown);
    expect(chunks.length).toBe(3);
    expect(chunks[0].metadata.sectionHeading).toBe('Introduction');
    expect(chunks[1].metadata.sectionHeading).toBe('Section One');
  });
});

describe('generateDocumentContext', () => {
  it('creates context from page metadata', () => {
    const ctx = generateDocumentContext({
      documentId: 'page-1',
      title: 'Test Video',
      url: 'https://youtube.com/watch?v=123',
      author: 'TechChannel',
      capturedAt: '2026-04-10',
      contentType: 'transcript',
      fullContent:
        'Hello everyone, today we talk about databases and their uses in modern development.',
    });
    expect(ctx.title).toBe('Test Video');
    expect(ctx.framingContent.length).toBeGreaterThan(0);
    expect(ctx.framingContent.length).toBeLessThanOrEqual(500);
  });
});
