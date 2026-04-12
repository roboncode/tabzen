import { createSignal, createResource } from 'solid-js';
import type { Conversation, ChatMessage } from '@tab-zen/shared';
import { ChatAdapter } from './chat-adapter';

const adapter = new ChatAdapter();

export function createDocumentChatStore(documentId: () => string) {
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [listKey, setListKey] = createSignal(0);

  const [conversations, { refetch: refetchList }] = createResource(
    () => ({ key: listKey(), docId: documentId() }),
    (params) => adapter.listConversations(params.docId),
  );

  const [activeConversation, { refetch: refetchActive }] = createResource(
    activeConversationId,
    (id) => (id ? adapter.getConversation(id) : undefined),
  );

  function refreshList() { setListKey((k) => k + 1); }

  async function createConversation(): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id,
      title: 'New Thread',
      scope: { type: 'document', documentId: documentId() },
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await adapter.saveConversation(conversation);
    refreshList();
    setActiveConversationId(id);
    return id;
  }

  async function addMessage(message: ChatMessage) {
    const conv = activeConversation();
    if (!conv) return;
    const updated: Conversation = {
      ...conv,
      messages: [...conv.messages, message],
      updatedAt: new Date().toISOString(),
    };
    await adapter.saveConversation(updated);
    refetchActive();
    refreshList();
  }

  async function updateTitle(title: string) {
    const id = activeConversationId();
    if (!id) return;
    await adapter.renameConversation(id, title);
    refetchActive();
    refreshList();
  }

  async function deleteConversation(id: string) {
    await adapter.deleteConversation(id);
    if (activeConversationId() === id) setActiveConversationId(null);
    refreshList();
  }

  async function deleteAllConversations() {
    await adapter.deleteAllConversations(documentId());
    setActiveConversationId(null);
    refreshList();
  }

  function selectConversation(id: string) { setActiveConversationId(id); }

  function clearActive() { setActiveConversationId(null); }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    addMessage,
    updateTitle,
    deleteConversation,
    deleteAllConversations,
    selectConversation,
    clearActive,
    refreshList,
  };
}

export type DocumentChatStore = ReturnType<typeof createDocumentChatStore>;
