import { createSignal, For, Show } from "solid-js";

interface ActionItemsViewProps {
  content: string;
}

interface TaskItem {
  title: string;
  description: string;
  effort: string | null;
  checked: boolean;
}

interface TaskGroup {
  label: string;
  priority: "now" | "later";
  items: TaskItem[];
}

function parseActionItems(content: string): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let currentGroup: TaskGroup | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      const label = trimmed.replace("## ", "");
      const priority = label.toLowerCase().includes("now") ? "now" as const : "later" as const;
      currentGroup = { label, priority, items: [] };
      groups.push(currentGroup);
      continue;
    }

    if (!currentGroup) {
      // No group header yet — create a default
      currentGroup = { label: "Tasks", priority: "now", items: [] };
      groups.push(currentGroup);
    }

    const checkMatch = trimmed.match(/^- \[([ x])\]\s*(.*)/);
    if (checkMatch) {
      const raw = checkMatch[2];
      const effortMatch = raw.match(/\(~([^)]+)\)\s*$/);
      const effort = effortMatch ? `~${effortMatch[1]}` : null;
      const withoutEffort = effort ? raw.replace(/\s*\(~[^)]+\)\s*$/, "") : raw;

      const pipeIndex = withoutEffort.indexOf("|");
      let title: string;
      let description: string;
      if (pipeIndex !== -1) {
        title = withoutEffort.slice(0, pipeIndex).trim();
        description = withoutEffort.slice(pipeIndex + 1).trim();
      } else {
        title = "";
        description = withoutEffort;
      }

      currentGroup.items.push({
        title,
        description,
        effort,
        checked: checkMatch[1] === "x",
      });
    }
  }

  return groups;
}

export default function ActionItemsView(props: ActionItemsViewProps) {
  const groups = () => parseActionItems(props.content);
  const [checkedIds, setCheckedIds] = createSignal<Set<string>>(new Set());

  const toggleCheck = (groupIdx: number, itemIdx: number) => {
    const key = `${groupIdx}-${itemIdx}`;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isChecked = (groupIdx: number, itemIdx: number) =>
    checkedIds().has(`${groupIdx}-${itemIdx}`);

  const totalItems = () => groups().reduce((sum, g) => sum + g.items.length, 0);
  const completedItems = () => checkedIds().size;

  // SVG progress ring calculations
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = () => {
    const total = totalItems();
    if (total === 0) return 0;
    return completedItems() / total;
  };
  const strokeDashoffset = () => circumference * (1 - progress());

  return (
    <div class="px-2 pb-12">
      {/* Progress header */}
      <div class="flex items-center gap-3 mb-5">
        <svg width="36" height="36" viewBox="0 0 36 36" class="-rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" stroke-width="3" class="text-muted/30" />
          <circle
            cx="18" cy="18" r={radius} fill="none"
            stroke="currentColor" stroke-width="3"
            stroke-dasharray={`${circumference}`}
            stroke-dashoffset={`${strokeDashoffset()}`}
            stroke-linecap="round"
            class="text-emerald-400 transition-all duration-300"
          />
        </svg>
        <div>
          <span class="text-sm font-semibold text-foreground">{completedItems()} of {totalItems()}</span>
          <span class="text-sm text-muted-foreground/50 ml-1.5">completed</span>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <For each={groups()}>
          {(group, gi) => (
            <div>
              {/* Group header */}
              <div class="flex items-center gap-1.5 mb-2 pl-1">
                <div
                  class={`w-1.5 h-1.5 rounded-full ${
                    group.priority === "now" ? "bg-sky-400" : "bg-muted-foreground/30"
                  }`}
                />
                <span
                  class={`text-[11px] font-semibold tracking-wider uppercase ${
                    group.priority === "now" ? "text-sky-400/70" : "text-muted-foreground/40"
                  }`}
                >
                  {group.label}
                </span>
              </div>

              <div class="flex flex-col gap-1.5">
                <For each={group.items}>
                  {(item, ii) => {
                    const checked = () => isChecked(gi(), ii());
                    return (
                      <button
                        class={`flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                          checked()
                            ? "bg-emerald-500/5"
                            : group.priority === "now"
                              ? "bg-sky-400/[0.03]"
                              : "bg-transparent"
                        }`}
                        onClick={() => toggleCheck(gi(), ii())}
                      >
                        <div
                          class={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors ${
                            checked()
                              ? "bg-emerald-500/20"
                              : "bg-muted/40"
                          }`}
                        >
                          <Show when={checked()}>
                            <svg width="12" height="12" viewBox="0 0 12 12" class="text-emerald-400">
                              <path d="M2.5 6L5 8.5L9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                          </Show>
                        </div>
                        <div class="flex-1 min-w-0">
                          <Show when={item.title}>
                            <p
                              class={`text-sm font-semibold leading-snug m-0 transition-colors ${
                                checked()
                                  ? "text-foreground/30 line-through decoration-foreground/10"
                                  : "text-foreground"
                              }`}
                            >
                              {item.title}
                            </p>
                          </Show>
                          <p
                            class={`text-sm leading-relaxed m-0 transition-colors ${
                              checked()
                                ? "text-foreground/30 line-through decoration-foreground/10"
                                : "text-foreground/60"
                            }`}
                          >
                            {item.description}
                          </p>
                          <Show when={item.effort && !checked()}>
                            <span class="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-muted/30 text-[11px] text-muted-foreground/50">
                              {item.effort}
                            </span>
                          </Show>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
