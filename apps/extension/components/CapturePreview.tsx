import { createSignal, createMemo, For, Show } from "solid-js";
import type { CapturePreviewData } from "@/lib/types";
import {
  filterPreviewByTypes,
  presentTypeIds,
} from "@/lib/capture-filter";
import { resolveMediaType, type MediaTypeDef } from "@/lib/media-types";

interface CapturePreviewProps {
  data: CapturePreviewData;
  /** Domain → type overrides (for classifying preview pages). */
  overrides: Record<string, string>;
  /** Custom types, for resolving chip labels. */
  customTypes: MediaTypeDef[];
  /** Saved default capture types; [] means "all present types". */
  defaultTypes: string[];
  onConfirm: (filtered: CapturePreviewData) => void;
  onCancel: () => void;
}

export default function CapturePreview(props: CapturePreviewProps) {
  // Type ids present among the candidate pages, in display order.
  const present = createMemo(() => presentTypeIds(props.data, props.overrides));

  // Initial selection: saved default ∩ present, or all present when no default.
  const initial = () => {
    const p = present();
    if (!props.defaultTypes.length) return p;
    const chosen = p.filter((id) => props.defaultTypes.includes(id));
    return chosen.length ? chosen : p;
  };

  const [selected, setSelected] = createSignal<string[]>(initial());

  const toggle = (id: string) =>
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const filtered = createMemo(() =>
    filterPreviewByTypes(props.data, selected(), props.overrides),
  );

  const chipLabel = (id: string) => resolveMediaType(id, props.customTypes).label;

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-card rounded-xl p-5 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
        <h2 class="text-base font-semibold text-foreground mb-1">
          Capture Preview
        </h2>
        <p class="text-sm text-muted-foreground mb-3">
          {filtered().pages.length} of {props.data.pages.length} tabs in{" "}
          {filtered().groups.length} groups
        </p>

        {/* Type filter chips */}
        <Show when={present().length > 1}>
          <div class="flex flex-wrap gap-1.5 mb-4">
            <For each={present()}>
              {(id) => (
                <button
                  class={`px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    selected().includes(id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => toggle(id)}
                >
                  {chipLabel(id)}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class="space-y-3 mb-5">
          <For each={filtered().groups}>
            {(group) => {
              const groupPages = () =>
                filtered().pages.filter((t) => group.pageIds.includes(t.id));
              return (
                <div class="bg-muted/30 rounded-lg p-3">
                  <h3 class="text-sm font-medium text-foreground mb-2">
                    {group.groupName}
                    <span class="text-muted-foreground ml-2 text-xs">
                      ({groupPages().length})
                    </span>
                  </h3>
                  <ul class="space-y-1.5">
                    <For each={groupPages()}>
                      {(tab) => (
                        <li class="text-xs text-muted-foreground truncate flex items-center gap-2">
                          {tab.favicon && (
                            <img src={tab.favicon} alt="" class="w-3.5 h-3.5 rounded-sm" />
                          )}
                          {tab.title}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              );
            }}
          </For>
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            disabled={filtered().pages.length === 0}
            onClick={() => props.onConfirm(filtered())}
          >
            Save {filtered().pages.length} Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
