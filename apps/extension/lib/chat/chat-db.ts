// apps/extension/lib/chat/chat-db.ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Conversation, ConversationGroup } from '@tab-zen/shared';

export interface CompressedContent {
  pageId: string;
  originalTokens: number;
  compressedTokens: number;
  compressedText: string;
  modelUsed: string;
  createdAt: string;
}

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
  compressedContent: {
    key: string;
    value: CompressedContent;
  };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;

export async function getChatDB(): Promise<IDBPDatabase<ChatDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ChatDB>('tab-zen-chat', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by-groupId', 'groupId');
        convStore.createIndex('by-updatedAt', 'updatedAt');

        const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
        groupStore.createIndex('by-sortOrder', 'sortOrder');
      }
      if (oldVersion < 2) {
        db.createObjectStore('compressedContent', { keyPath: 'pageId' });
      }
    },
  });
  return dbInstance;
}
