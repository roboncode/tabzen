import { Show } from "solid-js";
import { Star, Archive, ArchiveRestore, Trash2, ShieldBan, Undo2 } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator } from "@/lib/domains";
import Highlight from "./Highlight";

interface TabCardProps {
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
  isTrash?: boolean;
}

export default function TabCard(props: TabCardProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  const description = () =>
    props.tab.ogDescription || props.tab.metaDescription || null;

  const creator = () => extractCreator(props.tab);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  const timeAgo = () => {
    if (props.tab.publishedAt) return formatTimeAgo(props.tab.publishedAt);
    return formatTimeAgo(props.tab.capturedAt);
  };

  return (
    <div
      class="cursor-pointer group"
      onClick={() => props.onOpen(props.tab)}
    >
      {/* Thumbnail - 16:9 ratio */}
      <div class="aspect-video rounded-xl overflow-hidden bg-muted/40 mb-3 relative">
        {props.tab.ogImage ? (
          <img
            src={props.tab.ogImage}
            alt=""
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div class="w-full h-full flex items-center justify-center">
            {props.tab.favicon ? (
              <img src={props.tab.favicon} alt="" class="w-8 h-8 rounded" />
            ) : (
              <span class="text-muted-foreground text-sm">{domain()}</span>
            )}
          </div>
        )}
        {/* Action buttons overlay */}
        <div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Show when={props.isTrash}>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-black/85 transition-colors"
              onClick={(e) => { e.stopPropagation(); props.onRestore?.(props.tab); }}
              title="Restore"
            >
              <Undo2 size={16} />
            </button>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-red-500/85 transition-colors"
              onClick={(e) => { e.stopPropagation(); props.onHardDelete?.(props.tab); }}
              title="Delete forever"
            >
              <Trash2 size={16} />
            </button>
          </Show>
          <Show when={!props.isTrash}>
            <button
              class={`p-2 rounded-lg transition-colors ${
                props.tab.starred
                  ? "text-yellow-400 bg-black/40"
                  : "text-foreground/90 bg-black/70 hover:bg-black/85"
              }`}
              onClick={(e) => { e.stopPropagation(); props.onToggleStar(props.tab); }}
              title={props.tab.starred ? "Unstar" : "Star"}
            >
              <Star size={16} fill={props.tab.starred ? "currentColor" : "none"} />
            </button>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-black/85 transition-colors"
              onClick={(e) => { e.stopPropagation(); props.onArchive(props.tab); }}
              title={props.tab.archived ? "Unarchive" : "Archive"}
            >
              {props.tab.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </button>
            <Show when={props.onBlockDomain}>
              <button
                class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-black/85 transition-colors"
                onClick={(e) => { e.stopPropagation(); props.onBlockDomain?.(props.tab); }}
                title="Block this domain"
              >
                <ShieldBan size={16} />
              </button>
            </Show>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-red-500/85 transition-colors"
              onClick={(e) => { e.stopPropagation(); props.onDelete(props.tab); }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </Show>
        </div>
        {/* Starred indicator - always visible when starred */}
        <Show when={props.tab.starred}>
          <div class="absolute top-2 left-2 text-yellow-400 group-hover:opacity-0 transition-opacity drop-shadow-md">
            <Star size={22} fill="currentColor" />
          </div>
        </Show>
      </div>

      {/* Info below thumbnail */}
      <div class="flex gap-3">
        {props.tab.favicon ? (
          <img
            src={props.tab.favicon}
            alt=""
            class="w-6 h-6 rounded-full mt-0.5 flex-shrink-0"
          />
        ) : (
          <div class="w-6 h-6 rounded-full bg-muted/50 mt-0.5 flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary/80">
            <Show when={props.searchQuery} fallback={props.tab.ogTitle || props.tab.title}>
              <Highlight text={props.tab.ogTitle || props.tab.title} query={props.searchQuery!} />
            </Show>
          </h3>
          <Show
            when={creator()}
            fallback={<p class="text-xs text-muted-foreground mt-1">{domain()}</p>}
          >
            <p class="text-xs text-muted-foreground mt-1">
              <button
                class="hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSelectCreator?.(domain(), creator()!);
                }}
              >
                {creator()}
              </button>
            </p>
          </Show>
          {description() && (
            <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {description()}
            </p>
          )}
          <div class="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground/60">
            <span>{timeAgo()}</span>
            <span>·</span>
            <span>{domain()}</span>
          </div>
        </div>
      </div>

      {/* Note */}
      <div class="mt-2 ml-9">
        <Show
          when={props.tab.notes}
          fallback={
            <button
              class="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                props.onEditNotes(props.tab);
              }}
            >
              + Add note
            </button>
          }
        >
          <div
            class="bg-muted/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              props.onEditNotes(props.tab);
            }}
          >
            <p class="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {props.tab.notes}
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}
