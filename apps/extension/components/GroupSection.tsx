import { createSignal, For, Show } from "solid-js";
import { ChevronRight, ChevronDown } from "lucide-solid";
import type { Page, Group } from "@/lib/types";
import PageCard from "./PageCard";
import PageRow from "./PageRow";

interface GroupSectionProps {
  group: Group;
  pages: Page[];
  viewMode: "cards" | "rows";
  searchQuery?: string;
  onOpenPage: (page: Page) => void;
  onEditNotes: (page: Page) => void;
  onRenameGroup: (group: Group, newName: string) => void;
  onToggleStar: (page: Page) => void;
  onOpenSource?: (page: Page) => void;
  onRestore?: (page: Page) => void;
  onHardDelete?: (page: Page) => void;
  onSelectCreator?: (domain: string, creator: string) => void;
  onTagClick?: (tag: string) => void;
  isTrash?: boolean;
}

export default function GroupSection(props: GroupSectionProps) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const captureDate = () => {
    const page = props.pages[0];
    if (!page) return "";
    return new Date(page.capturedAt).toLocaleDateString("en-US", {
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
    <div class="mb-6">
      {/* Group header - shading instead of borders */}
      <div
        class="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors mx-4 mb-3 cursor-pointer"
        onClick={() => setCollapsed(!collapsed())}
      >
        <div class="flex items-center gap-2.5">
          <span class="text-muted-foreground">
            {collapsed() ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </span>
          <Show
            when={!editing()}
            fallback={
              <input
                ref={inputRef}
                class="bg-muted/60 text-sm font-medium text-foreground px-2 py-0.5 rounded-md outline-none focus:ring-1 focus:ring-ring"
                value={props.group.name}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <h3
              class="text-sm font-medium text-foreground"
              onDblClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              {props.group.name}
            </h3>
          </Show>
          <span class="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
            {props.pages.length}
          </span>
        </div>
        <span class="text-xs text-muted-foreground">{captureDate()}</span>
      </div>

      <Show when={!collapsed()}>
        <Show
          when={props.viewMode === "cards"}
          fallback={
            <div class="space-y-0.5 px-2">
              <For each={props.pages}>
                {(page) => (
                  <PageRow
                    page={page}
                    searchQuery={props.searchQuery}
                    onOpen={props.onOpenPage}
                    onEditNotes={props.onEditNotes}
                    onToggleStar={props.onToggleStar}
                    onOpenSource={props.onOpenSource}
                    onRestore={props.onRestore}
                    onHardDelete={props.onHardDelete}
                    onSelectCreator={props.onSelectCreator}
                    onTagClick={props.onTagClick}
                    isTrash={props.isTrash}
                  />
                )}
              </For>
            </div>
          }
        >
          {/* Responsive grid using container queries */}
          <div class="grid grid-cols-1 @[480px]:grid-cols-2 @[768px]:grid-cols-3 @[1024px]:grid-cols-4 @[1400px]:grid-cols-5 gap-x-4 gap-y-6 px-4">
            <For each={props.pages}>
              {(page) => (
                <div>
                  <PageCard
                    page={page}
                    searchQuery={props.searchQuery}
                    onOpen={props.onOpenPage}
                    onEditNotes={props.onEditNotes}
                    onToggleStar={props.onToggleStar}
                    onOpenSource={props.onOpenSource}
                    onRestore={props.onRestore}
                    onHardDelete={props.onHardDelete}
                    isTrash={props.isTrash}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
