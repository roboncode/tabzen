import { Show } from "solid-js";

interface TipProps {
  title?: string;
  message: string;
  onDismiss: () => void;
  dismissLabel?: string;
}

export default function Tip(props: TipProps) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="bg-white rounded-2xl px-8 py-6 max-w-sm shadow-2xl shadow-black/40 pointer-events-auto text-center">
        <Show when={props.title}>
          <h3 class="text-base font-semibold text-gray-900 mb-2">{props.title}</h3>
        </Show>
        <p class="text-sm text-gray-600 leading-relaxed">{props.message}</p>
        <button
          class="mt-4 px-5 py-1.5 text-sm font-medium text-white bg-sky-500 rounded-full hover:bg-sky-600 transition-colors"
          onClick={props.onDismiss}
        >
          {props.dismissLabel || "Got it"}
        </button>
      </div>
    </div>
  );
}
