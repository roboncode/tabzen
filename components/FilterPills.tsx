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
    <div class="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-hide">
      <For each={FILTERS}>
        {(filter) => (
          <button
            class={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              props.active === filter.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
