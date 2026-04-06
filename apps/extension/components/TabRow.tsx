import { Show, createMemo } from "solid-js";
import { Eye, Star, Archive, ArchiveRestore, Trash2, ShieldBan, Undo2 } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { getFaviconUrl } from "@/lib/domains";
import Highlight from "./Highlight";

interface TabRowProps {
  tab: Tab;
  searchQuery?: string;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
  onToggleStar: (tab: Tab) => void;
  onArchive: (tab: Tab) => void;
  onDelete: (tab: Tab) => void;
  onBlockDomain?: (tab: Tab) => void;
  onRestore?: (tab: Tab) => void;
  onHardDelete?: (tab: Tab) => void;
  onSelectCreator?: (domain: string, creator: string) => void;
  onTagClick?: (tag: string) => void;
  isTrash?: boolean;
}

export default function TabRow(props: TabRowProps) {
  const domain = createMemo(() => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  });

  const faviconSrc = createMemo(() => getFaviconUrl(props.tab));

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
        {faviconSrc() ? (
          <img src={faviconSrc()} alt="" class="w-5 h-5 rounded flex-shrink-0" />
        ) : (
          <div class="w-5 h-5 bg-muted/50 rounded flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <div class="text-sm text-foreground truncate">
            <Show when={props.searchQuery} fallback={props.tab.title}>
              <Highlight text={props.tab.title} query={props.searchQuery!} />
            </Show>
          </div>
          <div class="text-xs text-muted-foreground truncate">
            {domain()}
            {props.tab.tags?.length > 0 && (
              <span class="ml-2">
                {props.tab.tags.slice(0, 3).map((tag) => (
                  <button
                    class="text-sky-400 hover:text-sky-300 transition-colors cursor-pointer mr-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onTagClick?.(tag);
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </span>
            )}
          </div>
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
          <Show when={props.isTrash}>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onRestore?.(props.tab); }}
              title="Restore"
            >
              <Undo2 size={15} />
            </button>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onHardDelete?.(props.tab); }}
              title="Delete forever"
            >
              <Trash2 size={15} />
            </button>
          </Show>
          <Show when={!props.isTrash}>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onArchive(props.tab); }}
              title={props.tab.archived ? "Unarchive" : "Archive"}
            >
              {props.tab.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>
            <Show when={props.onBlockDomain}>
              <button
                class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => { e.stopPropagation(); props.onBlockDomain?.(props.tab); }}
                title="Block this domain"
              >
                <ShieldBan size={15} />
              </button>
            </Show>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onDelete(props.tab); }}
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
