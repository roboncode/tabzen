import { createSignal, Show } from "solid-js";
import { Copy, Check } from "lucide-solid";

interface PostCardProps {
  text: string;
  hashtags?: string;
  platform: string;
  charCount: number;
  maxChars: number;
  label?: string;
}

export default function PostCard(props: PostCardProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    const full = props.hashtags ? `${props.text}\n\n${props.hashtags}` : props.text;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="bg-muted/20 rounded-xl p-4">
      <p class="text-sm text-foreground leading-[1.7] m-0 whitespace-pre-wrap">{props.text}</p>
      <Show when={props.hashtags}>
        <div class="mt-3 pt-3 border-t border-muted-foreground/5">
          <p class="text-sm text-sky-400 m-0">{props.hashtags}</p>
        </div>
      </Show>
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-muted-foreground/5">
        <span class={`text-xs ${props.charCount > props.maxChars ? "text-red-400" : "text-muted-foreground"}`}>
          {props.label ? `${props.label} · ` : ""}{props.charCount} / {props.maxChars} chars
          {props.charCount > props.maxChars ? " — over limit" : ""}
        </span>
        <button
          onClick={handleCopy}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors"
        >
          {copied() ? <Check size={12} /> : <Copy size={12} />}
          {copied() ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
