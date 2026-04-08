import { createSignal, Show } from "solid-js";
import { Loader2, Copy, Check } from "lucide-solid";
import { marked } from "marked";

interface CustomPromptViewProps {
  onCreateTemplate: (name: string, prompt: string) => Promise<void>;
  generating: boolean;
  result: string | null;
}

export default function CustomPromptView(props: CustomPromptViewProps) {
  const [prompt, setPrompt] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  const htmlContent = () => {
    if (!props.result) return "";
    return marked.parse(props.result, { async: false }) as string;
  };

  const handleRun = () => {
    const text = prompt().trim();
    if (!text) return;
    const name = text.slice(0, 30) + (text.length > 30 ? "..." : "");
    props.onCreateTemplate(name, text);
  };

  const handleCopy = () => {
    if (!props.result) return;
    navigator.clipboard.writeText(props.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="px-2 pb-12">
      <div class="mb-4">
        <textarea
          class="w-full bg-muted/30 text-sm text-foreground rounded-lg px-3 py-2.5 outline-none focus:bg-muted/40 transition-colors resize-none placeholder:text-muted-foreground/30"
          rows={3}
          maxLength={500}
          placeholder="Describe what you want to extract or generate from this content..."
          value={prompt()}
          onInput={(e) => setPrompt(e.currentTarget.value)}
          disabled={props.generating}
        />
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-muted-foreground/40">
            {prompt().length}/500
          </span>
          <button
            onClick={handleRun}
            disabled={!prompt().trim() || props.generating}
            class="px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {props.generating ? "Generating..." : "Run"}
          </button>
        </div>
      </div>

      <Show when={props.generating}>
        <div class="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={24} class="text-sky-400 animate-spin" />
          <p class="text-sm text-muted-foreground">Generating...</p>
        </div>
      </Show>

      <Show when={!props.generating && props.result}>
        <div>
          <div class="flex items-center justify-end gap-2 mb-4">
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
