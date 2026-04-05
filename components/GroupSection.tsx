import { createSignal, For, Show } from "solid-js";
import type { Tab, Group } from "@/lib/types";
import TabCard from "./TabCard";
import TabRow from "./TabRow";

interface GroupSectionProps {
  group: Group;
  tabs: Tab[];
  viewMode: "cards" | "rows";
  onOpenTab: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
  onRenameGroup: (group: Group, newName: string) => void;
}

export default function GroupSection(props: GroupSectionProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const captureDate = () => {
    const tab = props.tabs[0];
    if (!tab) return "";
    return new Date(tab.capturedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleRename = () => {
    if (inputRef && inputRef.value.trim()) {
      props.onRenameGroup(props.group, inputRef.value.trim());
    }
    setEditing(false);
  };

  return (
    <div class="mb-4">
      <div class="flex items-center justify-between px-4 py-2">
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setCollapsed(!collapsed())}
          >
            {collapsed() ? "▶" : "▼"}
          </button>
          <Show
            when={!editing()}
            fallback={
              <input
                ref={inputRef}
                class="bg-slate-800 text-sm font-semibold text-slate-100 px-2 py-0.5 rounded border border-slate-600 outline-none focus:border-blue-500"
                value={props.group.name}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            }
          >
            <h3
              class="text-sm font-semibold text-slate-100 cursor-pointer hover:text-blue-400"
              onDblClick={() => setEditing(true)}
            >
              {props.group.name}
            </h3>
          </Show>
          <span class="text-xs text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">
            {props.tabs.length}
          </span>
        </div>
        <span class="text-xs text-slate-500">{captureDate()}</span>
      </div>
      <Show when={!collapsed()}>
        <Show
          when={props.viewMode === "cards"}
          fallback={
            <div class="space-y-0.5">
              <For each={props.tabs}>
                {(tab) => (
                  <TabRow
                    tab={tab}
                    onOpen={props.onOpenTab}
                    onEditNotes={props.onEditNotes}
                  />
                )}
              </For>
            </div>
          }
        >
          <div class="grid gap-3 px-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <For each={props.tabs}>
              {(tab) => (
                <TabCard
                  tab={tab}
                  onOpen={props.onOpenTab}
                  onEditNotes={props.onEditNotes}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
