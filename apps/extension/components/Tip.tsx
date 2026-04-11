import { createSignal, Show } from "solid-js";

interface TipItem {
  title?: string;
  message: string;
}

interface TipProps {
  tips: TipItem[];
  onDismiss: () => void;
  onDontShowAgain?: () => void;
}

export default function Tip(props: TipProps) {
  const [index, setIndex] = createSignal(0);
  const current = () => props.tips[index()];
  const isLast = () => index() >= props.tips.length - 1;
  const hasMultiple = () => props.tips.length > 1;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="bg-white rounded-2xl px-8 py-6 max-w-sm shadow-2xl shadow-black/40 pointer-events-auto">
        <Show when={current().title}>
          <h3 class="text-base font-semibold text-gray-900 mb-2">{current().title}</h3>
        </Show>
        <p class="text-sm text-gray-600 leading-relaxed">{current().message}</p>

        {/* Progress dots */}
        <Show when={hasMultiple()}>
          <div class="flex items-center gap-1.5 mt-4">
            {props.tips.map((_, i) => (
              <div class={`w-1.5 h-1.5 rounded-full transition-colors ${i === index() ? "bg-sky-500" : "bg-gray-300"}`} />
            ))}
          </div>
        </Show>

        <div class="flex items-center justify-between mt-4">
          <Show
            when={!isLast()}
            fallback={
              <button
                class="px-5 py-1.5 text-sm font-medium text-white bg-sky-500 rounded-full hover:bg-sky-600 transition-colors"
                onClick={props.onDismiss}
              >
                Got it
              </button>
            }
          >
            <button
              class="px-5 py-1.5 text-sm font-medium text-white bg-sky-500 rounded-full hover:bg-sky-600 transition-colors"
              onClick={() => setIndex(index() + 1)}
            >
              Next
            </button>
          </Show>

          <Show when={props.onDontShowAgain}>
            <button
              class="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              onClick={props.onDontShowAgain}
            >
              Don't show again
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
