import { createSignal } from "solid-js";
import { Search } from "lucide-solid";

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
    }, 300);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && query().trim()) {
      props.onAISearch(query().trim());
    }
  };

  return (
    <div class="px-4 pt-4 pb-2">
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search size={15} />
        </span>
        <input
          type="text"
          class="w-full bg-muted/40 text-sm text-foreground rounded-lg pl-10 pr-4 py-2.5 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
          placeholder={props.placeholder || "Search tabs, notes, descriptions..."}
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <p class="text-xs text-muted-foreground/60 mt-1.5 px-1">
        Press Enter for AI search
      </p>
    </div>
  );
}
