import { createSignal, createResource } from 'solid-js';
import type { ChatDataAdapter, Conversation, ConversationGroup, ConversationScope, ChatMessage } from '@tab-zen/shared';

export function createChatStore(adapter: ChatDataAdapter) {
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [conversationListKey, setConversationListKey] = createSignal(0);

  const [conversations] = createResource(conversationListKey, () => adapter.listConversations());
  const [activeConversation, { refetch: refetchActive }] = createResource(
    activeConversationId,
    (id) => (id ? adapter.getConversation(id) : undefined)
  );

  const [groups, setGroups] = createSignal<ConversationGroup[]>([]);

  function refreshList() { setConversationListKey((k) => k + 1); }

  async function createConversation(scope: ConversationScope): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: Conversation = { id, title: 'New chat', scope, messages: [], createdAt: now, updatedAt: now };
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
      title: conv.messages.length === 0 ? message.content.slice(0, 50) : conv.title,
      updatedAt: new Date().toISOString(),
    };
    await adapter.saveConversation(updated);
    refetchActive();
    refreshList();
  }

  async function deleteConversation(id: string) {
    await adapter.deleteConversation(id);
    if (activeConversationId() === id) setActiveConversationId(null);
    refreshList();
  }

  function selectConversation(id: string) { setActiveConversationId(id); }

  return {
    conversations, activeConversation, activeConversationId,
    groups, setGroups,
    createConversation, addMessage, deleteConversation, selectConversation, refreshList,
  };
}
