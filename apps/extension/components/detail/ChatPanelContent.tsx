// apps/extension/components/detail/ChatPanelContent.tsx
import { createSignal, Show, For } from "solid-js";
import { Plus, History, X, MessageCircle, ArrowUp, Mic } from "lucide-solid";
import {
  ChatConfig, ChatContainer, Message, MessageAvatar, MessageContent,
  PromptInput, PromptInputTextarea, PromptInputActions,
  ScrollButton, Loader, PromptSuggestion, ModelSwitcher, VoiceInput, Button,
} from "@tab-zen/chat";
import type { ChatMessage, ModelOption } from "@tab-zen/shared";
import type { DocumentChatStore } from "@/lib/chat/chat-store";
import { streamChatCompletion, buildSystemPrompt, type DocumentChatContext } from "@/lib/chat/chat-streaming";
import { transcribeAudio } from "@/lib/chat/chat-voice";
import { generateConversationTitle } from "@/lib/chat/chat-title";
import type { Settings } from "@/lib/types";
import ChatHistory from "./ChatHistory";

const CHAT_MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
];

interface ChatPanelContentProps {
  store: DocumentChatStore;
  documentContext: DocumentChatContext;
  settings: Settings;
  onClose: () => void;
}

type PanelView = "chat" | "history";

export default function ChatPanelContent(props: ChatPanelContentProps) {
  const [view, setView] = createSignal<PanelView>("chat");
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [promptText, setPromptText] = createSignal("");
  const [currentModel, setCurrentModel] = createSignal(props.settings.chatModel);
  const titleGeneratedFor = new Set<string>();

  const suggestions = [
    "What is this about?",
    "Summarize the key points",
    "What are the main arguments?",
  ];

  const recentConversations = () => {
    const list = props.store.conversations() ?? [];
    return list.slice(0, 3);
  };

  async function handleSendMessage(text: string) {
    if (!props.settings.openRouterApiKey) {
      alert("Please set your OpenRouter API key in Settings → AI");
      return;
    }

    // Create a conversation if none is active
    if (!props.store.activeConversationId()) {
      await props.store.createConversation();
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    await props.store.addMessage(userMessage);

    setIsStreaming(true);
    setStreamingContent("");

    // Build messages from known state to avoid race with async resource refetch
    const conv = props.store.activeConversation();
    const priorMessages = conv ? conv.messages : [];
    const allMessages = [...priorMessages, userMessage].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = buildSystemPrompt(props.documentContext);

    try {
      let fullContent = "";
      for await (const chunk of streamChatCompletion(
        props.settings.openRouterApiKey,
        currentModel(),
        [{ role: "system", content: systemPrompt }, ...allMessages],
      )) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        modelId: currentModel(),
        createdAt: new Date().toISOString(),
      };
      await props.store.addMessage(assistantMessage);

      // Auto-title generation (fire and forget, once per conversation)
      const convId = props.store.activeConversationId();
      if (convId && !titleGeneratedFor.has(convId)) {
        const updatedConv = props.store.activeConversation();
        if (updatedConv && updatedConv.title === "New Thread") {
          const title = await generateConversationTitle(
            props.settings.openRouterApiKey,
            currentModel(),
            [...updatedConv.messages, assistantMessage],
          );
          if (title) {
            await props.store.updateTitle(title);
            titleGeneratedFor.add(convId);
          }
        } else if (updatedConv && updatedConv.title !== "New Thread") {
          titleGeneratedFor.add(convId); // Already titled
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        createdAt: new Date().toISOString(),
      };
      await props.store.addMessage(errorMessage);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }

  async function handleVoiceTranscribe(audio: Blob): Promise<string> {
    if (!props.settings.groqApiKey) throw new Error("Groq API key not configured");
    return transcribeAudio(props.settings.groqApiKey, audio);
  }

  function handleNewConversation() {
    props.store.clearActive();
    setView("chat");
  }

  function handleSelectConversation(id: string) {
    props.store.selectConversation(id);
    setView("chat");
  }

  return (
    <ChatConfig proseSize="sm">
    <div class="flex flex-col h-full min-w-0 overflow-hidden bg-card">
      <Show when={view() === "history"}>
        <ChatHistory
          store={props.store}
          onBack={() => setView("chat")}
          onSelect={handleSelectConversation}
        />
      </Show>

      <Show when={view() === "chat"}>
        {/* Header */}
        <div class="flex items-center justify-between px-3 py-2.5 bg-muted/30 flex-shrink-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-sm font-semibold text-foreground truncate">
              {props.store.activeConversation()?.title ?? "New Thread"}
            </span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <ModelSwitcher
              models={CHAT_MODELS}
              currentModelId={currentModel()}
              onModelChange={setCurrentModel}
            />
            <button
              onClick={handleNewConversation}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="New conversation"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setView("history")}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="History"
            >
              <History size={16} />
            </button>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatContainer class="flex-1 min-w-0 px-3 py-3">
          <div class="space-y-3 min-w-0">
            <Show when={props.store.activeConversation()?.messages.length} fallback={
              <div class="flex-1 flex flex-col items-center justify-center py-12">
                <MessageCircle size={28} class="mb-3 text-muted-foreground/20" />
                <p class="text-sm text-muted-foreground">Ask anything about this page</p>
              </div>
            }>
              <For each={props.store.activeConversation()?.messages}>
                {(msg) => (
                  <Message class={msg.role === "user" ? "justify-end" : "justify-start"}>
                    <Show when={msg.role === "assistant"}>
                      <MessageAvatar src="" alt="AI" fallback="AI" />
                    </Show>
                    <MessageContent>{msg.content}</MessageContent>
                  </Message>
                )}
              </For>
            </Show>

            {/* Streaming response */}
            <Show when={isStreaming()}>
              <Message class="justify-start">
                <MessageAvatar src="" alt="AI" fallback="AI" />
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

        {/* Recent conversations (when no active conversation) */}
        <Show when={!props.store.activeConversationId() && recentConversations().length > 0}>
          <div class="px-3 pb-2 flex-shrink-0">
            <div class="text-xs text-muted-foreground/60 mb-1.5">Recent</div>
            <For each={recentConversations()}>
              {(conv) => (
                <button
                  onClick={() => handleSelectConversation(conv.id)}
                  class="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-foreground/80 hover:bg-muted/30 transition-colors truncate"
                >
                  {conv.title}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Prompt suggestions (when no messages) */}
        <Show when={!props.store.activeConversation()?.messages.length && !props.store.activeConversationId()}>
          <div class="flex gap-1.5 px-3 pb-2 flex-wrap justify-center flex-shrink-0">
            <For each={suggestions}>
              {(suggestion) => (
                <PromptSuggestion onClick={() => handleSendMessage(suggestion)}>
                  {suggestion}
                </PromptSuggestion>
              )}
            </For>
          </div>
        </Show>

        {/* Input */}
        <div class="px-3 pb-3 pt-1 flex-shrink-0">
          <PromptInput
            isLoading={isStreaming()}
            value={promptText()}
            onValueChange={setPromptText}
            onSubmit={() => {
              const text = promptText().trim();
              if (text) {
                setPromptText("");
                handleSendMessage(text);
              }
            }}
          >
            <PromptInputTextarea placeholder="Ask about this page..." class="min-h-[44px] pt-3 pl-4" />
            <PromptInputActions class="mt-2 flex w-full items-center justify-end gap-2 px-3 pb-3">
              <Show when={!!props.settings.groqApiKey}>
                <VoiceInput
                  onTranscribe={handleVoiceTranscribe}
                  onTranscription={(text) => setPromptText((prev) => prev ? prev + " " + text : text)}
                />
              </Show>
              <Button
                size="icon-sm"
                class="rounded-full"
                disabled={!promptText().trim() || isStreaming()}
                onClick={() => {
                  const text = promptText().trim();
                  if (text) {
                    setPromptText("");
                    handleSendMessage(text);
                  }
                }}
              >
                <ArrowUp class="size-4" />
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </Show>
    </div>
    </ChatConfig>
  );
}
