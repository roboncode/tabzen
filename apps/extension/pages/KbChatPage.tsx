import {
  createSignal,
  createResource,
  createEffect,
  onMount,
  For,
  Show,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Plus,
  Trash2,
  MessagesSquare,
  ArrowUp,
  ArrowLeft,
  Database,
  ExternalLink,
  ChevronRight,
} from "lucide-solid";
import {
  ChatConfig,
  ChatContainer,
  Message,
  MessageContent,
  MessageActions,
  MessageCopyButton,
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  ScrollButton,
  Loader,
  ModelSwitcher,
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@tab-zen/chat";
import type {
  ChatMessage,
  Conversation,
  ConversationSummary,
  ConversationScope,
  Citation,
  SearchFilters,
} from "@tab-zen/shared";
import { createLocalChatAdapter } from "@/lib/chat/local-chat-adapter";
import {
  retrieveChunks,
  scopeToFilters,
  buildCollectionMessages,
  parseCitations,
  type ChatTurn,
} from "@/lib/chat/collection-chat";
import { streamChatCompletion } from "@/lib/chat/chat-streaming";
import { CHAT_MODELS } from "@/lib/chat/chat-models";
import { getSettings } from "@/lib/settings";
import { getAllPages, getAllGroups } from "@/lib/db";
import { sendMessage } from "@/lib/messages";

/** A collection (group) reduced to the distinct creators it contains. The
 *  retrieval layer can only filter by `author` (== page.creator), so a
 *  collection scope is expressed as the set of authors in that group. */
interface GroupScopeOption {
  id: string;
  name: string;
  authors: string[];
}

export default function KbChatPage() {
  const navigate = useNavigate();
  const [settings] = createResource(getSettings);

  const [conversations, setConversations] = createSignal<ConversationSummary[]>(
    [],
  );
  const [activeConv, setActiveConv] = createSignal<Conversation | null>(null);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [streamingContent, setStreamingContent] = createSignal("");
  const [promptText, setPromptText] = createSignal("");
  const [currentModel, setCurrentModel] = createSignal(CHAT_MODELS[0].id);

  const [pendingEmbeds, setPendingEmbeds] = createSignal(0);
  const [indexing, setIndexing] = createSignal(false);
  const [indexResult, setIndexResult] = createSignal<string | null>(null);

  const [scopeKey, setScopeKey] = createSignal("all");
  const [creators, setCreators] = createSignal<string[]>([]);
  const [groupOpts, setGroupOpts] = createSignal<GroupScopeOption[]>([]);

  // Remembers the exact scope selection per conversation across switches.
  const scopeKeyByConv = new Map<string, string>();

  // Sync the model selection to the user's saved default once settings load.
  createEffect(() => {
    const s = settings();
    if (s?.chatModel) setCurrentModel(s.chatModel);
  });

  onMount(() => {
    void loadConversations();
    void loadScopeOptions();
    void refreshPending();
  });

  async function loadConversations() {
    const adapter = await createLocalChatAdapter();
    const list = await adapter.listConversations();
    setConversations(list.filter((c) => c.scope.type === "collection"));
  }

  async function loadScopeOptions() {
    const [pages, groups] = await Promise.all([getAllPages(), getAllGroups()]);
    const live = pages.filter((p) => !p.deletedAt);

    const creatorSet = new Set<string>();
    for (const p of live) {
      if (p.creator && p.creator.trim()) creatorSet.add(p.creator.trim());
    }
    setCreators([...creatorSet].sort((a, b) => a.localeCompare(b)));

    const opts: GroupScopeOption[] = groups
      .map((g) => {
        const authors = [
          ...new Set(
            live
              .filter((p) => p.groupId === g.id)
              .map((p) => p.creator)
              .filter((c): c is string => !!c && !!c.trim()),
          ),
        ];
        return { id: g.id, name: g.name, authors };
      })
      // Only collections that contain at least one identifiable author can be
      // filtered by retrieval — drop the rest so the picker stays meaningful.
      .filter((g) => g.authors.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    setGroupOpts(opts);
  }

  async function refreshPending() {
    const res = await sendMessage({ type: "COUNT_PENDING_EMBEDS" });
    if (res.type === "PENDING_EMBEDS_COUNT") setPendingEmbeds(res.count);
  }

  // --- Scope helpers ---------------------------------------------------------

  function keyToFilters(key: string): SearchFilters | undefined {
    if (!key || key === "all") return undefined;
    if (key.startsWith("creator:")) {
      return { authors: [key.slice("creator:".length)] };
    }
    if (key.startsWith("group:")) {
      const g = groupOpts().find((x) => x.id === key.slice("group:".length));
      if (!g || g.authors.length === 0) return undefined;
      return { authors: g.authors };
    }
    return undefined;
  }

  function keyToLabel(key: string): string {
    if (!key || key === "all") return "All content";
    if (key.startsWith("creator:")) return key.slice("creator:".length);
    if (key.startsWith("group:")) {
      return (
        groupOpts().find((x) => x.id === key.slice("group:".length))?.name ??
        "Collection"
      );
    }
    return "All content";
  }

  /** Best-effort reverse of a stored scope to a picker key (used when reopening
   *  a saved conversation, where the in-memory key map has been lost). */
  function deriveKey(scope: ConversationScope): string {
    const authors = scope.filters?.authors;
    if (!authors?.length) return "all";
    const group = groupOpts().find(
      (g) =>
        g.authors.length === authors.length &&
        g.authors.every((a) => authors.includes(a)),
    );
    if (group) return `group:${group.id}`;
    if (authors.length === 1) return `creator:${authors[0]}`;
    return "all";
  }

  function handleScopeChange(key: string) {
    setScopeKey(key);
    const conv = activeConv();
    if (!conv) return;
    scopeKeyByConv.set(conv.id, key);
    const updated: Conversation = {
      ...conv,
      scope: { type: "collection", filters: keyToFilters(key) },
      updatedAt: new Date().toISOString(),
    };
    setActiveConv(updated);
    // Only persist once the conversation actually has content.
    if (updated.messages.length > 0) void persist(updated);
  }

  // --- Conversation lifecycle ------------------------------------------------

  async function persist(conv: Conversation) {
    const adapter = await createLocalChatAdapter();
    await adapter.saveConversation(conv);
    await loadConversations();
  }

  function handleNewChat() {
    setActiveConv(null);
    setScopeKey("all");
    setPromptText("");
    setIndexResult(null);
  }

  async function handleSelectConversation(id: string) {
    const adapter = await createLocalChatAdapter();
    const conv = await adapter.getConversation(id);
    setActiveConv(conv);
    setScopeKey(scopeKeyByConv.get(id) ?? deriveKey(conv.scope));
  }

  async function handleDeleteConversation(id: string, e: MouseEvent) {
    e.stopPropagation();
    const adapter = await createLocalChatAdapter();
    await adapter.deleteConversation(id);
    scopeKeyByConv.delete(id);
    if (activeConv()?.id === id) setActiveConv(null);
    await loadConversations();
  }

  // --- Send flow -------------------------------------------------------------

  async function handleSend(text: string) {
    const s = settings();
    if (!s?.syncUrl) return;

    let conv = activeConv();
    if (!conv) {
      const now = new Date().toISOString();
      conv = {
        id: crypto.randomUUID(),
        title: "New chat",
        scope: { type: "collection", filters: keyToFilters(scopeKey()) },
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      scopeKeyByConv.set(conv.id, scopeKey());
    }

    // History for the LLM payload is everything before this new question.
    const priorTurns: ChatTurn[] = conv.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    // Auto-title from the first user message (no LLM call, per spec).
    const title =
      conv.messages.length === 0 ? text.slice(0, 60).trim() : conv.title;
    let working: Conversation = {
      ...conv,
      title,
      messages: [...conv.messages, userMessage],
      updatedAt: new Date().toISOString(),
    };
    setActiveConv(working);
    await persist(working);

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const filters = scopeToFilters(working.scope);
      const results = await retrieveChunks(text, filters);
      const llmMessages = buildCollectionMessages(text, results, priorTurns);

      let full = "";
      for await (const chunk of streamChatCompletion(
        llmMessages,
        currentModel(),
      )) {
        full += chunk;
        setStreamingContent(full);
      }

      const citations = parseCitations(full, results);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: full,
        modelId: currentModel(),
        createdAt: new Date().toISOString(),
        ...(citations.length > 0 ? { citations } : {}),
      };
      working = {
        ...working,
        messages: [...working.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      };
      setActiveConv(working);
      await persist(working);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
        createdAt: new Date().toISOString(),
      };
      working = {
        ...working,
        messages: [...working.messages, errorMessage],
        updatedAt: new Date().toISOString(),
      };
      setActiveConv(working);
      await persist(working);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }

  function submitPrompt() {
    const text = promptText().trim();
    if (!text || isStreaming()) return;
    setPromptText("");
    void handleSend(text);
  }

  async function handleIndex() {
    setIndexing(true);
    setIndexResult(null);
    const res = await sendMessage({ type: "INDEX_COLLECTION" });
    setIndexing(false);
    if (res.type === "INDEX_DONE") {
      setIndexResult(
        `Indexed ${res.embedded} of ${res.total} item(s)` +
          (res.failed > 0 ? ` — ${res.failed} failed` : ""),
      );
    } else if (res.type === "ERROR") {
      setIndexResult(`Error: ${res.message}`);
    }
    await refreshPending();
  }

  function openCitation(c: Citation) {
    navigate(`/page/${c.documentId}`);
  }

  // Turn inline [n] markers in an answer into in-app links to their source page
  // (the hash router navigates on click). Non-citation [n] are left untouched.
  function linkifyCitations(content: string, citations?: Citation[]): string {
    if (!citations?.length) return content;
    const byNumber = new Map<number, Citation>();
    for (const c of citations) if (c.number != null) byNumber.set(c.number, c);
    return content.replace(/\[(\d+)\]/g, (match, num) => {
      const c = byNumber.get(Number(num));
      return c ? `[\\[${num}\\]](#/page/${c.documentId})` : match;
    });
  }

  const messages = () => activeConv()?.messages ?? [];

  return (
    <ChatConfig proseSize="sm">
      <div class="flex h-screen bg-background text-foreground @container">
        {/* Conversations sidebar */}
        <div class="w-64 flex-shrink-0 h-full bg-[#161618] flex flex-col">
          <div class="h-16 flex items-center px-4">
            <button
              onClick={() => navigate("/")}
              class="flex items-center gap-2 text-sm font-bold text-foreground hover:text-foreground/80 transition-colors"
            >
              <ArrowLeft size={15} />
              Tab Zen
            </button>
          </div>
          <div class="px-3">
            <button
              onClick={handleNewChat}
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 text-sm text-foreground transition-colors"
            >
              <Plus size={15} />
              New chat
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-2 mt-3 space-y-0.5 scrollbar-hide">
            <For each={conversations()}>
              {(c) => (
                <div
                  class={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                    activeConv()?.id === c.id
                      ? "bg-muted/50"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <button
                    onClick={() => handleSelectConversation(c.id)}
                    class="flex-1 min-w-0 text-left px-2.5 py-2"
                  >
                    <div
                      class={`text-sm truncate ${
                        activeConv()?.id === c.id
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {c.title}
                    </div>
                    <div class="text-xs text-muted-foreground/50 truncate mt-0.5">
                      {c.messageCount} messages
                    </div>
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    class="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground/60 hover:text-red-400 hover:bg-muted/50 transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </For>
            <Show when={conversations().length === 0}>
              <p class="text-sm text-muted-foreground/50 px-3 py-2">
                No chats yet
              </p>
            </Show>
          </div>
        </div>

        {/* Main chat column */}
        <div class="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <div class="flex items-center gap-2 px-4 py-4 bg-background border-b-3 border-[#161618] flex-shrink-0">
            <MessagesSquare size={16} class="text-muted-foreground flex-shrink-0" />
            <span class="text-sm font-medium text-foreground truncate flex-1 min-w-0">
              {activeConv()?.title ?? "Ask your collection"}
            </span>
            <select
              class="bg-muted/40 text-sm text-foreground rounded-lg px-3 py-1.5 outline-none focus:bg-muted/60 transition-colors flex-shrink-0 max-w-[200px]"
              value={scopeKey()}
              onChange={(e) => handleScopeChange(e.currentTarget.value)}
              title="Scope of the knowledge base"
            >
              <option value="all">All content</option>
              <Show when={creators().length > 0}>
                <optgroup label="By creator">
                  <For each={creators()}>
                    {(creator) => (
                      <option value={`creator:${creator}`}>{creator}</option>
                    )}
                  </For>
                </optgroup>
              </Show>
              <Show when={groupOpts().length > 0}>
                <optgroup label="By collection">
                  <For each={groupOpts()}>
                    {(g) => <option value={`group:${g.id}`}>{g.name}</option>}
                  </For>
                </optgroup>
              </Show>
            </select>
            <ModelSwitcher
              models={CHAT_MODELS}
              currentModelId={currentModel()}
              onModelChange={setCurrentModel}
            />
          </div>

          {/* Index banner */}
          <Show when={pendingEmbeds() > 0}>
            <div class="mx-4 mt-3 flex items-center justify-between gap-4 bg-muted/30 rounded-xl px-4 py-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <Database size={15} class="text-muted-foreground/60 flex-shrink-0" />
                <span class="text-sm text-muted-foreground">
                  {pendingEmbeds()} item(s) not yet indexed for chat
                </span>
              </div>
              <button
                onClick={handleIndex}
                disabled={indexing()}
                class="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex-shrink-0"
              >
                <Show
                  when={indexing()}
                  fallback={<>Index collection ({pendingEmbeds()})</>}
                >
                  <Loader variant="loading-dots" size="sm" />
                  Indexing…
                </Show>
              </button>
            </div>
          </Show>
          <Show when={indexResult()}>
            <div class="mx-4 mt-2 text-xs text-muted-foreground px-1">
              {indexResult()}
            </div>
          </Show>

          {/* Worker not configured state */}
          <Show
            when={settings() && !settings()!.syncUrl}
            fallback={
              <>
                {/* Messages */}
                <ChatContainer class="relative flex-1 min-w-0 px-5 py-4">
                  <Show
                    when={messages().length > 0 || isStreaming()}
                    fallback={
                      <div class="flex-1 flex flex-col items-center justify-center py-16">
                        <MessagesSquare
                          size={28}
                          class="mb-3 text-muted-foreground/20"
                        />
                        <p class="text-sm text-muted-foreground">
                          Ask anything about your saved content
                        </p>
                      </div>
                    }
                  >
                    <div class="mx-auto w-full max-w-3xl">
                    <For each={messages()}>
                      {(msg) => (
                        <Show
                          when={msg.role === "user"}
                          fallback={
                            <Message class="flex-col gap-0!">
                              <MessageContent
                                markdown
                                class="bg-transparent p-0 pt-1.5"
                              >
                                {linkifyCitations(msg.content, msg.citations)}
                              </MessageContent>
                              <Show when={(msg.citations?.length ?? 0) > 0}>
                                <Collapsible class="mt-3">
                                  <CollapsibleTrigger class="group/src flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground transition-colors outline-none">
                                    <ChevronRight
                                      size={12}
                                      class="transition-transform duration-150 group-data-[expanded]/src:rotate-90"
                                    />
                                    Sources ({msg.citations!.length})
                                  </CollapsibleTrigger>
                                  <CollapsibleContent class="mt-1.5">
                                    <div class="bg-muted/30 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
                                      <For each={msg.citations}>
                                        {(c) => (
                                          <button
                                            onClick={() => openCitation(c)}
                                            title={`Open ${c.title}${c.timestamp ? ` at ${c.timestamp}` : ""}`}
                                            class="group/cite flex items-center gap-2 rounded-lg px-2 py-1 -mx-1 text-left hover:bg-muted/50 transition-colors"
                                          >
                                            <span class="text-xs font-mono text-muted-foreground/60 flex-shrink-0 tabular-nums">
                                              [{c.number}]
                                            </span>
                                            <span class="text-sm text-foreground/90 truncate flex-1 min-w-0">
                                              {c.title}
                                            </span>
                                            <Show when={c.timestamp}>
                                              <span class="text-xs text-muted-foreground/60 tabular-nums flex-shrink-0">
                                                {c.timestamp}
                                              </span>
                                            </Show>
                                            <ExternalLink
                                              size={12}
                                              class="flex-shrink-0 text-muted-foreground/40 group-hover/cite:text-foreground/70 transition-colors"
                                            />
                                          </button>
                                        )}
                                      </For>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </Show>
                              <MessageActions class="mt-1 [&>button]:p-1 [&>button]:rounded [&>button]:text-foreground/60 [&>button]:hover:text-foreground [&>button]:transition-colors">
                                <MessageCopyButton content={msg.content} />
                              </MessageActions>
                            </Message>
                          }
                        >
                          <Message class="group flex-col items-end !gap-0">
                            <MessageContent class="bg-muted text-primary max-w-[85%] rounded-xl px-4 py-2 mr-1">
                              {msg.content}
                            </MessageContent>
                          </Message>
                        </Show>
                      )}
                    </For>

                    {/* Streaming response */}
                    <Show when={isStreaming()}>
                      <Message class="flex-col !gap-0">
                        <Show
                          when={streamingContent()}
                          fallback={<Loader variant="loading-dots" size="sm" />}
                        >
                          <MessageContent
                            markdown
                            class="bg-transparent p-0 pt-1.5"
                          >
                            {streamingContent()}
                          </MessageContent>
                        </Show>
                      </Message>
                    </Show>
                    </div>
                  </Show>
                  <div class="sticky bottom-2 flex justify-center">
                    <ScrollButton class="shadow-md" />
                  </div>
                </ChatContainer>

                {/* Input */}
                <div class="px-4 pb-4 pt-1 flex-shrink-0">
                  <div class="mx-auto w-full max-w-3xl">
                  <PromptInput
                    isLoading={isStreaming()}
                    value={promptText()}
                    onValueChange={setPromptText}
                    onSubmit={submitPrompt}
                  >
                    <PromptInputTextarea
                      placeholder="Ask your collection…"
                      class="min-h-[36px] pt-2 pl-3"
                    />
                    <PromptInputActions class="mt-0.5 flex w-full items-center justify-between gap-2 px-2 pb-1.5">
                      <span class="text-xs text-muted-foreground/60 pl-1">
                        {keyToLabel(scopeKey())}
                      </span>
                      <Button
                        size="icon-sm"
                        class="rounded-full"
                        disabled={!promptText().trim() || isStreaming()}
                        onClick={submitPrompt}
                      >
                        <ArrowUp class="size-4" />
                      </Button>
                    </PromptInputActions>
                  </PromptInput>
                  </div>
                </div>
              </>
            }
          >
            <div class="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <MessagesSquare size={28} class="mb-3 text-muted-foreground/20" />
              <p class="text-sm text-muted-foreground mb-3">
                Configure the sync worker URL in Settings to chat with your
                collection.
              </p>
              <button
                onClick={() => navigate("/settings")}
                class="px-4 py-1.5 text-sm font-medium rounded-full bg-muted/50 text-foreground hover:bg-muted transition-colors"
              >
                Open Settings
              </button>
            </div>
          </Show>
        </div>
      </div>
    </ChatConfig>
  );
}
