import { Show } from "solid-js";
import { MessageCircle, X } from "lucide-solid";

interface ChatPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  overlay?: boolean;
}

export default function ChatPanel(props: ChatPanelProps) {
  return (
    <Show when={!props.collapsed}>
      {/* Overlay mode: backdrop + absolute positioned panel */}
      <Show when={props.overlay}>
        <div
          class="absolute inset-0 bg-black/50 z-20"
          onClick={props.onToggle}
        />
      </Show>

      <div
        class={
          props.overlay
            ? "absolute top-0 right-0 bottom-0 w-[340px] max-w-[85vw] z-30 flex flex-col bg-background shadow-2xl"
            : "w-[340px] flex-shrink-0 flex flex-col bg-muted/20"
        }
      >
        {/* Header */}
        <div class="flex items-center justify-between px-4 h-[53px] bg-muted/30 flex-shrink-0">
          <div class="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageCircle size={14} />
            Chat
          </div>
          <button
            onClick={props.onToggle}
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Placeholder body */}
        <div class="flex-1 flex items-center justify-center px-6">
          <div class="text-center">
            <MessageCircle size={32} class="mx-auto mb-3 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">
              Chat will be available in a future update
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
}
