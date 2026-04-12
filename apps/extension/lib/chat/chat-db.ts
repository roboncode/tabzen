// apps/extension/lib/chat/chat-db.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Conversation, ConversationGroup } from '@tab-zen/shared';

interface ChatDB {
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by-groupId': string;
      'by-updatedAt': string;
    };
  };
  conversationGroups: {
    key: string;
    value: ConversationGroup;
    indexes: { 'by-sortOrder': number };
  };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;

export async function getChatDB(): Promise<IDBPDatabase<ChatDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatDB>('tab-zen-chat', 1, {
    upgrade(db) {
      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by-groupId', 'groupId');
      convStore.createIndex('by-updatedAt', 'updatedAt');

      const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
      groupStore.createIndex('by-sortOrder', 'sortOrder');
    },
  });
  return dbInstance;
}
