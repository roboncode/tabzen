import type {
  ChatDataAdapter,
  DocumentContext,
  Chunk,
  ChunkResult,
  Conversation,
  ConversationSummary,
  SearchFilters,
} from '@tab-zen/shared';
import { getChatDB } from '../db';
import { cosineSimilarity } from '../services/vector-store';
import { generateEmbedding as generateEmbeddingApi } from '../services/openrouter';

interface LocalAdapterConfig {
  openRouterApiKey: string;
  embeddingModel: string;
}

export class LocalAdapter implements ChatDataAdapter {
  private config: LocalAdapterConfig;

  constructor(config: LocalAdapterConfig) {
    this.config = config;
  }

  async storeDocumentContext(context: DocumentContext): Promise<void> {
    const db = await getChatDB();
    await db.put('documentContexts', context);
  }

  async storeChunks(documentId: string, chunks: Chunk[]): Promise<void> {
    const db = await getChatDB();
    const tx = db.transaction('chunks', 'readwrite');
    for (const chunk of chunks) {
      await tx.store.put(chunk);
    }
    await tx.done;
  }

  async searchSimilar(
    embedding: number[],
    topK: number,
    filters?: SearchFilters,
  ): Promise<ChunkResult[]> {
    const db = await getChatDB();
    let chunks = await db.getAll('chunks');

    if (filters) {
      const contextMap = new Map<string, DocumentContext>();
      const contexts = await db.getAll('documentContexts');
      for (const ctx of contexts) contextMap.set(ctx.documentId, ctx);

      chunks = chunks.filter((chunk) => {
        const ctx = contextMap.get(chunk.documentId);
        if (!ctx) return false;
        if (filters.authors?.length && (!ctx.author || !filters.authors.includes(ctx.author)))
          return false;
        if (filters.contentType && ctx.contentType !== filters.contentType) return false;
        return true;
      });
    }

    const scored = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(embedding, chunk.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);

    const results: ChunkResult[] = [];
    for (const { chunk, score } of topChunks) {
      const context = await db.get('documentContexts', chunk.documentId);
      if (context) results.push({ chunk, context, score });
    }
    return results;
  }

  async getDocumentContext(documentId: string): Promise<DocumentContext> {
    const db = await getChatDB();
    const ctx = await db.get('documentContexts', documentId);
    if (!ctx) throw new Error(`Document context not found: ${documentId}`);
    return ctx;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getChatDB();
    await db.put('conversations', conversation);
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (!conv) throw new Error(`Conversation not found: ${conversationId}`);
    return conv;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const db = await getChatDB();
    const conversations = await db.getAll('conversations');
    return conversations
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        groupId: conv.groupId,
        scope: conv.scope,
        messageCount: conv.messages.length,
        lastMessageAt:
          conv.messages.length > 0
            ? conv.messages[conv.messages.length - 1].createdAt
            : conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const db = await getChatDB();
    await db.delete('conversations', conversationId);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbeddingApi(this.config.openRouterApiKey, this.config.embeddingModel, text);
  }
}
