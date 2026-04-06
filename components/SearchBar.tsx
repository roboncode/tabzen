import { createSignal, createMemo, createEffect, For, Show } from "solid-js";
import { Search, X } from "lucide-solid";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onAISearch: (query: string) => void;
  placeholder?: string;
  value?: string;
  tags?: { tag: string; count: number }[];
}

export default function SearchBar(props: SearchBarProps) {
  const [query, setQuery] = createSignal(props.value || "");
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  let debounceTimer: ReturnType<typeof setTimeout>;
  let inputRef: HTMLInputElement | undefined;

  // Sync external value (SolidJS: track prop reactively)
  createEffect(() => {
    const v = props.value;
    if (v !== undefined && v !== query()) setQuery(v);
  });

  // Memoize suggestions so it only recomputes when query or tags change
  const suggestions = createMemo(() => {
    const q = query();
    if (!q.startsWith("#") || q.length < 2) return [];
    const search = q.slice(1).toLowerCase();
    return (props.tags || [])
      .filter((t) => t.tag.toLowerCase().includes(search))
      .slice(0, 8);
  });

  const handleInput = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);
    setShowSuggestions(value.startsWith("#") && value.length >= 2);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      props.onSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setQuery("");
    setShowSuggestions(false);
    clearTimeout(debounceTimer);
    props.onSearch("");
  };

  const selectTag = (tag: string) => {
    const value = `#${tag}`;
    setQuery(value);
    setShowSuggestions(false);
    props.onSearch(value);
    inputRef?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const sug = suggestions();
    if (showSuggestions() && sug.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, sug.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && selectedIndex() >= 0) {
        e.preventDefault();
        selectTag(sug[selectedIndex()].tag);
        return;
      }
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
      return;
    }
    if (e.key === "Enter" && query().trim() && !query().startsWith("#")) {
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
          ref={inputRef}
          type="text"
          class="w-full bg-muted/40 text-sm text-foreground rounded-lg pl-10 pr-10 py-2.5 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
          placeholder={props.placeholder || "Search tabs, notes, #tags..."}
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        <Show when={query()}>
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleClear}
          >
            <X size={15} />
          </button>
        </Show>

        {/* Tag autocomplete dropdown */}
        <Show when={showSuggestions() && suggestions().length > 0}>
          <div class="absolute top-full left-0 right-0 mt-1 bg-card rounded-lg overflow-hidden z-10 shadow-lg">
            <For each={suggestions()}>
              {(item, index) => (
                <button
                  class={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    index() === selectedIndex()
                      ? "bg-muted/50 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                  onMouseDown={() => selectTag(item.tag)}
                >
                  <span class="text-sky-400">#{item.tag}</span>
                  <span class="text-xs text-muted-foreground/60">{item.count}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <p class="text-xs text-muted-foreground/60 mt-1.5 px-1">
        Type # for tags · Enter for AI search
      </p>
    </div>
  );
}
