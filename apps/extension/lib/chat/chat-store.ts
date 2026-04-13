import { createSignal, createResource, createEffect } from 'solid-js';
import type { Conversation, ChatMessage } from '@tab-zen/shared';
import { ChatAdapter } from './chat-adapter';
import { getDefaultSkillIds } from './chat-skills';

const adapter = new ChatAdapter();

export function createDocumentChatStore(documentId: () => string) {
  const [activeConversationId, setActiveConversationId] = createSignal<string | null>(null);
  const [listKey, setListKey] = createSignal(0);

  const [conversations, { refetch: refetchList }] = createResource(
    () => ({ key: listKey(), docId: documentId() }),
    (params) => adapter.listConversations(params.docId),
  );

  const [activeConversation, { refetch: refetchActive, mutate: mutateActive }] = createResource(
    activeConversationId,
    (id) => (id ? adapter.getConversation(id) : undefined),
  );

  const [conversationSummary, setConversationSummary] = createSignal<string | null>(null);
  const [activeSkillIds, setActiveSkillIds] = createSignal<string[]>([]);

  // Load summary and skill IDs when active conversation changes
  createEffect(() => {
    const id = activeConversationId();
    if (id) {
      adapter.getSummary(id).then((s) => setConversationSummary(s));
      adapter.getActiveSkillIds(id).then((ids) => setActiveSkillIds(ids));
    } else {
      setConversationSummary(null);
      setActiveSkillIds([]);
    }
  });

  async function updateSummary(summary: string) {
    const id = activeConversationId();
    if (!id) return;
    await adapter.updateSummary(id, summary);
    setConversationSummary(summary);
  }

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
    // Set default skills
    const defaults = await getDefaultSkillIds();
    if (defaults.length > 0) {
      await adapter.setActiveSkillIds(id, defaults);
      setActiveSkillIds(defaults);
    }
    refreshList();
    setActiveConversationId(id);
    return id;
  }

  async function addMessage(message: ChatMessage) {
    const id = activeConversationId();
    if (!id) return;
    // Read directly from DB to avoid stale resource cache
    const conv = await adapter.getConversation(id);
    if (!conv) return;
    const updated: Conversation = {
      ...conv,
      messages: [...conv.messages, message],
      updatedAt: new Date().toISOString(),
    };
    await adapter.saveConversation(updated);
    mutateActive(updated);
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

  function clearActive() {
    setActiveConversationId(null);
    mutateActive(undefined);
  }

  async function toggleSkill(skillId: string) {
    const current = activeSkillIds();
    const id = activeConversationId();
    const updated = current.includes(skillId)
      ? current.filter((s) => s !== skillId)
      : [...current, skillId];
    setActiveSkillIds(updated);
    if (id) {
      await adapter.setActiveSkillIds(id, updated);
    }
  }

  return {
    conversations,
    activeConversation,
    activeConversationId,
    conversationSummary,
    activeSkillIds,
    createConversation,
    addMessage,
    updateTitle,
    updateSummary,
    toggleSkill,
    deleteConversation,
    deleteAllConversations,
    selectConversation,
    clearActive,
    refreshList,
  };
}

export type DocumentChatStore = ReturnType<typeof createDocumentChatStore>;
