import { createSignal, Show } from "solid-js";
import { MessageCircle, X } from "lucide-solid";

export default function ChatFab() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(!open())}
        class={`fixed bottom-4 right-4 z-30 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          open() ? "bg-sky-500 text-background" : "bg-muted text-foreground hover:bg-muted/80"
        }`}
        title={open() ? "Close chat" : "Open chat"}
      >
        <MessageCircle size={20} />
      </button>

      {/* Chat overlay */}
      <Show when={open()}>
        <div class="fixed bottom-[68px] right-4 z-30 w-[340px] max-w-[calc(100vw-32px)] max-h-[420px] bg-card rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] flex flex-col overflow-hidden">
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
            <span class="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageCircle size={14} />
              Chat
            </span>
            <button
              onClick={() => setOpen(false)}
              class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Placeholder body */}
          <div class="flex-1 flex items-center justify-center px-6 py-12">
            <div class="text-center">
              <MessageCircle size={28} class="mx-auto mb-3 text-muted-foreground/20" />
              <p class="text-sm text-muted-foreground">
                Ask questions about this page
              </p>
              <p class="text-sm text-muted-foreground/40 mt-1">
                Coming in a future update
              </p>
            </div>
          </div>

          {/* Input */}
          <div class="px-3 pb-3">
            <input
              type="text"
              placeholder="Ask about this page..."
              class="w-full bg-muted/40 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/30"
              disabled
            />
          </div>
        </div>
      </Show>
    </>
  );
}
