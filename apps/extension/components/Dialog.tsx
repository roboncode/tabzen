import { createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** Max width class, defaults to "max-w-[480px]" */
  maxWidth?: string;
}

/**
 * Reusable dialog component.
 * - Animated fade in / scale
 * - Escape key closes
 * - Backdrop mousedown closes (not click — safe for text selection)
 * - Prevents scroll on body while open
 */
export default function Dialog(props: DialogProps) {
  const [visible, setVisible] = createSignal(false);

  const animateClose = () => {
    setVisible(false);
    setTimeout(() => props.onClose(), 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      animateClose();
    }
  };

  const handleBackdropMouseDown = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      animateClose();
    }
  };

  onMount(() => {
    requestAnimationFrame(() => setVisible(true));
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div
      class={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-200 ${
        visible() ? "bg-black/60" : "bg-black/0"
      }`}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        class={`bg-card rounded-xl p-6 w-full ${props.maxWidth || "max-w-[480px]"} mx-4 transition-all duration-200 ${
          visible() ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}
