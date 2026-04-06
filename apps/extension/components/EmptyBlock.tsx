import { Show, type JSX } from "solid-js";

interface EmptyBlockProps {
  icon: JSX.Element;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state block.
 * Use anywhere content is missing — filter views, detail page tabs, etc.
 */
export default function EmptyBlock(props: EmptyBlockProps) {
  return (
    <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div class="text-muted-foreground/40 mb-5">
        {props.icon}
      </div>
      <h2 class="text-base font-semibold text-foreground mb-2">{props.title}</h2>
      <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {props.description}
      </p>
      <Show when={props.actionLabel && props.onAction}>
        <button
          onClick={props.onAction}
          class="mt-4 px-4 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-foreground transition-colors"
        >
          {props.actionLabel}
        </button>
      </Show>
    </div>
  );
}
