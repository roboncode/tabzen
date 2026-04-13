// apps/extension/components/detail/ChatPanelContent.tsx
import { createSignal, createResource, createMemo, Show, For } from "solid-js";
import {
  Plus,
  History,
  X,
  MessageCircle,
  ArrowUp,
  Mic,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Code,
  Zap,
} from "lucide-solid";
import {
  ChatConfig,
  ChatContainer,
  Message,
  MessageContent,
  MessageActions,
  MessageSkills,
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  ScrollButton,
  Loader,
  PromptSuggestion,
  ModelSwitcher,
  VoiceInput,
  Button,
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  SlashCommand,
  type SlashCommandItem,
} from "@tab-zen/chat";
import type { ChatMessage } from "@tab-zen/shared";
import type { DocumentChatStore } from "@/lib/chat/chat-store";
import {
  streamChatCompletion,
  type DocumentChatContext,
} from "@/lib/chat/chat-streaming";
import {
  preparePayload,
  needsCompaction,
  compactConversation,
  type ContextSnapshot,
  MIN_RECENT_MESSAGES,
} from "@/lib/chat/chat-context-manager";
import { CHAT_MODELS } from "@/lib/chat/chat-models";
import { transcribeAudio } from "@/lib/chat/chat-voice";
import { generateConversationTitle } from "@/lib/chat/chat-title";
import { getOrCompressContent } from "@/lib/chat/chat-compress";
import type { Settings } from "@/lib/types";
import ChatHistory from "./ChatHistory";
import ChatDebugPanel from "./ChatDebugPanel";
import ChatSkillPicker from "./ChatSkillPicker";
import { buildSkillPrompt, getAllSkills } from "@/lib/chat/chat-skills";
import type { ChatSkill } from "@/lib/chat/chat-db";

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
  const [currentModel, setCurrentModel] = createSignal(
    props.settings.chatModel,
  );
  const [contextSnapshot, setContextSnapshot] =
    createSignal<ContextSnapshot | null>(null);
  const [debugOpen, setDebugOpen] = createSignal(false);
  const [lastSystemPrompt, setLastSystemPrompt] = createSignal<string | null>(
    null,
  );
  const [lastMessagesPayload, setLastMessagesPayload] = createSignal<
    Array<{ role: string; content: string }>
  >([]);
  const [compressionStatus, setCompressionStatus] = createSignal("");
  const [compressedContent, setCompressedContent] = createSignal<string | null>(
    null,
  );
  const [compressionInfo, setCompressionInfo] = createSignal<{
    originalTokens: number;
    compressedTokens: number;
  } | null>(null);
  const [compressionEnabled, setCompressionEnabled] = createSignal(
    props.settings.chatCompression,
  );
  const [allSkills] = createResource(getAllSkills);
  const titleGeneratedFor = new Set<string>();

  const slashCommands = createMemo<SlashCommandItem[]>(() => {
    const skills = allSkills() ?? [];
    return skills.map((s: ChatSkill) => ({
      id: s.id,
      label: s.name,
      description: s.description,
      category: "Skills",
    }));
  });

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

    // Compress content on first use (cached for subsequent messages)
    // Only compress if enabled in settings and content is long enough (~5000+ tokens)
    const MIN_COMPRESS_LENGTH = 17500; // ~5000 tokens at 3.5 chars/token
    let docContent = props.documentContext.content;
    let compInfo = compressionInfo();

    if (
      compressionEnabled() &&
      !compressedContent() &&
      docContent.length > MIN_COMPRESS_LENGTH
    ) {
      try {
        const result = await getOrCompressContent(
          props.documentContext.url,
          docContent,
          props.settings.openRouterApiKey,
          currentModel(),
          setCompressionStatus,
        );
        setCompressedContent(result.compressed.compressedText);
        setCompressionInfo({
          originalTokens: result.compressed.originalTokens,
          compressedTokens: result.compressed.compressedTokens,
        });
        docContent = result.compressed.compressedText;
        compInfo = {
          originalTokens: result.compressed.originalTokens,
          compressedTokens: result.compressed.compressedTokens,
        };
      } catch (err) {
        console.error("Compression failed, using original:", err);
      }
    } else if (compressionEnabled() && compressedContent()) {
      docContent = compressedContent()!;
      compInfo = compressionInfo();
    }

    const chatContext = { ...props.documentContext, content: docContent };
    const skillPrompt = buildSkillPrompt(
      props.store.activeSkillIds(),
      allSkills() ?? [],
    );

    // Read messages from store — addMessage already mutated with the user message included
    const conv = props.store.activeConversation();
    const allMessages = conv ? [...conv.messages] : [userMessage];

    // Prepare payload with context window management
    const { messages: llmMessages, snapshot } = preparePayload(
      chatContext,
      allMessages,
      props.store.conversationSummary(),
      currentModel(),
      compInfo ?? undefined,
      skillPrompt || undefined,
    );

    setContextSnapshot(snapshot);
    setLastSystemPrompt(
      llmMessages.find((m) => m.role === "system")?.content ?? null,
    );
    setLastMessagesPayload(llmMessages.filter((m) => m.role !== "system"));

    const shouldCompact = needsCompaction(snapshot);

    try {
      let fullContent = "";
      for await (const chunk of streamChatCompletion(
        props.settings.openRouterApiKey,
        currentModel(),
        llmMessages,
      )) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      setIsStreaming(false);
      setStreamingContent("");

      const activeSkills = props.store.activeSkillIds();
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        modelId: currentModel(),
        createdAt: new Date().toISOString(),
        ...(activeSkills.length > 0 ? { skillIds: activeSkills } : {}),
      } as ChatMessage;
      await props.store.addMessage(assistantMessage);

      // Compact if needed (after saving the response)
      if (shouldCompact) {
        const messagesToCompact = allMessages.slice(
          0,
          allMessages.length - MIN_RECENT_MESSAGES,
        );
        if (messagesToCompact.length > 0) {
          const summary = await compactConversation(
            props.settings.openRouterApiKey,
            currentModel(),
            props.store.conversationSummary(),
            messagesToCompact,
          );
          await props.store.updateSummary(summary);
          const newPayload = preparePayload(
            chatContext,
            [...allMessages, assistantMessage],
            summary,
            currentModel(),
            compInfo ?? undefined,
            skillPrompt || undefined,
          );
          setContextSnapshot(newPayload.snapshot);
        }
      }

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
      if (isStreaming()) {
        setIsStreaming(false);
        setStreamingContent("");
      }
    }
  }

  async function handleVoiceTranscribe(audio: Blob): Promise<string> {
    if (!props.settings.groqApiKey)
      throw new Error("Groq API key not configured");
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
              <Show when={contextSnapshot()}>
                {(snap) => (
                  <Context
                    usedTokens={snap().totalInputTokens}
                    maxTokens={snap().maxInputTokens}
                    inputTokens={snap().messageTokens + snap().summaryTokens}
                  >
                    <ContextTrigger class="h-6 px-1 text-xs" />
                    <ContextContent>
                      <ContextContentHeader />
                      <ContextContentBody>
                        <div class="space-y-1 text-xs">
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Document</span>
                            <span>
                              {snap().documentTokens.toLocaleString()}
                            </span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-muted-foreground">Messages</span>
                            <span>
                              {snap().messagesIncluded} of{" "}
                              {snap().messagesTotal}
                            </span>
                          </div>
                          <Show when={snap().hasBeenCompacted}>
                            <div class="flex justify-between">
                              <span class="text-muted-foreground">Summary</span>
                              <span>
                                {snap().summaryTokens.toLocaleString()}
                              </span>
                            </div>
                          </Show>
                          <Show when={snap().isCompressed}>
                            <div class="flex justify-between text-emerald-400">
                              <span>Compressed</span>
                              <span>
                                {Math.round(
                                  (snap().compressionSavings ?? 0) * 100,
                                )}
                                % saved
                              </span>
                            </div>
                          </Show>
                        </div>
                      </ContextContentBody>
                    </ContextContent>
                  </Context>
                )}
              </Show>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
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
                title="Sessions"
              >
                <History size={16} />
              </button>
              <button
                onClick={() => setDebugOpen(!debugOpen())}
                class={`p-1.5 rounded-md transition-colors ${
                  debugOpen()
                    ? "text-sky-400 bg-sky-400/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title="Debug inspector"
              >
                <Code size={16} />
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

          {/* Active skills */}
          <Show when={props.store.activeSkillIds().length > 0}>
            <div class="px-3 py-1 flex gap-1 flex-wrap flex-shrink-0">
              <For each={props.store.activeSkillIds()}>
                {(skillId) => {
                  const skill = () =>
                    (allSkills() ?? []).find(
                      (s: ChatSkill) => s.id === skillId,
                    );
                  return (
                    <Show when={skill()}>
                      <button
                        onClick={() => props.store.toggleSkill(skillId)}
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 transition-colors"
                      >
                        {skill()!.name}
                        <X size={10} />
                      </button>
                    </Show>
                  );
                }}
              </For>
            </div>
          </Show>

          {/* Debug inspector */}
          <Show when={debugOpen()}>
            <div class="flex-shrink-0 max-h-[40%] overflow-hidden border-b border-border/30">
              <ChatDebugPanel
                snapshot={contextSnapshot()}
                systemPrompt={lastSystemPrompt()}
                documentContent={props.documentContext.content}
                summary={props.store.conversationSummary()}
                messagesPayload={lastMessagesPayload()}
                modelId={currentModel()}
                activeSkillNames={props.store
                  .activeSkillIds()
                  .map(
                    (id) =>
                      (allSkills() ?? []).find((s: ChatSkill) => s.id === id)
                        ?.name ?? id,
                  )}
              />
            </div>
          </Show>

          {/* Compression status */}
          <Show when={compressionStatus()}>
            <div class="px-4 py-1.5 text-xs text-muted-foreground bg-muted/20 flex-shrink-0 flex items-center gap-2">
              <Loader variant="loading-dots" size="sm" />
              {compressionStatus()}
            </div>
          </Show>

          {/* Messages */}
          <ChatContainer class="relative flex-1 min-w-0 px-5 py-4 space-y-4">
            <Show
              when={
                props.store.activeConversation()?.messages.length ||
                isStreaming()
              }
              fallback={
                <div class="flex-1 flex flex-col">
                  {/* Recent sessions */}
                  <Show when={recentConversations().length > 0}>
                    <div class="px-1">
                      <div class="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">
                        Sessions
                      </div>
                      <For each={recentConversations()}>
                        {(conv) => (
                          <button
                            onClick={() => handleSelectConversation(conv.id)}
                            class="w-full text-left px-2 py-2 rounded-md hover:bg-muted/30 transition-colors"
                          >
                            <div class="text-xs text-foreground/80 truncate">
                              {conv.title}
                            </div>
                            <div class="text-[12px] text-muted-foreground/50">
                              {conv.messageCount} messages
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Empty state when no sessions */}
                  <Show when={recentConversations().length === 0}>
                    <div class="flex-1 flex flex-col items-center justify-center py-12">
                      <MessageCircle
                        size={28}
                        class="mb-3 text-muted-foreground/20"
                      />
                      <p class="text-sm text-muted-foreground">
                        Ask anything about this page
                      </p>
                    </div>
                  </Show>
                </div>
              }
            >
              <For each={props.store.activeConversation()?.messages}>
                {(msg) => (
                  <Show
                    when={msg.role === "user"}
                    fallback={
                      /* Assistant message */
                      <Message class="flex-col !gap-0">
                        <MessageSkills
                          skills={((msg as any).skillIds ?? []).map(
                            (id: string) => {
                              const skill = (allSkills() ?? []).find(
                                (s: ChatSkill) => s.id === id,
                              );
                              return {
                                id,
                                name: skill?.name ?? id.replace("builtin-", ""),
                              };
                            },
                          )}
                          class="mb-1"
                        />
                        <MessageContent
                          markdown
                          class="bg-transparent p-0 pt-1.5"
                        >
                          {msg.content}
                        </MessageContent>
                        <MessageActions class="[&>button]:p-1 [&>button]:rounded [&>button]:text-foreground/60 [&>button]:hover:text-foreground [&>button]:transition-colors">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(msg.content)
                            }
                          >
                            <Copy size={14} />
                          </button>
                          <button onClick={() => {}}>
                            <ThumbsUp size={14} />
                          </button>
                          <button onClick={() => {}}>
                            <ThumbsDown size={14} />
                          </button>
                        </MessageActions>
                      </Message>
                    }
                  >
                    {/* User message */}
                    <Message class="group flex-col items-end !gap-0">
                      <MessageContent class="bg-muted text-primary max-w-[85%] rounded-xl px-4 py-2 mr-1">
                        {msg.content}
                      </MessageContent>
                      <MessageActions class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 [&>button]:p-1 [&>button]:rounded [&>button]:text-foreground/60 [&>button]:hover:text-foreground [&>button]:transition-colors">
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(msg.content)
                          }
                        >
                          <Copy size={14} />
                        </button>
                      </MessageActions>
                    </Message>
                  </Show>
                )}
              </For>
            </Show>

            <Show
              when={
                contextSnapshot() &&
                contextSnapshot()!.messagesIncluded <
                  contextSnapshot()!.messagesTotal
              }
            >
              <div class="text-center text-xs text-muted-foreground/50 py-1">
                Using last {contextSnapshot()!.messagesIncluded} of{" "}
                {contextSnapshot()!.messagesTotal} messages
              </div>
            </Show>

            {/* Streaming response */}
            <Show when={isStreaming()}>
              <Message class="flex-col !gap-0">
                <Show
                  when={streamingContent()}
                  fallback={<Loader variant="loading-dots" size="sm" />}
                >
                  <MessageContent markdown class="bg-transparent p-0 pt-1.5">
                    {streamingContent()}
                  </MessageContent>
                </Show>
              </Message>
            </Show>
            <div class="sticky bottom-2 flex justify-center">
              <ScrollButton class="shadow-md" />
            </div>
          </ChatContainer>

          {/* Prompt suggestions (when no messages) */}
          <Show
            when={
              !props.store.activeConversation()?.messages.length &&
              !props.store.activeConversationId()
            }
          >
            <div class="flex gap-1.5 px-3 pb-2 flex-wrap justify-center flex-shrink-0">
              <For each={suggestions}>
                {(suggestion) => (
                  <PromptSuggestion
                    size="sm"
                    class="text-xs"
                    onClick={() => handleSendMessage(suggestion)}
                  >
                    {suggestion}
                  </PromptSuggestion>
                )}
              </For>
            </div>
          </Show>

          {/* Input */}
          <div class="px-3 pb-3 pt-1 flex-shrink-0 relative">
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
              <PromptInputTextarea
                placeholder="Ask about this page..."
                class="min-h-[36px] pt-2 pl-3"
              />
              <PromptInputActions class="mt-0.5 flex w-full items-center justify-between gap-2 px-2 pb-1.5">
                <div class="flex items-center gap-1">
                  <ChatSkillPicker
                    activeSkillIds={props.store.activeSkillIds()}
                    onToggleSkill={(id) => props.store.toggleSkill(id)}
                  />
                  <button
                    onClick={() => setCompressionEnabled(!compressionEnabled())}
                    class={`p-1.5 rounded-md text-xs flex items-center gap-1 transition-colors ${
                      compressionEnabled()
                        ? "text-emerald-400 bg-emerald-400/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    title={
                      compressionEnabled()
                        ? "Compression on — click to use original content"
                        : "Compression off — click to compress content"
                    }
                  >
                    <Zap size={14} />
                  </button>
                  <ModelSwitcher
                    models={CHAT_MODELS}
                    currentModelId={currentModel()}
                    onModelChange={setCurrentModel}
                  />
                </div>
                <div class="flex items-center gap-2">
                  <Show when={!!props.settings.groqApiKey}>
                    <VoiceInput
                      onTranscribe={handleVoiceTranscribe}
                      onTranscription={(text) =>
                        setPromptText((prev) =>
                          prev ? prev + " " + text : text,
                        )
                      }
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
                </div>
              </PromptInputActions>
              <SlashCommand
                commands={slashCommands()}
                activeIds={props.store.activeSkillIds()}
                onSelect={(cmd) => props.store.toggleSkill(cmd.id)}
              />
            </PromptInput>
          </div>
          <Show
            when={!promptText() && props.store.activeSkillIds().length === 0}
          >
            <p class="text-[12px] text-muted-foreground/60 text-center pb-2 px-2 -mt-1">
              Type <code class="bg-muted px-1 rounded">/</code> to see commands.
            </p>
          </Show>
        </Show>
      </div>
    </ChatConfig>
  );
}
