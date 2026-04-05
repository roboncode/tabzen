import { createSignal } from "solid-js";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onAISearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar(props: SearchBarProps) {
  const [query, setQuery] = createSignal("");
  let debounceTimer: ReturnType<typeof setTimeout>;

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      props.onSearch(value);
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && query().trim()) {
      props.onAISearch(query().trim());
    }
  };

  return (
    <div class="px-4 pt-3 pb-2">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
          🔍
        </span>
        <input
          type="text"
          class="w-full bg-slate-800 text-sm text-slate-200 rounded-lg pl-9 pr-3 py-2.5 border border-slate-700 outline-none focus:border-blue-500 placeholder:text-slate-500"
          placeholder={props.placeholder || "Search tabs, notes, descriptions..."}
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p class="text-[10px] text-slate-600 mt-1 px-1">
        Press Enter for AI search
      </p>
    </div>
  );
}
