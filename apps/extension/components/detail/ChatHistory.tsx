// apps/extension/components/detail/ChatHistory.tsx
import { createSignal, For, Show } from "solid-js";
import { ArrowLeft, Search, Trash2 } from "lucide-solid";
import type { ConversationSummary } from "@tab-zen/shared";
import type { DocumentChatStore } from "@/lib/chat/chat-store";

interface ChatHistoryProps {
  store: DocumentChatStore;
  onBack: () => void;
  onSelect: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChatHistory(props: ChatHistoryProps) {
  const [search, setSearch] = createSignal("");
  const [confirmDeleteAll, setConfirmDeleteAll] = createSignal(false);

  const filtered = () => {
    const q = search().toLowerCase();
    const list = props.store.conversations() ?? [];
    if (!q) return list;
    return list.filter((c: ConversationSummary) =>
      c.title.toLowerCase().includes(q),
    );
  };

  async function handleDelete(e: Event, id: string) {
    e.stopPropagation();
    await props.store.deleteConversation(id);
  }

  async function handleDeleteAll() {
    await props.store.deleteAllConversations();
    setConfirmDeleteAll(false);
    props.onBack();
  }

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center gap-2 px-3 py-2.5 bg-muted/30 flex-shrink-0">
        <button
          onClick={props.onBack}
          class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <span class="text-sm font-semibold text-foreground">Sessions</span>
      </div>

      {/* Search */}
      <div class="px-3 py-2 flex-shrink-0">
        <div class="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5">
          <Search size={13} class="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search sessions..."
            class="bg-transparent text-sm text-foreground outline-none w-full placeholder:text-muted-foreground/40"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </div>

      {/* Session list */}
      <div class="flex-1 overflow-y-auto px-2">
        <Show
          when={filtered().length > 0}
          fallback={
            <div class="text-center text-xs text-muted-foreground/40 py-12">
              No sessions
            </div>
          }
        >
          <For each={filtered()}>
            {(conv) => (
              <div
                class="group flex items-center justify-between px-2 py-2 rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => props.onSelect(conv.id)}
              >
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-foreground/80 truncate">
                    {conv.title}
                  </div>
                  <div class="text-xs text-muted-foreground/50">
                    {conv.messageCount} messages · {timeAgo(conv.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  class="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Delete all */}
      <Show when={(props.store.conversations() ?? []).length > 0}>
        <div class="px-3 py-3 flex-shrink-0">
          <Show
            when={confirmDeleteAll()}
            fallback={
              <button
                onClick={() => setConfirmDeleteAll(true)}
                class="w-full py-1.5 rounded-lg text-xs text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors"
              >
                Delete All Sessions
              </button>
            }
          >
            <div class="flex gap-2">
              <button
                onClick={() => setConfirmDeleteAll(false)}
                class="flex-1 py-1.5 rounded-lg text-xs text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                class="flex-1 py-1.5 rounded-lg text-xs text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
