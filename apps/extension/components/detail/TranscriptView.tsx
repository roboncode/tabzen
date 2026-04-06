import { createSignal, For, Show } from "solid-js";
import { Copy, Check, FileText } from "lucide-solid";
import type { TranscriptSegment } from "@tab-zen/shared";

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  onFetchTranscript?: () => void;
  loading?: boolean;
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getTimestampUrl(videoUrl: string, ms: number): string {
  const seconds = Math.floor(ms / 1000);
  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}

export default function TranscriptView(props: TranscriptViewProps) {
  const [copied, setCopied] = createSignal(false);

  const copyTranscript = () => {
    const text = props.segments
      .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="flex flex-col h-full">
      <Show
        when={props.segments.length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
            <FileText size={32} class="opacity-40" />
            <p class="text-sm">No transcript available</p>
            <Show when={props.onFetchTranscript}>
              <button
                onClick={props.onFetchTranscript}
                disabled={props.loading}
                class="px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors disabled:opacity-50"
              >
                {props.loading ? "Fetching..." : "Fetch Transcript"}
              </button>
            </Show>
          </div>
        }
      >
        {/* Header with count and copy */}
        <div class="flex items-center gap-3 px-2 pb-3 flex-shrink-0">
          <span class="text-xs text-muted-foreground">
            {props.segments.length} segments
          </span>
          <div class="flex-1" />
          <button
            onClick={copyTranscript}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Show when={copied()} fallback={<Copy size={12} />}>
              <Check size={12} class="text-green-400" />
            </Show>
            <span>{copied() ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Segments */}
        <div class="flex-1 overflow-y-auto space-y-0.5">
          <For each={props.segments}>
            {(segment) => (
              <div class="flex gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                <a
                  href={getTimestampUrl(props.videoUrl, segment.startMs)}
                  target="_blank"
                  class="text-sky-400 hover:text-sky-300 font-mono text-xs flex-shrink-0 pt-0.5 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatTimestamp(segment.startMs)}
                </a>
                <span class="text-sm text-foreground/90 leading-relaxed">
                  {segment.text}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
