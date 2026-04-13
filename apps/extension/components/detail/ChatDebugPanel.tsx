// apps/extension/components/detail/ChatDebugPanel.tsx
import { Show, For, createSignal } from "solid-js";
import { ChevronDown, ChevronRight } from "lucide-solid";
import type { ContextSnapshot } from "@/lib/chat/chat-context-manager";

interface ChatDebugPanelProps {
  snapshot: ContextSnapshot | null;
  systemPrompt: string | null;
  documentContent: string | null;
  summary: string | null;
  messagesPayload: Array<{ role: string; content: string }>;
  modelId: string;
  activeSkillNames: string[];
}

function TokenBadge(props: { tokens: number }) {
  return (
    <span class="text-xs font-mono text-muted-foreground/60 ml-auto">
      ~{props.tokens.toLocaleString()} tokens
    </span>
  );
}

function CollapsibleSection(props: { label: string; tokens: number; children: any; defaultOpen?: boolean }) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  return (
    <div class="border-b border-border/30 last:border-b-0">
      <button
        class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(!open())}
      >
        <Show when={open()} fallback={<ChevronRight size={12} class="text-muted-foreground/60" />}>
          <ChevronDown size={12} class="text-muted-foreground/60" />
        </Show>
        <span class="text-foreground/80 font-medium">{props.label}</span>
        <TokenBadge tokens={props.tokens} />
      </button>
      <Show when={open()}>
        <div class="px-3 pb-3">
          <pre class="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto bg-background/50 rounded p-2">
            {props.children}
          </pre>
        </div>
      </Show>
    </div>
  );
}

export default function ChatDebugPanel(props: ChatDebugPanelProps) {
  const snapshot = () => props.snapshot;

  return (
    <div class="flex flex-col h-full overflow-hidden bg-card">
      {/* Header */}
      <div class="px-3 py-2 bg-muted/30 flex-shrink-0">
        <div class="text-sm font-semibold text-foreground">Debug Inspector</div>
        <div class="text-xs text-muted-foreground mt-0.5">
          Model: {props.modelId}
        </div>
      </div>

      {/* Token overview */}
      <Show when={snapshot()}>
        {(snap) => (
          <div class="px-3 py-2 bg-muted/10 flex-shrink-0 space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Input tokens</span>
              <span class="font-mono">{snap().totalInputTokens.toLocaleString()} / {snap().maxInputTokens.toLocaleString()}</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                class={`h-full rounded-full transition-all ${
                  snap().totalInputTokens / snap().maxInputTokens > 0.9
                    ? "bg-red-400"
                    : snap().totalInputTokens / snap().maxInputTokens > 0.7
                      ? "bg-yellow-400"
                      : "bg-sky-400"
                }`}
                style={{ width: `${Math.min((snap().totalInputTokens / snap().maxInputTokens) * 100, 100)}%` }}
              />
            </div>
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Messages: {snap().messagesIncluded} of {snap().messagesTotal}</span>
              <Show when={snap().hasBeenCompacted}>
                <span class="text-yellow-400">Compacted</span>
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* Compression info */}
      <Show when={snapshot()?.isCompressed}>
        <div class="px-3 py-2 bg-emerald-500/5 flex-shrink-0">
          <div class="flex justify-between text-xs">
            <span class="text-emerald-400">Content compressed</span>
            <span class="font-mono text-emerald-400">
              {snapshot()?.originalDocumentTokens?.toLocaleString()} → {snapshot()?.documentTokens.toLocaleString()} tokens
              ({Math.round((snapshot()?.compressionSavings ?? 0) * 100)}% saved)
            </span>
          </div>
        </div>
      </Show>

      {/* Active skills */}
      <Show when={props.activeSkillNames.length > 0}>
        <div class="px-3 py-2 bg-violet-500/5 flex-shrink-0">
          <div class="flex justify-between text-xs">
            <span class="text-violet-400">Active skills</span>
            <span class="text-violet-400">{props.activeSkillNames.join(", ")}</span>
          </div>
        </div>
      </Show>

      {/* Sections */}
      <div class="flex-1 overflow-y-auto">
        <Show when={props.systemPrompt}>
          <CollapsibleSection
            label="System Prompt"
            tokens={snapshot()?.systemPromptTokens ?? 0}
          >
            {props.systemPrompt}
          </CollapsibleSection>
        </Show>

        <Show when={props.summary}>
          <CollapsibleSection
            label="Conversation Summary"
            tokens={snapshot()?.summaryTokens ?? 0}
            defaultOpen
          >
            {props.summary}
          </CollapsibleSection>
        </Show>

        <Show when={props.messagesPayload.length > 0}>
          <CollapsibleSection
            label={`Messages (${props.messagesPayload.length})`}
            tokens={snapshot()?.messageTokens ?? 0}
            defaultOpen
          >
            <For each={props.messagesPayload}>
              {(msg) => (
                <div class="mb-2 last:mb-0">
                  <span class={`font-semibold ${msg.role === "user" ? "text-sky-400" : msg.role === "assistant" ? "text-emerald-400" : "text-yellow-400"}`}>
                    [{msg.role}]
                  </span>
                  {" "}{msg.content.length > 500 ? msg.content.slice(0, 500) + "..." : msg.content}
                </div>
              )}
            </For>
          </CollapsibleSection>
        </Show>

        <Show when={props.documentContent}>
          <CollapsibleSection
            label="Document Content"
            tokens={snapshot()?.documentTokens ?? 0}
          >
            {(props.documentContent?.length ?? 0) > 1000
              ? props.documentContent!.slice(0, 1000) + `\n\n... (${props.documentContent!.length.toLocaleString()} chars total)`
              : props.documentContent}
          </CollapsibleSection>
        </Show>
      </div>
    </div>
  );
}
