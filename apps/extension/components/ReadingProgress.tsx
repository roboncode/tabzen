import { createSignal, onMount, onCleanup } from "solid-js";

interface ReadingProgressProps {
  /** The scrollable container element to track */
  scrollRef: HTMLElement | undefined;
  /** Total estimated reading time in minutes */
  readingTimeMin: number;
}

/**
 * Reading progress indicator.
 * Shows a progress bar and estimated time remaining.
 */
export default function ReadingProgress(props: ReadingProgressProps) {
  const [progress, setProgress] = createSignal(0);
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const el = props.scrollRef;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) {
        setProgress(0);
        setVisible(false);
        return;
      }
      const p = Math.min(1, Math.max(0, scrollTop / maxScroll));
      setProgress(p);
      setVisible(scrollTop > 50);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    onCleanup(() => el.removeEventListener("scroll", handleScroll));
  });

  const minutesLeft = () => {
    const remaining = Math.ceil(props.readingTimeMin * (1 - progress()));
    if (remaining <= 0) return "Done";
    if (remaining === 1) return "1 min left";
    return `${remaining} min left`;
  };

  const percentDone = () => Math.round(progress() * 100);

  return (
    <div
      class={`flex items-center gap-4 px-6 py-2 transition-opacity duration-300 ${
        visible() ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Progress bar */}
      <div class="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{
            width: `${progress() * 100}%`,
            background: "linear-gradient(90deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.7))",
          }}
        />
      </div>

      {/* Percentage */}
      <span class={`text-xl font-extralight tracking-tight flex-shrink-0 tabular-nums transition-colors duration-300 ${
        percentDone() >= 100 ? "text-sky-400" : "text-muted-foreground/25"
      }`}>
        {percentDone()}%
      </span>
    </div>
  );
}
