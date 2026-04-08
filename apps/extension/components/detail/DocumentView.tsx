import { createSignal, Show } from "solid-js";
import { Loader2, RefreshCw, Copy, Check } from "lucide-solid";
import { marked } from "marked";
import type { AITemplate, AIDocument } from "@/lib/types";

interface DocumentViewProps {
  template: AITemplate;
  document: AIDocument | undefined;
  generating: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export default function DocumentView(props: DocumentViewProps) {
  const [copied, setCopied] = createSignal(false);

  const htmlContent = () => {
    if (!props.document?.content) return "";
    return marked.parse(props.document.content, { async: false }) as string;
  };

  const handleCopy = () => {
    if (!props.document?.content) return;
    navigator.clipboard.writeText(props.document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Show when={props.generating}>
        <div class="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={24} class="text-sky-400 animate-spin" />
          <p class="text-sm text-muted-foreground">
            Generating {props.template.name.toLowerCase()}...
          </p>
        </div>
      </Show>

      <Show when={!props.generating && !props.document}>
        <div class="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <p class="text-sm">
            Generate a {props.template.name.toLowerCase()} of this content
          </p>
          <button
            onClick={props.onGenerate}
            class="px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-sm font-medium transition-colors"
          >
            Generate
          </button>
        </div>
      </Show>

      <Show when={!props.generating && props.document}>
        <div class="px-2 pb-12">
          <div class="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={props.onRegenerate}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
            <button
              onClick={handleCopy}
              class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/30 transition-colors"
            >
              {copied() ? <Check size={12} /> : <Copy size={12} />}
              {copied() ? "Copied" : "Copy"}
            </button>
          </div>
          <div
            class="prose-custom space-y-4"
            innerHTML={htmlContent()}
          />
        </div>
      </Show>
    </div>
  );
}
