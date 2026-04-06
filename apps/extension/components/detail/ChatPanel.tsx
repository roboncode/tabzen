import { Show } from "solid-js";
import { MessageCircle, X } from "lucide-solid";

interface ChatPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatPanel(props: ChatPanelProps) {
  return (
    <Show when={!props.collapsed}>
      <div class="w-[340px] flex-shrink-0 flex flex-col bg-muted/20">
        {/* Header */}
        <div class="flex items-center justify-between px-4 h-[53px] bg-muted/30 flex-shrink-0">
          <div class="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageCircle size={14} />
            Chat
          </div>
          <button
            onClick={props.onToggle}
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Hide chat"
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
