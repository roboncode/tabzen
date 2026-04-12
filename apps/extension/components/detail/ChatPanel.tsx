// apps/extension/components/detail/ChatPanel.tsx
import { createSignal, Show, onMount } from "solid-js";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@tab-zen/chat";
import type { DocumentChatContext } from "@/lib/chat/chat-streaming";
import type { DocumentChatStore } from "@/lib/chat/chat-store";
import type { Settings } from "@/lib/types";
import ChatPanelContent from "./ChatPanelContent";

const CHAT_PANEL_PCT_KEY = "tab-zen-chat-panel-pct";
const DEFAULT_PANEL_PCT = 35;
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
  const [panelPct, setPanelPct] = createSignal(DEFAULT_PANEL_PCT);

  onMount(() => {
    const stored = localStorage.getItem(CHAT_PANEL_PCT_KEY);
    if (stored) {
      const pct = parseFloat(stored);
      if (pct >= 15 && pct <= 60) setPanelPct(pct);
    }
  });

  function handleResize() {
    const panel = document.querySelector("[data-chat-panel]") as HTMLElement | null;
    const container = panel?.parentElement;
    if (panel && container) {
      const containerWidth = container.getBoundingClientRect().width;
      if (containerWidth > 0) {
        const pct = (panel.getBoundingClientRect().width / containerWidth) * 100;
        setPanelPct(Math.round(pct));
        localStorage.setItem(CHAT_PANEL_PCT_KEY, String(Math.round(pct)));
      }
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
          <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
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
        <ResizablePanelGroup orientation="horizontal" class="flex-1 min-w-0 overflow-hidden">
          <ResizablePanel class="min-w-0 !overflow-y-auto overflow-x-hidden">
            {props.children}
          </ResizablePanel>
          <ResizableHandle withHandle onPanelResize={handleResize} />
          <ResizablePanel
            class="overflow-hidden"
            defaultSize={panelPct()}
            data-chat-panel=""
            data-min-size={String(MIN_PANEL_WIDTH)}
            data-max-size={String(MAX_PANEL_WIDTH)}
          >
            <div class="h-full flex flex-col overflow-hidden">
              <ChatPanelContent
                store={props.store}
                documentContext={props.documentContext}
                settings={props.settings}
                onClose={props.onClose}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </Show>
    </Show>
  );
}
