import { createSignal, For, Show } from "solid-js";
import { Copy, Check } from "lucide-solid";

interface ThreadPost {
  text: string;
  charCount: number;
}

interface ThreadViewProps {
  posts: ThreadPost[];
  platform: string;
  platformColor: string;
  platformLabel: string;
  maxChars: number;
  hashtags?: string;
  onClear?: () => void;
}

export default function ThreadView(props: ThreadViewProps) {
  const [copiedAll, setCopiedAll] = createSignal(false);
  const [copiedIdx, setCopiedIdx] = createSignal<number | null>(null);

  const handleCopyAll = () => {
    const all = props.posts.map((p) => p.text).join("\n\n---\n\n");
    const full = props.hashtags ? `${all}\n\n${props.hashtags}` : all;
    navigator.clipboard.writeText(full);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyOne = (idx: number) => {
    const post = props.posts[idx];
    const isLast = idx === props.posts.length - 1;
    const text = isLast && props.hashtags ? `${post.text}\n\n${props.hashtags}` : post.text;
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span
            class="text-xs font-semibold px-2.5 py-1 rounded-md text-white"
            style={{ background: props.platformColor }}
          >
            {props.platformLabel}
          </span>
          <span class="text-sm font-medium text-foreground">Thread</span>
          <span class="text-sm text-muted-foreground">· {props.posts.length} posts</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            {copiedAll() ? <Check size={12} /> : <Copy size={12} />}
            {copiedAll() ? "Copied" : "Copy All"}
          </button>
          <Show when={props.onClear}>
            <button
              onClick={props.onClear}
              class="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/30 transition-colors"
            >
              Start Over
            </button>
          </Show>
        </div>
      </div>

      {/* Thread posts connected by vertical line */}
      <div class="border-l-2 border-sky-400/15 pl-4 flex flex-col gap-3">
        <For each={props.posts}>
          {(post, i) => {
            const isCopied = () => copiedIdx() === i();
            return (
              <div class="bg-muted/20 rounded-xl p-4">
                <p class="text-sm text-foreground leading-[1.7] m-0 whitespace-pre-wrap">{post.text}</p>
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-muted-foreground/5">
                  <span class={`text-xs ${post.charCount > props.maxChars ? "text-red-400" : "text-muted-foreground"}`}>
                    {i() + 1}/{props.posts.length} · {post.charCount} / {props.maxChars} chars
                    {post.charCount > props.maxChars ? " — over limit" : ""}
                  </span>
                  <button
                    onClick={() => handleCopyOne(i())}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors"
                  >
                    {isCopied() ? <Check size={12} /> : <Copy size={12} />}
                    {isCopied() ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
