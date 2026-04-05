import { createSignal, onMount } from "solid-js";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    requestAnimationFrame(() => setVisible(true));
  });

  const animateClose = (callback: () => void) => {
    setVisible(false);
    setTimeout(callback, 150);
  };

  return (
    <div
      class={`fixed inset-0 z-[60] transition-colors duration-150 flex items-center justify-center ${visible() ? "bg-black/60" : "bg-black/0"}`}
      onClick={() => animateClose(props.onCancel)}
    >
      <div
        class={`bg-card rounded-xl p-6 w-[360px] max-w-[90vw] transition-all duration-150 ${visible() ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 class="text-base font-semibold text-foreground mb-2">{props.title}</h3>
        <p class="text-sm text-muted-foreground mb-5">{props.message}</p>
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={() => animateClose(props.onCancel)}
          >
            Cancel
          </button>
          <button
            class={`px-4 py-2 text-sm rounded-lg transition-colors ${
              props.destructive
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
            onClick={() => animateClose(props.onConfirm)}
          >
            {props.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
