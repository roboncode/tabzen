// apps/extension/components/detail/ChatPanel.tsx
import { createSignal, Show, onMount } from "solid-js";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@tab-zen/chat";
import type { DocumentChatContext } from "@/lib/chat/chat-streaming";
import type { DocumentChatStore } from "@/lib/chat/chat-store";
import type { Settings } from "@/lib/types";
import ChatPanelContent from "./ChatPanelContent";

const CHAT_PANEL_WIDTH_KEY = "tab-zen-chat-panel-width";
const DEFAULT_PANEL_WIDTH = 380;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 600;

interface ChatPanelProps {
  open: boolean;
  store: DocumentChatStore;
  documentContext: DocumentChatContext;
  settings: Settings;
  narrow: boolean;
  onClose: () => void;
  children: any; // Main content
}

export default function ChatPanel(props: ChatPanelProps) {
  const [panelWidth, setPanelWidth] = createSignal(DEFAULT_PANEL_WIDTH);

  onMount(() => {
    const stored = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    if (stored) {
      const w = parseInt(stored, 10);
      if (w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) setPanelWidth(w);
    }
  });

  function handleResize() {
    const panel = document.querySelector("[data-chat-panel]") as HTMLElement | null;
    if (panel) {
      const width = panel.getBoundingClientRect().width;
      setPanelWidth(Math.round(width));
      localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(Math.round(width)));
    }
  }

  return (
    <Show when={!props.narrow} fallback={
      // Narrow: main content or overlay
      <>
        <Show when={!props.open}>
          {props.children}
        </Show>
        <Show when={props.open}>
          <div class="flex-1 min-w-0 flex flex-col">
            <ChatPanelContent
              store={props.store}
              documentContext={props.documentContext}
              settings={props.settings}
              onClose={props.onClose}
            />
          </div>
        </Show>
      </>
    }>
      {/* Wide: resizable split */}
      <Show when={props.open} fallback={props.children}>
        <ResizablePanelGroup orientation="horizontal" class="flex-1 min-w-0">
          <ResizablePanel class="min-w-0">
            {props.children}
          </ResizablePanel>
          <ResizableHandle withHandle onPanelResize={handleResize} />
          <ResizablePanel
            defaultSize={Math.round((panelWidth() / (window.innerWidth - 300)) * 100)}
            data-chat-panel=""
            data-min-size={String(MIN_PANEL_WIDTH)}
            data-max-size={String(MAX_PANEL_WIDTH)}
          >
            <ChatPanelContent
              store={props.store}
              documentContext={props.documentContext}
              settings={props.settings}
              onClose={props.onClose}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Show>
    </Show>
  );
}
