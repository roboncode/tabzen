import { Show, createMemo } from "solid-js";
import { Eye, Star, ExternalLink, Undo2, Trash2 } from "lucide-solid";
import type { Page } from "@/lib/types";
import { getDomain, getFaviconUrl } from "@/lib/domains";
import Highlight from "./Highlight";
import TagList from "./TagList";

interface PageRowProps {
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

export default function PageRow(props: PageRowProps) {
  const domain = createMemo(() => getDomain(props.page.url) || props.page.url);

  const faviconSrc = createMemo(() => getFaviconUrl(props.page));

  return (
    <div class="group">
      <div
        class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer rounded-lg transition-colors"
        onClick={() => props.onOpen(props.page)}
      >
        <button
          class={`flex-shrink-0 transition-all ${
            props.page.starred
              ? "text-yellow-400"
              : "text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleStar(props.page);
          }}
        >
          <Star size={14} fill={props.page.starred ? "currentColor" : "none"} />
        </button>
        {faviconSrc() ? (
          <img src={faviconSrc()} alt="" class="w-5 h-5 rounded flex-shrink-0" />
        ) : (
          <div class="w-5 h-5 bg-muted/50 rounded flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <div class="text-sm text-foreground truncate">
            <Show when={props.searchQuery} fallback={props.page.title}>
              <Highlight text={props.page.title} query={props.searchQuery!} />
            </Show>
          </div>
          <div class="text-xs text-muted-foreground truncate">
            {domain()}
            {props.page.tags?.length > 0 && (
              <span class="ml-2">
                <TagList tags={props.page.tags.slice(0, 3)} onTagClick={props.onTagClick} class="inline-flex gap-x-1.5 [&_button]:text-xs" />
              </span>
            )}
          </div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          {props.page.viewCount > 0 && (
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <Eye size={12} /> {props.page.viewCount}
            </span>
          )}
          <Show
            when={props.page.notes}
            fallback={
              <button
                class="text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onEditNotes(props.page);
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
                props.onEditNotes(props.page);
              }}
              title={props.page.notes!}
            >
              {props.page.notes}
            </button>
          </Show>
          <Show when={props.isTrash}>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onRestore?.(props.page); }}
              title="Restore"
            >
              <Undo2 size={15} />
            </button>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onHardDelete?.(props.page); }}
              title="Delete forever"
            >
              <Trash2 size={15} />
            </button>
          </Show>
          <Show when={!props.isTrash && props.onOpenSource}>
            <button
              class="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
              onClick={(e) => { e.stopPropagation(); props.onOpenSource?.(props.page); }}
              title="Open source URL"
            >
              <ExternalLink size={15} />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
