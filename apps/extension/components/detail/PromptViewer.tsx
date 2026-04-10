import { createSignal, Show } from "solid-js";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-solid";
import type { AITemplate } from "@/lib/types";

interface PromptViewerProps {
  template: AITemplate;
  onUpdatePrompt?: (prompt: string) => void;
}

export default function PromptViewer(props: PromptViewerProps) {
  const [showPrompt, setShowPrompt] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const isCustom = () => !props.template.isBuiltin;
  const isModified = () =>
    !isCustom() && props.template.defaultPrompt && props.template.prompt !== props.template.defaultPrompt;

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleEdit = () => {
    setDraft(props.template.prompt);
    setEditing(true);
  };

  const handleSave = () => {
    props.onUpdatePrompt?.(draft());
    setEditing(false);
  };

  return (
    <div class={showPrompt() ? "mb-10" : "mb-6"}>
      {/* Header row */}
      <div class="flex items-center gap-2">
        <button
          onClick={() => {
            setShowPrompt(!showPrompt());
            if (!showPrompt()) setEditing(false);
          }}
          class="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {showPrompt() ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Prompt
          <Show when={isModified()}>
            <span class="text-[11px] text-sky-400/60 ml-1">modified</span>
          </Show>
        </button>

        <div class={`flex items-center gap-1.5 ml-auto ${showPrompt() ? "visible" : "invisible"}`}>
            <Show
              when={editing()}
              fallback={
                <Show when={props.onUpdatePrompt}>
                  <button
                    onClick={handleEdit}
                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                </Show>
              }
            >
              <button
                onClick={handleSave}
                class="px-2.5 py-1 text-xs font-medium rounded-md bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
              >
                Save
              </button>
              <Show when={!isCustom() && props.template.defaultPrompt}>
                <button
                  onClick={() => setDraft(props.template.defaultPrompt!)}
                  class="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
                >
                  Reset
                </button>
              </Show>
              <div class="w-px h-4 bg-muted-foreground/10" />
              <button
                onClick={() => setEditing(false)}
                class="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
              >
                <X size={14} />
              </button>
            </Show>
          </div>
      </div>

      {/* Prompt content */}
      <Show when={showPrompt()}>
        <div class="mt-3">
          <Show
            when={editing()}
            fallback={
              <p class="text-sm text-muted-foreground/60 leading-relaxed bg-muted/10 rounded-lg p-4 whitespace-pre-wrap">
                {props.template.prompt}
              </p>
            }
          >
            <textarea
              ref={(el) => requestAnimationFrame(() => autoResize(el))}
              value={draft()}
              onInput={(e) => {
                setDraft(e.currentTarget.value);
                autoResize(e.currentTarget);
              }}
              class="w-full text-sm text-foreground/80 leading-relaxed bg-muted/10 rounded-lg p-4 focus:outline-none focus:bg-muted/20 transition-colors overflow-hidden"
              style={{ resize: "none" }}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
