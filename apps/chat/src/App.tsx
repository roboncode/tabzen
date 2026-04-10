import { type Component, createSignal, Show, For } from 'solid-js';
import {
  ChatContainer, ConversationList, Message, MessageAvatar, MessageContent,
  PromptInput, ScrollButton, Loader, PromptSuggestion, ModelSwitcher, VoiceInput,
} from '@tab-zen/chat';
import type { ChatMessage, ModelOption } from '@tab-zen/shared';
import { LocalAdapter } from './adapters/local-adapter';
import { createChatStore } from './stores/chat-store';
import { streamChatCompletion } from './services/openrouter';
import { transcribeAudio } from './services/voice';

// Config — user would enter these in settings
const API_KEY = '';
const CHAT_MODEL = 'openai/gpt-4o-mini';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const GROQ_API_KEY = '';

const MODELS: ModelOption[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
];

const App: Component = () => {
  const adapter = new LocalAdapter({ openRouterApiKey: API_KEY, embeddingModel: EMBEDDING_MODEL });
  const store = createChatStore(adapter);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [currentModel, setCurrentModel] = createSignal(CHAT_MODEL);
  const [streamingContent, setStreamingContent] = createSignal('');

  async function handleSendMessage(text: string) {
    if (!API_KEY) { alert('Please set your OpenRouter API key in App.tsx'); return; }

    if (!store.activeConversationId()) {
      await store.createConversation({ type: 'collection' });
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString(),
    };
    await store.addMessage(userMessage);

    setIsStreaming(true);
    setStreamingContent('');

    const conv = store.activeConversation();
    if (!conv) return;

    const messages = conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      let fullContent = '';
      for await (const chunk of streamChatCompletion(API_KEY, currentModel(), [
        { role: 'system', content: 'You are a helpful assistant. Answer questions based on the user\'s saved content.' },
        ...messages,
      ])) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: fullContent,
        modelId: currentModel(), createdAt: new Date().toISOString(),
      };
      await store.addMessage(assistantMessage);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }

  async function handleVoiceTranscribe(audio: Blob): Promise<string> {
    if (!GROQ_API_KEY) throw new Error('GROQ API key not configured');
    return transcribeAudio(GROQ_API_KEY, audio);
  }

  const suggestions = ['What videos mention React?', 'Summarize recent saves', 'Topics from this week'];

  return (
    <div class="flex h-screen w-screen bg-background text-foreground">
      {/* Sidebar */}
      <Show when={sidebarOpen()}>
        <div class="w-[270px] flex-shrink-0">
          <ConversationList
            groups={store.groups()}
            conversations={store.conversations() ?? []}
            activeId={store.activeConversationId() ?? undefined}
            onSelect={store.selectConversation}
            onNewChat={() => store.createConversation({ type: 'collection' })}
            onToggleSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </Show>

      {/* Collapsed sidebar */}
      <Show when={!sidebarOpen()}>
        <div class="w-12 bg-sidebar flex flex-col items-center py-3 gap-2 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            class="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </Show>

      {/* Main chat area */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div class="px-5 py-3 bg-muted/30 flex items-center justify-between">
          <div>
            <h1 class="text-[15px] font-medium">{store.activeConversation()?.title ?? 'New Chat'}</h1>
            <p class="text-xs text-muted-foreground">Searching all content</p>
          </div>
          <div class="flex items-center gap-2">
            <ModelSwitcher models={MODELS} currentModelId={currentModel()} onModelChange={setCurrentModel} />
          </div>
        </div>

        {/* Messages */}
        <ChatContainer class="flex-1 px-5 py-4">
          <div class="max-w-[760px] mx-auto w-full space-y-4">
            <Show when={store.activeConversation()?.messages.length} fallback={
              <div class="flex-1 flex items-center justify-center text-muted-foreground text-sm pt-20">
                Start a conversation
              </div>
            }>
              <For each={store.activeConversation()?.messages}>
                {(msg) => (
                  <Message role={msg.role}>
                    <Show when={msg.role === 'assistant'}>
                      <MessageAvatar fallback="AI" />
                    </Show>
                    <MessageContent>{msg.content}</MessageContent>
                  </Message>
                )}
              </For>
            </Show>

            {/* Streaming response */}
            <Show when={isStreaming()}>
              <Message role="assistant">
                <MessageAvatar fallback="AI" />
                <MessageContent>
                  <Show when={streamingContent()} fallback={<Loader variant="loading-dots" size="sm" />}>
                    {streamingContent()}
                  </Show>
                </MessageContent>
              </Message>
            </Show>
          </div>
          <ScrollButton />
        </ChatContainer>

        {/* Input area */}
        <div class="px-5 pb-4 pt-2">
          <div class="max-w-[760px] mx-auto">
            <PromptInput
              placeholder="Ask about your saved content..."
              onSubmit={handleSendMessage}
              isLoading={isStreaming()}
              actions={
                <Show when={!!GROQ_API_KEY}>
                  <VoiceInput onTranscribe={handleVoiceTranscribe} onTranscription={(text) => handleSendMessage(text)} />
                </Show>
              }
            />
            <Show when={!store.activeConversation()?.messages.length}>
              <div class="flex gap-2 mt-2 justify-center">
                <For each={suggestions}>
                  {(suggestion) => <PromptSuggestion text={suggestion} onClick={() => handleSendMessage(suggestion)} />}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
