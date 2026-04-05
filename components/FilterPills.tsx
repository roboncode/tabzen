import { For } from "solid-js";
import type { Settings } from "@/lib/types";

interface FilterPillsProps {
  active: Settings["activeFilter"];
  onChange: (filter: Settings["activeFilter"]) => void;
}

const FILTERS: { key: Settings["activeFilter"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "byDate", label: "By Date" },
  { key: "archived", label: "Archived" },
  { key: "duplicates", label: "Duplicates" },
];

export default function FilterPills(props: FilterPillsProps) {
  return (
    <div class="flex gap-1.5 px-4 pb-3">
      <For each={FILTERS}>
        {(filter) => (
          <button
            class={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              props.active === filter.key
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => props.onChange(filter.key)}
          >
            {filter.label}
          </button>
        )}
      </For>
    </div>
  );
}
