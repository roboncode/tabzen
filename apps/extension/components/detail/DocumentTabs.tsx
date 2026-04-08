import { For, Show } from "solid-js";
import type { AITemplate, AIDocument } from "@/lib/types";
import { Zap, Plus } from "lucide-solid";

interface DocumentTabsProps {
  templates: AITemplate[];
  documents: AIDocument[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onGenerateAll: () => void;
  onAddCustom: () => void;
  generatingAll: boolean;
  hasContent: boolean;
}

export default function DocumentTabs(props: DocumentTabsProps) {
  const allGenerated = () =>
    props.templates.every((t) =>
      props.documents.some((d) => d.templateId === t.id),
    );

  return (
    <div class="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
      <button
        class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
          props.activeTab === "content"
            ? "bg-primary text-primary-foreground"
            : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        onClick={() => props.onTabChange("content")}
      >
        Content
      </button>

      <For each={props.templates}>
        {(template) => {
          const hasDoc = () =>
            props.documents.some((d) => d.templateId === template.id);
          return (
            <button
              class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                props.activeTab === template.id
                  ? "bg-primary text-primary-foreground"
                  : hasDoc()
                    ? "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "bg-muted/20 text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground"
              }`}
              onClick={() => props.onTabChange(template.id)}
            >
              {template.name}
            </button>
          );
        }}
      </For>

      <button
        class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap bg-muted/20 text-muted-foreground/40 border border-dashed border-muted-foreground/15 hover:bg-muted/30 hover:text-muted-foreground"
        onClick={props.onAddCustom}
      >
        <Plus size={12} class="inline -mt-px mr-0.5" />
        Custom
      </button>

      <Show when={props.hasContent && !allGenerated()}>
        <button
          class="ml-auto px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
          onClick={props.onGenerateAll}
          disabled={props.generatingAll}
        >
          <Zap size={12} class="inline -mt-px mr-0.5" />
          {props.generatingAll ? "Generating..." : "Generate All"}
        </button>
      </Show>
    </div>
  );
}
