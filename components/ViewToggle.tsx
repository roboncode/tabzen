interface ViewToggleProps {
  mode: "cards" | "rows";
  onChange: (mode: "cards" | "rows") => void;
}

export default function ViewToggle(props: ViewToggleProps) {
  return (
    <div class="flex bg-slate-800 rounded-md p-0.5 text-xs">
      <button
        class={`px-2 py-1 rounded ${
          props.mode === "cards"
            ? "bg-slate-700 text-slate-100"
            : "text-slate-400 hover:text-slate-200"
        }`}
        onClick={() => props.onChange("cards")}
      >
        Cards
      </button>
      <button
        class={`px-2 py-1 rounded ${
          props.mode === "rows"
            ? "bg-slate-700 text-slate-100"
            : "text-slate-400 hover:text-slate-200"
        }`}
        onClick={() => props.onChange("rows")}
      >
        Rows
      </button>
    </div>
  );
}
