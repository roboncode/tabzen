import { Show, createMemo } from "solid-js";
import { Star, Archive, ArchiveRestore, Trash2, ShieldBan, Undo2, Maximize2 } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator, getDomain, getFaviconUrl } from "@/lib/domains";
import { formatTimeAgo } from "@/lib/format";
import Highlight from "./Highlight";
import Avatar from "./Avatar";
import TagList from "./TagList";

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
  onTagClick?: (tag: string) => void;
  onExpand?: (tab: Tab) => void;
  isTrash?: boolean;
}

export default function TabCard(props: TabCardProps) {
  const domain = createMemo(() => getDomain(props.tab.url) || props.tab.url);

  const description = createMemo(() =>
    props.tab.ogDescription || props.tab.metaDescription || null
  );

  const creator = createMemo(() => extractCreator(props.tab));

  const faviconSrc = createMemo(() => getFaviconUrl(props.tab));

  const avatarSrc = createMemo(() => {
    if (props.tab.creatorAvatar && creator()) return props.tab.creatorAvatar;
    return faviconSrc();
  });

  const creatorUrl = createMemo(() => props.tab.creatorUrl || null);

  const timeAgo = createMemo(() => {
    if (props.tab.publishedAt) return formatTimeAgo(props.tab.publishedAt);
    return formatTimeAgo(props.tab.capturedAt);
  });

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
            {faviconSrc() ? (
              <img src={faviconSrc()} alt="" class="w-8 h-8 rounded" />
            ) : (
              <span class="text-muted-foreground text-sm">{domain()}</span>
            )}
          </div>
        )}
        {/* Action buttons - left aligned, star always anchored */}
        <div class="absolute top-2 left-2 flex gap-1.5">
          <Show when={props.isTrash}>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onRestore?.(props.tab); }}
              title="Restore"
            >
              <Undo2 size={16} />
            </button>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-red-500/85 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onHardDelete?.(props.tab); }}
              title="Delete forever"
            >
              <Trash2 size={16} />
            </button>
          </Show>
          <Show when={!props.isTrash}>
            {/* Star - always visible when starred, visible on hover when not */}
            <button
              class={`p-2 rounded-lg transition-all ${
                props.tab.starred
                  ? "text-yellow-400 drop-shadow-md group-hover:bg-black/70 group-hover:drop-shadow-none hover:!bg-sky-500/80"
                  : "text-foreground/90 bg-black/70 hover:bg-sky-500/80 opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => { e.stopPropagation(); props.onToggleStar(props.tab); }}
              title={props.tab.starred ? "Unstar" : "Star"}
            >
              <Star size={18} fill={props.tab.starred ? "currentColor" : "none"} />
            </button>
            {/* Other actions - only on hover */}
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onArchive(props.tab); }}
              title={props.tab.archived ? "Unarchive" : "Archive"}
            >
              {props.tab.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </button>
            <Show when={props.onBlockDomain}>
              <button
                class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); props.onBlockDomain?.(props.tab); }}
                title="Block this domain"
              >
                <ShieldBan size={16} />
              </button>
            </Show>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-red-500/85 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onDelete(props.tab); }}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </Show>
        </div>
        {/* Expand button - right side */}
        <Show when={props.onExpand && !props.isTrash}>
          <div class="absolute top-2 right-2">
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                props.onExpand?.(props.tab);
              }}
              title="Open detail page"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </Show>
      </div>

      {/* Info below thumbnail */}
      <div class="flex gap-3">
        <Avatar src={avatarSrc()} size="lg" class="mt-0.5" />
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
                class="hover:text-foreground transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = creatorUrl();
                  if (url) {
                    window.open(url, "_blank");
                  } else {
                    props.onSelectCreator?.(domain(), creator()!);
                  }
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
          {/* Tags */}
          <TagList tags={props.tab.tags || []} onTagClick={props.onTagClick} class="gap-y-0.5 mt-1.5 text-xs [&_button]:text-xs" />
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
