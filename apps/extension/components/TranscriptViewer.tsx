import { createSignal, For, Show } from "solid-js";
import { Copy, Check, X } from "lucide-solid";
import type { TranscriptSegment } from "@tab-zen/shared";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  videoUrl: string;
  onClose: () => void;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getTimestampUrl(videoUrl: string, ms: number): string {
  const seconds = Math.floor(ms / 1000);
  try {
    const url = new URL(videoUrl);
    url.searchParams.set("t", `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}

export default function TranscriptViewer(props: TranscriptViewerProps) {
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
    <div class="bg-slate-800/50 rounded-lg border border-slate-700/50 mt-2">
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span class="text-xs font-medium text-slate-400">
          Transcript ({props.segments.length} segments)
        </span>
        <div class="flex items-center gap-1">
          <button
            onClick={copyTranscript}
            class="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy transcript"
          >
            <Show when={copied()} fallback={<Copy size={14} />}>
              <Check size={14} class="text-green-400" />
            </Show>
          </button>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div class="max-h-64 overflow-y-auto p-3 space-y-1 text-sm">
        <For each={props.segments}>
          {(segment) => (
            <div class="flex gap-2 hover:bg-slate-700/30 rounded px-1 py-0.5 -mx-1">
              <a
                href={getTimestampUrl(props.videoUrl, segment.startMs)}
                target="_blank"
                class="text-sky-400 hover:text-sky-300 font-mono text-xs shrink-0 pt-0.5"
              >
                {formatTimestamp(segment.startMs)}
              </a>
              <span class="text-slate-300">{segment.text}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
