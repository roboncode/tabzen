import type { JSX } from "solid-js";

interface IconButtonProps {
  onClick: (e: MouseEvent) => void;
  children: JSX.Element;
  title?: string;
  variant?: "default" | "destructive" | "active";
  active?: boolean;
  class?: string;
}

export default function IconButton(props: IconButtonProps) {
  const baseClass = "p-2 rounded-lg transition-colors";

  const variantClass = () => {
    if (props.variant === "destructive") return "text-muted-foreground hover:text-red-400 hover:bg-red-400/10";
    if (props.variant === "active" || props.active) return "text-yellow-400 hover:bg-yellow-400/10";
    return "text-muted-foreground hover:text-foreground hover:bg-muted/50";
  };

  return (
    <button
      onClick={props.onClick}
      class={`${baseClass} ${variantClass()} ${props.class || ""}`}
      title={props.title}
    >
      {props.children}
    </button>
  );
}
