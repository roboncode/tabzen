import type { DocumentContext, ChunkMetadata } from '@tab-zen/shared';

interface TranscriptSegment {
  start: number;
  text: string;
}

interface ChunkOptions {
  windowSeconds?: number;
}

interface RawChunk {
  text: string;
  position: number;
  metadata: ChunkMetadata;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function chunkTranscript(
  segments: TranscriptSegment[],
  options: ChunkOptions = {},
): RawChunk[] {
  const windowSeconds = options.windowSeconds ?? 120;
  const chunks: RawChunk[] = [];
  let currentChunk: TranscriptSegment[] = [];
  let windowStart = 0;
  let position = 0;

  for (const segment of segments) {
    if (segment.start - windowStart >= windowSeconds && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.map((s) => s.text).join(' '),
        position,
        metadata: {
          timestampStart: formatTimestamp(windowStart),
          timestampEnd: formatTimestamp(currentChunk[currentChunk.length - 1].start),
        },
      });
      position++;
      windowStart = segment.start;
      currentChunk = [];
    }
    currentChunk.push(segment);
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.map((s) => s.text).join(' '),
      position,
      metadata: {
        timestampStart: formatTimestamp(windowStart),
        timestampEnd: formatTimestamp(currentChunk[currentChunk.length - 1].start),
      },
    });
  }

  return chunks;
}

export function chunkMarkdown(markdown: string): RawChunk[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const sections: { heading: string; content: string; start: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].content = markdown
        .slice(sections[sections.length - 1].start, match.index)
        .trim();
    }
    sections.push({ heading: match[2], content: '', start: match.index + match[0].length });
  }

  if (sections.length > 0) {
    sections[sections.length - 1].content = markdown
      .slice(sections[sections.length - 1].start)
      .trim();
  }

  if (sections.length === 0) {
    const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim());
    const chunkSize = 3;
    const chunks: RawChunk[] = [];
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      chunks.push({
        text: paragraphs.slice(i, i + chunkSize).join('\n\n'),
        position: chunks.length,
        metadata: {},
      });
    }
    return chunks;
  }

  return sections.map((section, i) => ({
    text: `${section.heading}\n\n${section.content}`,
    position: i,
    metadata: { sectionHeading: section.heading },
  }));
}

interface DocumentContextInput {
  documentId: string;
  title: string;
  url: string;
  author?: string;
  capturedAt: string;
  contentType: 'transcript' | 'markdown';
  fullContent: string;
}

export function generateDocumentContext(input: DocumentContextInput): DocumentContext {
  const framingContent = input.fullContent.slice(0, 500).trim();
  return {
    documentId: input.documentId,
    title: input.title,
    url: input.url,
    author: input.author,
    capturedAt: input.capturedAt,
    contentType: input.contentType,
    framingContent,
  };
}
