import { Show, createMemo } from "solid-js";
import { Star, ExternalLink, Undo2, Trash2 } from "lucide-solid";
import type { Page } from "@/lib/types";
import { extractCreator, getDomain, getFaviconUrl } from "@/lib/domains";
import { formatTimeAgo } from "@/lib/format";
import Highlight from "./Highlight";
import Avatar from "./Avatar";
import TagList from "./TagList";

interface PageCardProps {
  page: Page;
  searchQuery?: string;
  onOpen: (page: Page) => void;
  onEditNotes: (page: Page) => void;
  onToggleStar: (page: Page) => void;
  onOpenSource?: (page: Page) => void;
  onRestore?: (page: Page) => void;
  onHardDelete?: (page: Page) => void;
  onSelectCreator?: (domain: string, creator: string) => void;
  onTagClick?: (tag: string) => void;
  isTrash?: boolean;
}

export default function PageCard(props: PageCardProps) {
  const domain = createMemo(() => getDomain(props.page.url) || props.page.url);

  const description = createMemo(() =>
    props.page.ogDescription || props.page.metaDescription || null
  );

  const creator = createMemo(() => extractCreator(props.page));

  const faviconSrc = createMemo(() => getFaviconUrl(props.page));

  const avatarSrc = createMemo(() => {
    if (props.page.creatorAvatar && creator()) return props.page.creatorAvatar;
    return faviconSrc();
  });

  const creatorUrl = createMemo(() => props.page.creatorUrl || null);

  const timeAgo = createMemo(() => {
    if (props.page.publishedAt) return formatTimeAgo(props.page.publishedAt);
    return formatTimeAgo(props.page.capturedAt);
  });

  return (
    <div
      class="cursor-pointer group"
      onClick={() => props.onOpen(props.page)}
    >
      {/* Thumbnail - 16:9 ratio */}
      <div class="aspect-video rounded-xl overflow-hidden bg-muted/40 mb-3 relative">
        {props.page.ogImage ? (
          <img
            src={props.page.ogImage}
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
        {/* Action buttons - left aligned */}
        <div class="absolute top-2 left-2 flex gap-1.5">
          <Show when={props.isTrash}>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onRestore?.(props.page); }}
              title="Restore"
            >
              <Undo2 size={16} />
            </button>
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-red-500/85 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); props.onHardDelete?.(props.page); }}
              title="Delete forever"
            >
              <Trash2 size={16} />
            </button>
          </Show>
          <Show when={!props.isTrash}>
            {/* Star - always visible when starred, visible on hover when not */}
            <button
              class={`p-2 rounded-lg transition-all ${
                props.page.starred
                  ? "text-yellow-400 drop-shadow-md group-hover:bg-black/70 group-hover:drop-shadow-none hover:!bg-sky-500/80"
                  : "text-foreground/90 bg-black/70 hover:bg-sky-500/80 opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => { e.stopPropagation(); props.onToggleStar(props.page); }}
              title={props.page.starred ? "Unstar" : "Star"}
            >
              <Star size={18} fill={props.page.starred ? "currentColor" : "none"} />
            </button>
          </Show>
        </div>
        {/* External link - right side */}
        <Show when={props.onOpenSource && !props.isTrash}>
          <div class="absolute top-2 right-2">
            <button
              class="p-2 rounded-lg text-foreground/90 bg-black/70 hover:bg-sky-500/80 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                props.onOpenSource?.(props.page);
              }}
              title="Open source URL"
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </Show>
      </div>

      {/* Info below thumbnail */}
      <div class="flex gap-3">
        <Avatar src={avatarSrc()} size="lg" class="mt-0.5" />
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary/80">
            <Show when={props.searchQuery} fallback={props.page.ogTitle || props.page.title}>
              <Highlight text={props.page.ogTitle || props.page.title} query={props.searchQuery!} />
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
          <TagList tags={props.page.tags || []} onTagClick={props.onTagClick} class="gap-y-0.5 mt-1.5 text-xs [&_button]:text-xs" />
        </div>
      </div>

      {/* Note */}
      <div class="mt-2 ml-9">
        <Show
          when={props.page.notes}
          fallback={
            <button
              class="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                props.onEditNotes(props.page);
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
              props.onEditNotes(props.page);
            }}
          >
            <p class="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {props.page.notes}
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}
