import { Show } from "solid-js";
import { MessageCircle, PanelRightClose, PanelRight } from "lucide-solid";

interface ChatPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatPanel(props: ChatPanelProps) {
  return (
    <Show
      when={!props.collapsed}
      fallback={
        <button
          onClick={props.onToggle}
          class="absolute top-3 right-3 p-2 rounded-lg text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors z-10"
          title="Show chat"
        >
          <PanelRight size={16} />
        </button>
      }
    >
      <div class="w-[340px] flex-shrink-0 flex flex-col border-l border-border bg-[#18181c]">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <div class="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageCircle size={14} />
              Chat
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              Ask about this content
            </div>
          </div>
          <button
            onClick={props.onToggle}
            class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Hide chat"
          >
            <PanelRightClose size={16} />
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

        {/* Disabled input */}
        <div class="px-4 py-3 border-t border-border flex-shrink-0">
          <div class="flex gap-2 items-center">
            <div class="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed">
              Ask about this content...
            </div>
            <div class="w-8 h-8 rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground/30 cursor-not-allowed">
              ↑
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
