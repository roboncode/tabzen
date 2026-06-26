import { createSignal, For, Show } from "solid-js";
import type { Settings } from "@/lib/types";
import { allMediaTypes } from "@/lib/media-types";

interface ContentTypesPanelProps {
  settings: Settings;
  save: (partial: Partial<Settings>) => void;
}

export default function ContentTypesPanel(props: ContentTypesPanelProps) {
  const [newName, setNewName] = createSignal("");

  const types = () => allMediaTypes(props.settings.customTypes);
  const captureTypes = () => props.settings.captureTypes;

  const toggleCapture = (id: string) => {
    const cur = captureTypes();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    props.save({ captureTypes: next });
  };

  const addType = () => {
    const label = newName().trim();
    if (!label) return;
    const id = `custom-${crypto.randomUUID()}`;
    props.save({
      customTypes: [...props.settings.customTypes, { id, label, color: "#6366f1", builtIn: false }],
    });
    setNewName("");
  };

  const deleteType = (id: string) => {
    const customTypes = props.settings.customTypes.filter((t) => t.id !== id);
    const captureTypesNext = props.settings.captureTypes.filter((t) => t !== id);
    // Strip overrides pointing at the deleted type (they resolve to "other").
    const overrides = { ...props.settings.domainTypeOverrides };
    for (const [domain, typeId] of Object.entries(overrides)) {
      if (typeId === id) delete overrides[domain];
    }
    props.save({ customTypes, captureTypes: captureTypesNext, domainTypeOverrides: overrides });
  };

  // domains routed to each type via overrides (custom-routed sites).
  const overriddenDomains = (typeId: string) =>
    Object.entries(props.settings.domainTypeOverrides)
      .filter(([, t]) => t === typeId)
      .map(([d]) => d);

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-sm font-medium text-foreground mb-1">Capture by type</h3>
        <p class="text-sm text-muted-foreground mb-3">
          When saving all tabs, only these types are saved. Select none to save everything.
        </p>
        <div class="flex flex-wrap gap-1.5">
          <For each={types()}>
            {(t) => (
              <button
                class={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                  captureTypes().includes(t.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => toggleCapture(t.id)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium text-foreground mb-1">Your groups</h3>
        <p class="text-sm text-muted-foreground mb-3">
          Custom types you can move domains into. Built-in types can't be removed.
        </p>
        <div class="space-y-1.5">
          <For each={props.settings.customTypes}>
            {(t) => (
              <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ "background-color": t.color }} />
                <span class="flex-1 text-sm text-foreground truncate">{t.label}</span>
                <Show when={overriddenDomains(t.id).length}>
                  <span class="text-xs text-muted-foreground/60">
                    {overriddenDomains(t.id).length} sites
                  </span>
                </Show>
                <button
                  class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => deleteType(t.id)}
                >
                  Delete
                </button>
              </div>
            )}
          </For>
          <Show when={!props.settings.customTypes.length}>
            <p class="text-sm text-muted-foreground/60">No custom groups yet.</p>
          </Show>
        </div>
        <div class="flex gap-2 mt-3">
          <input
            class="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            placeholder="New group name"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
          />
          <button
            class="px-3 py-2 text-sm bg-muted hover:bg-muted/70 text-foreground rounded-lg transition-colors disabled:opacity-40"
            disabled={!newName().trim()}
            onClick={addType}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
