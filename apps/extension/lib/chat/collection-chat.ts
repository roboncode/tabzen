import type {
  Citation,
  ChunkResult,
  ConversationScope,
  SearchFilters,
} from '@tab-zen/shared';
import { createLocalChatAdapter } from './local-chat-adapter';

/** A chat turn in the format an LLM chat-completion API expects. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** A message in an LLM chat-completion request (turns plus the system message). */
export interface ChatRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Max characters of chunk text shown per source in the Sources block. */
const SOURCE_SNIPPET_CHARS = 500;
/** Max characters of chunk text stored on a parsed Citation. */
const CITATION_SNIPPET_CHARS = 200;

/** True when a SearchFilters object carries no meaningful constraint. */
function isEmptyFilters(filters: SearchFilters | undefined): boolean {
  if (!filters) return true;
  return (
    !filters.tags?.length &&
    !filters.authors?.length &&
    !filters.contentType &&
    !filters.dateRange
  );
}

/**
 * Map a conversation scope to the retrieval filters used by `searchSimilar`.
 * Document-scoped chat doesn't use retrieval, so it always returns undefined.
 * Collection-scoped chat returns its filters, or undefined when none are set.
 */
export function scopeToFilters(scope: ConversationScope): SearchFilters | undefined {
  if (scope.type !== 'collection') return undefined;
  return isEmptyFilters(scope.filters) ? undefined : scope.filters;
}

/**
 * Embed the question and retrieve the most similar chunks from the local KB.
 * Hits the embedding API and IndexedDB via the local chat adapter.
 */
export async function retrieveChunks(
  question: string,
  filters: SearchFilters | undefined,
  topK = 8,
): Promise<ChunkResult[]> {
  const adapter = await createLocalChatAdapter();
  const embedding = await adapter.generateEmbedding(question);
  return adapter.searchSimilar(embedding, topK, filters);
}

/** Trim text to a max length, appending an ellipsis when truncated. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Render retrieved chunks as a numbered list the LLM can cite. Numbering is
 * 1-based and matches the array order, so `[n]` references map to `results[n-1]`.
 */
export function buildSourcesBlock(results: ChunkResult[]): string {
  return results
    .map((result, index) => {
      const { chunk, context } = result;
      const author = context.author ? ` — ${context.author}` : '';
      const timestamp = chunk.metadata.timestampStart
        ? ` (${chunk.metadata.timestampStart})`
        : '';
      const header = `[${index + 1}] ${context.title}${author}${timestamp}`;
      const body = truncate(chunk.text.trim(), SOURCE_SNIPPET_CHARS);
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

/**
 * Base system prompt for collection (knowledge-base) chat. The numbered Sources
 * block is appended by `buildCollectionSystemPrompt`.
 */
export const COLLECTION_SYSTEM_PROMPT = [
  'You are a knowledge-base assistant that answers questions about the user\'s saved content.',
  'Answer ONLY using the numbered sources provided below. Do not rely on outside knowledge.',
  'Cite every claim with bracketed source numbers like [1] or [1][2] that refer to the numbered sources.',
  'If the sources do not contain the answer, say you don\'t know rather than guessing.',
].join('\n');

/**
 * Build the full collection system prompt: the base instructions followed by
 * the numbered Sources block.
 */
export function buildCollectionSystemPrompt(sourcesBlock: string): string {
  return `${COLLECTION_SYSTEM_PROMPT}\n\nSources:\n${sourcesBlock}`;
}

/**
 * Assemble the message array for a collection chat completion: the system
 * prompt (with sources), prior conversation history, then the new question.
 */
export function buildCollectionMessages(
  question: string,
  results: ChunkResult[],
  history: ChatTurn[],
): ChatRequestMessage[] {
  return [
    { role: 'system', content: buildCollectionSystemPrompt(buildSourcesBlock(results)) },
    ...history,
    { role: 'user', content: question },
  ];
}

/**
 * Parse bracketed `[n]` citation references from assistant text and map them
 * back to the retrieved sources. Deduplicates, ignores out-of-range numbers,
 * and returns citations in ascending source-number order.
 */
export function parseCitations(text: string, results: ChunkResult[]): Citation[] {
  const seen = new Set<number>();
  const matches = text.matchAll(/\[(\d+)\]/g);
  for (const match of matches) {
    const n = Number.parseInt(match[1], 10);
    if (n >= 1 && n <= results.length) seen.add(n);
  }

  return [...seen]
    .sort((a, b) => a - b)
    .map((n) => {
      const { chunk, context } = results[n - 1];
      return {
        number: n,
        documentId: context.documentId,
        chunkId: chunk.chunkId,
        title: context.title,
        snippet: chunk.text.slice(0, CITATION_SNIPPET_CHARS),
        url: context.url,
        timestamp: chunk.metadata.timestampStart,
      };
    });
}
