import { createSignal, Show, For } from "solid-js";
import { ShieldBan, Trash2 } from "lucide-solid";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

interface BlockedDomainsManagerProps {
  settings: Settings;
  save: (updates: Partial<Settings>) => Promise<void>;
}

function sanitizeDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//, "").replace("www.", "").replace(/\/.*$/, "");
}

export default function BlockedDomainsManager(props: BlockedDomainsManagerProps) {
  const s = () => props.settings;
  const [newDomain, setNewDomain] = createSignal("");
  const [bulkMode, setBulkMode] = createSignal(false);
  const [bulkText, setBulkText] = createSignal("");

  const addDomain = () => {
    const d = sanitizeDomain(newDomain());
    if (d) {
      const blocked = [...(s().blockedDomains || [])];
      if (!blocked.includes(d)) {
        blocked.push(d);
        props.save({ blockedDomains: blocked });
      }
      setNewDomain("");
    }
  };

  const addBulk = () => {
    const lines = bulkText().split("\n").map(sanitizeDomain).filter(Boolean);
    if (lines.length === 0) return;
    const blocked = [...(s().blockedDomains || [])];
    let added = 0;
    for (const d of lines) {
      if (!blocked.includes(d)) {
        blocked.push(d);
        added++;
      }
    }
    if (added > 0) {
      props.save({ blockedDomains: blocked });
    }
    setBulkText("");
    setBulkMode(false);
  };

  return (
    <>
      <div class="flex items-center justify-end gap-2 mb-3">
        <button
          class="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md hover:text-foreground hover:bg-muted transition-colors"
          onClick={() => setBulkMode(true)}
        >
          Add multiple
        </button>
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

        <Show when={!bulkMode()}>
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
        </Show>

        <Show when={bulkMode()}>
          <div class="space-y-2">
            <textarea
              class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors resize-none placeholder:text-muted-foreground"
              rows={5}
              placeholder={"Paste domains, one per line:\nexample.com\nmail.google.com\nlogin.microsoft.com"}
              value={bulkText()}
              onInput={(e) => setBulkText(e.currentTarget.value)}
            />
            <div class="flex gap-2">
              <button
                class="px-3 py-2 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors"
                onClick={addBulk}
                disabled={!bulkText().trim()}
              >
                Add All
              </button>
              <button
                class="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                onClick={() => { setBulkMode(false); setBulkText(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>

        <Show
          when={(s().blockedDomains || []).length > 0}
          fallback={
            <p class="text-sm text-muted-foreground/50">No blocked domains</p>
          }
        >
          <div class="space-y-1.5">
            <For each={s().blockedDomains || []}>
              {(domain) => (
                <div class="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 group">
                  <span class="text-sm text-foreground">{domain}</span>
                  <button
                    class="p-1 rounded text-muted-foreground hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      const updated = (s().blockedDomains || []).filter((d) => d !== domain);
                      props.save({ blockedDomains: updated });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
