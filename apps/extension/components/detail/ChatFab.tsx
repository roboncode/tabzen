// apps/extension/components/detail/ChatFab.tsx
import { Show } from "solid-js";
import { MessageCircle, X } from "lucide-solid";

interface ChatFabProps {
  open: boolean;
  onToggle: () => void;
}

export default function ChatFab(props: ChatFabProps) {
  return (
    <button
      onClick={props.onToggle}
      class={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
        props.open
          ? "bg-accent text-accent-foreground shadow-accent/30"
          : "bg-accent text-accent-foreground hover:shadow-accent/20 hover:scale-105"
      }`}
      title={props.open ? "Close chat" : "Chat with this page"}
    >
      <Show when={props.open} fallback={<MessageCircle size={24} />}>
        <X size={24} />
      </Show>
    </button>
  );
}
