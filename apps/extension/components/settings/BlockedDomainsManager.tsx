import { createSignal, Show, For } from "solid-js";
import { ShieldBan } from "lucide-solid";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

interface BlockedDomainsManagerProps {
  settings: Settings;
  save: (updates: Partial<Settings>) => Promise<void>;
}

export default function BlockedDomainsManager(props: BlockedDomainsManagerProps) {
  const s = () => props.settings;

  return (
    <>
      <div class="flex items-center justify-end mb-3">
        <button
          class="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => props.save({ blockedDomains: DEFAULT_SETTINGS.blockedDomains })}
        >
          Reset to defaults
        </button>
      </div>
      <div class="px-1 py-3 space-y-3">
        <p class="text-xs text-muted-foreground">
          Tabs from these domains will be skipped during capture.
        </p>
        <Show
          when={(s().blockedDomains || []).length > 0}
          fallback={
            <p class="text-sm text-muted-foreground/50">No blocked domains</p>
          }
        >
          <div class="space-y-1.5">
            <For each={s().blockedDomains || []}>
              {(domain) => (
                <div class="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <span class="text-sm text-foreground">{domain}</span>
                  <button
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {
                      const updated = (s().blockedDomains || []).filter((d) => d !== domain);
                      props.save({ blockedDomains: updated });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
        {(() => {
          const [newDomain, setNewDomain] = createSignal("");
          const addDomain = () => {
            const d = newDomain().trim().replace(/^https?:\/\//, "").replace("www.", "").replace(/\/.*$/, "");
            if (d) {
              const blocked = [...(s().blockedDomains || [])];
              if (!blocked.includes(d)) {
                blocked.push(d);
                props.save({ blockedDomains: blocked });
              }
              setNewDomain("");
            }
          };
          return (
            <div class="flex gap-2">
              <input
                class="flex-1 bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
                placeholder="Add domain (e.g. mail.google.com)"
                value={newDomain()}
                onInput={(e) => setNewDomain(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
              />
              <button
                class="px-3 py-2 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                onClick={addDomain}
              >
                Add
              </button>
            </div>
          );
        })()}
      </div>
    </>
  );
}
