// apps/extension/lib/chat/chat-adapter.ts
import type { Conversation, ConversationSummary } from '@tab-zen/shared';
import { getChatDB, type CompressedContent } from './chat-db';

export class ChatAdapter {
  async saveConversation(conversation: Conversation): Promise<void> {
    const db = await getChatDB();
    await db.put('conversations', conversation);
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const db = await getChatDB();
    return db.get('conversations', conversationId);
  }

  async listConversations(documentId?: string): Promise<ConversationSummary[]> {
    const db = await getChatDB();
    const conversations = await db.getAll('conversations');
    const filtered = documentId
      ? conversations.filter((c) => c.scope.type === 'document' && c.scope.documentId === documentId)
      : conversations;

    return filtered
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

  async deleteAllConversations(documentId: string): Promise<void> {
    const db = await getChatDB();
    const all = await db.getAll('conversations');
    const tx = db.transaction('conversations', 'readwrite');
    for (const conv of all) {
      if (conv.scope.type === 'document' && conv.scope.documentId === documentId) {
        await tx.store.delete(conv.id);
      }
    }
    await tx.done;
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      conv.title = title;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }

  async updateSummary(conversationId: string, summary: string): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      (conv as any).summary = summary;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }

  async getSummary(conversationId: string): Promise<string | null> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    return (conv as any)?.summary ?? null;
  }

  async getActiveSkillIds(conversationId: string): Promise<string[]> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    return (conv as any)?.activeSkillIds ?? [];
  }

  async setActiveSkillIds(conversationId: string, skillIds: string[]): Promise<void> {
    const db = await getChatDB();
    const conv = await db.get('conversations', conversationId);
    if (conv) {
      (conv as any).activeSkillIds = skillIds;
      conv.updatedAt = new Date().toISOString();
      await db.put('conversations', conv);
    }
  }

  async getCompressedContent(pageId: string): Promise<CompressedContent | undefined> {
    const db = await getChatDB();
    return db.get('compressedContent', pageId);
  }

  async saveCompressedContent(content: CompressedContent): Promise<void> {
    const db = await getChatDB();
    await db.put('compressedContent', content);
  }

  async deleteCompressedContent(pageId: string): Promise<void> {
    const db = await getChatDB();
    await db.delete('compressedContent', pageId);
  }
}
