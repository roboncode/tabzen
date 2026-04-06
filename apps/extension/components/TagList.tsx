import { For, Show } from "solid-js";

interface TagListProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  class?: string;
}

export default function TagList(props: TagListProps) {
  return (
    <Show when={props.tags.length > 0}>
      <div class={`flex flex-wrap gap-x-2 gap-y-1 ${props.class || ""}`}>
        <For each={props.tags}>
          {(tag) => (
            <button
              class="text-sm text-sky-400 cursor-pointer hover:text-sky-300 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                props.onTagClick?.(tag);
              }}
            >
              #{tag}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
