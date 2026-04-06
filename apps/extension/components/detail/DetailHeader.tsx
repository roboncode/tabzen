import { createMemo, Show, For } from "solid-js";
import { ArrowLeft, Star, ExternalLink, Archive, ArchiveRestore, Trash2, MessageCircle, StickyNote } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator, getFaviconUrl } from "@/lib/domains";
import { stripEmojis } from "@/lib/youtube";

interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onEditNotes: () => void;
  chatCollapsed: boolean;
  onToggleChat: () => void;
}

export default function DetailHeader(props: DetailHeaderProps) {
  const domain = createMemo(() => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  });

  const creator = createMemo(() => extractCreator(props.tab));
  const faviconSrc = createMemo(() => getFaviconUrl(props.tab));

  const avatarSrc = createMemo(() => {
    if (props.tab.creatorAvatar && creator()) return props.tab.creatorAvatar;
    return faviconSrc();
  });

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

  const description = createMemo(() => {
    const raw = props.tab.ogDescription || props.tab.metaDescription || null;
    return raw ? stripEmojis(raw) : null;
  });

  const tags = createMemo(() => props.tab.tags || []);

  const iconButton = "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors";

  return (
    <div class="@container">
      {/* Top bar — icon-only actions for clean layout */}
      <div class="flex items-center gap-1 px-4 py-2.5 bg-muted/30 flex-shrink-0">
        <button
          onClick={props.onBack}
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-auto"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <button onClick={props.onOpenSource} class={iconButton} title="Visit page">
          <ExternalLink size={16} />
        </button>
        <button
          onClick={props.onToggleStar}
          class={`p-2 rounded-lg transition-colors ${
            props.tab.starred
              ? "text-yellow-400 hover:bg-yellow-400/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          title={props.tab.starred ? "Unstar" : "Star"}
        >
          <Star size={16} fill={props.tab.starred ? "currentColor" : "none"} />
        </button>
        <button onClick={props.onArchive} class={iconButton} title={props.tab.archived ? "Unarchive" : "Archive"}>
          <Show when={props.tab.archived} fallback={<Archive size={16} />}>
            <ArchiveRestore size={16} />
          </Show>
        </button>
        <button
          onClick={props.onDelete}
          class="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
        <Show when={props.chatCollapsed}>
          <button onClick={props.onToggleChat} class={iconButton} title="Open chat">
            <MessageCircle size={16} />
          </button>
        </Show>
      </div>

      {/* Hero: Thumbnail + Info */}
      <div class="flex flex-col @[500px]:flex-row gap-4 px-4 @[500px]:px-6 py-4">
        {/* Thumbnail — stacks on top at narrow, side-by-side at wide */}
        <div class="w-full @[500px]:w-[200px] @[700px]:w-[280px] aspect-video rounded-xl overflow-hidden bg-muted/40 flex-shrink-0">
          {props.tab.ogImage ? (
            <img
              src={props.tab.ogImage}
              alt=""
              class="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center">
              {faviconSrc() ? (
                <img src={faviconSrc()} alt="" class="w-10 h-10 rounded" />
              ) : (
                <span class="text-muted-foreground text-sm">{domain()}</span>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div class="flex-1 min-w-0">
          <h1 class="text-base @[500px]:text-lg font-semibold text-foreground leading-snug">
            {props.tab.ogTitle || props.tab.title}
          </h1>

          {/* Creator — clickable */}
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <Show when={creator()}>
              <button
                class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  const url = props.tab.creatorUrl;
                  if (url) window.open(url, "_blank");
                }}
              >
                {avatarSrc() && (
                  <img src={avatarSrc()} alt="" class="w-5 h-5 rounded-full flex-shrink-0" />
                )}
                <span>{creator()}</span>
              </button>
            </Show>
            <Show when={!creator()}>
              <span class="text-sm text-muted-foreground">{domain()}</span>
            </Show>
          </div>

          {/* Timestamps */}
          <div class="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground/60 flex-wrap">
            <span>Saved {formatTimeAgo(props.tab.capturedAt)}</span>
            <Show when={props.tab.publishedAt}>
              <span class="text-muted-foreground/30">·</span>
              <span>Published {formatTimeAgo(props.tab.publishedAt!)}</span>
            </Show>
          </div>

          {/* Description */}
          {description() && (
            <p class="text-sm text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
              {description()}
            </p>
          )}

          {/* Tags */}
          <Show when={tags().length > 0}>
            <div class="flex flex-wrap gap-x-2 gap-y-1 mt-2.5">
              <For each={tags()}>
                {(tag) => (
                  <span class="text-sm text-sky-400 cursor-pointer hover:text-sky-300 transition-colors">
                    #{tag}
                  </span>
                )}
              </For>
            </div>
          </Show>

          {/* Notes */}
          <div class="mt-3">
            <Show
              when={props.tab.notes}
              fallback={
                <button
                  onClick={props.onEditNotes}
                  class="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <StickyNote size={14} />
                  <span>Add note</span>
                </button>
              }
            >
              <button
                onClick={props.onEditNotes}
                class="bg-muted/30 rounded-lg px-3 py-2 text-left hover:bg-muted/40 transition-colors w-full"
              >
                <p class="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {props.tab.notes}
                </p>
              </button>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
