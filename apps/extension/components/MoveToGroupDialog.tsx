import { createSignal, For, Show } from "solid-js";
import { allMediaTypes, type MediaTypeDef } from "@/lib/media-types";

interface MoveToGroupDialogProps {
  domain: string;
  itemCount: number;
  customTypes: MediaTypeDef[];
  currentTypeId: string;
  onPick: (typeId: string) => void;
  onCreate: (label: string) => void;
  onCancel: () => void;
}

export default function MoveToGroupDialog(props: MoveToGroupDialogProps) {
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={props.onCancel}>
      <div
        class="bg-card rounded-xl p-5 w-80 max-w-[90vw] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 class="text-base font-semibold text-foreground mb-1">Move to group</h2>
        <p class="text-sm text-muted-foreground mb-4">
          Routes <span class="text-foreground">{props.domain}</span> ({props.itemCount}{" "}
          {props.itemCount === 1 ? "item" : "items"}). Future items from this domain follow.
        </p>

        <div class="space-y-0.5 mb-3">
          <For each={allMediaTypes(props.customTypes)}>
            {(t) => (
              <button
                class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  t.id === props.currentTypeId
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
                onClick={() => props.onPick(t.id)}
              >
                <Show when={t.color}>
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ "background-color": t.color }} />
                </Show>
                <span class="flex-1 truncate">{t.label}</span>
                <Show when={t.id === props.currentTypeId}>
                  <span class="text-xs text-muted-foreground/60">current</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <Show
          when={creating()}
          fallback={
            <button
              class="w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors text-left"
              onClick={() => setCreating(true)}
            >
              + New group…
            </button>
          }
        >
          <div class="flex gap-2">
            <input
              class="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="Group name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name().trim()) props.onCreate(name().trim());
              }}
              autofocus
            />
            <button
              class="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
              disabled={!name().trim()}
              onClick={() => props.onCreate(name().trim())}
            >
              Create
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
