import { Show } from "solid-js";
import { Eye, Star, Archive, ArchiveRestore, Trash2 } from "lucide-solid";
import type { Tab } from "@/lib/types";

interface TabRowProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
  onToggleStar: (tab: Tab) => void;
  onArchive: (tab: Tab) => void;
  onDelete: (tab: Tab) => void;
}

export default function TabRow(props: TabRowProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  return (
    <div class="group">
      <div
        class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer rounded-lg transition-colors"
        onClick={() => props.onOpen(props.tab)}
      >
        <button
          class={`flex-shrink-0 transition-all ${
            props.tab.starred
              ? "text-yellow-400"
              : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleStar(props.tab);
          }}
        >
          <Star size={14} fill={props.tab.starred ? "currentColor" : "none"} />
        </button>
        {props.tab.favicon ? (
          <img src={props.tab.favicon} alt="" class="w-5 h-5 rounded flex-shrink-0" />
        ) : (
          <div class="w-5 h-5 bg-muted/50 rounded flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <div class="text-sm text-foreground truncate">{props.tab.title}</div>
          <div class="text-xs text-muted-foreground truncate">{domain()}</div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          {props.tab.viewCount > 0 && (
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <Eye size={12} /> {props.tab.viewCount}
            </span>
          )}
          <Show
            when={props.tab.notes}
            fallback={
              <button
                class="text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onEditNotes(props.tab);
                }}
              >
                + Note
              </button>
            }
          >
            <button
              class="text-xs text-muted-foreground hover:text-foreground transition-colors max-w-[140px] truncate"
              onClick={(e) => {
                e.stopPropagation();
                props.onEditNotes(props.tab);
              }}
              title={props.tab.notes!}
            >
              {props.tab.notes}
            </button>
          </Show>
          <button
            class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => { e.stopPropagation(); props.onArchive(props.tab); }}
            title={props.tab.archived ? "Unarchive" : "Archive"}
          >
            {props.tab.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
          </button>
          <button
            class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => { e.stopPropagation(); props.onDelete(props.tab); }}
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
