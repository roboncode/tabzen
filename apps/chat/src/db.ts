import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentContext, Chunk, Conversation, ConversationGroup } from '@tab-zen/shared';

interface ChatDB {
  documentContexts: {
    key: string;
    value: DocumentContext;
    indexes: { 'by-author': string };
  };
  chunks: {
    key: string;
    value: Chunk;
    indexes: { 'by-documentId': string };
  };
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
      const docStore = db.createObjectStore('documentContexts', { keyPath: 'documentId' });
      docStore.createIndex('by-author', 'author');

      const chunkStore = db.createObjectStore('chunks', { keyPath: 'chunkId' });
      chunkStore.createIndex('by-documentId', 'documentId');

      const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
      convStore.createIndex('by-groupId', 'groupId');
      convStore.createIndex('by-updatedAt', 'updatedAt');

      const groupStore = db.createObjectStore('conversationGroups', { keyPath: 'id' });
      groupStore.createIndex('by-sortOrder', 'sortOrder');
    },
  });
  return dbInstance;
}
