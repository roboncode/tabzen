import { LayoutGrid, List } from "lucide-solid";

interface ViewToggleProps {
  mode: "cards" | "rows";
  onChange: (mode: "cards" | "rows") => void;
}

export default function ViewToggle(props: ViewToggleProps) {
  return (
    <div class="flex bg-muted/40 rounded-lg p-1 gap-0.5">
      <button
        class={`p-1.5 rounded-md transition-colors ${
          props.mode === "cards"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => props.onChange("cards")}
        title="Card view"
      >
        <LayoutGrid size={15} />
      </button>
      <button
        class={`p-1.5 rounded-md transition-colors ${
          props.mode === "rows"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => props.onChange("rows")}
        title="List view"
      >
        <List size={15} />
      </button>
    </div>
  );
}
