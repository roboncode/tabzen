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

  return (
    <div>
      {/* Top bar */}
      <div class="flex items-center gap-3 px-6 h-[53px] bg-muted/30 flex-shrink-0">
        <button
          onClick={props.onBack}
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div class="flex-1" />
        <div class="flex items-center gap-2">
          <button
            onClick={props.onToggleStar}
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              props.tab.starred
                ? "text-yellow-400 bg-yellow-400/10"
                : "text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
            }`}
          >
            <Star size={14} fill={props.tab.starred ? "currentColor" : "none"} />
            <span>{props.tab.starred ? "Starred" : "Star"}</span>
          </button>
          <button
            onClick={props.onOpenSource}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
          >
            <ExternalLink size={14} />
            <span>Visit Page</span>
          </button>
          <button
            onClick={props.onArchive}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
          >
            <Show when={props.tab.archived} fallback={<Archive size={14} />}>
              <ArchiveRestore size={14} />
            </Show>
            <span>{props.tab.archived ? "Unarchive" : "Archive"}</span>
          </button>
          <button
            onClick={props.onDelete}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 bg-muted/50 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
          <Show when={props.chatCollapsed}>
            <button
              onClick={props.onToggleChat}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
            >
              <MessageCircle size={14} />
              <span>Chat</span>
            </button>
          </Show>
        </div>
      </div>

      {/* Hero: Thumbnail + Title — responsive via @container */}
      <div class="@container">
        <div class="flex gap-5 px-6 py-5">
          <div class="w-[140px] h-[79px] @md:w-[200px] @md:h-[113px] @lg:w-[260px] @lg:h-[146px] rounded-xl overflow-hidden bg-muted/40 flex-shrink-0">
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
                  <img src={faviconSrc()} alt="" class="w-8 h-8 rounded" />
                ) : (
                  <span class="text-muted-foreground text-sm">{domain()}</span>
                )}
              </div>
            )}
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-base font-semibold text-foreground leading-snug">
              {props.tab.ogTitle || props.tab.title}
            </h1>
            <div class="flex items-center gap-2 mt-2">
              <Show when={props.tab.creatorUrl && creator()}>
                <button
                  class="flex items-center gap-2 hover:text-foreground transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = props.tab.creatorUrl;
                    if (url) {
                      window.open(url, "_blank");
                    }
                  }}
                >
                  {avatarSrc() && (
                    <img src={avatarSrc()} alt="" class="w-5 h-5 rounded-full flex-shrink-0" />
                  )}
                  <span class="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {creator()}
                  </span>
                </button>
              </Show>
              <Show when={!props.tab.creatorUrl || !creator()}>
                {avatarSrc() && (
                  <img src={avatarSrc()} alt="" class="w-5 h-5 rounded-full flex-shrink-0" />
                )}
                <span class="text-sm text-muted-foreground">
                  {creator() || domain()}
                </span>
              </Show>
              <span class="text-muted-foreground/40">·</span>
              <span class="text-sm text-muted-foreground">
                Saved {formatTimeAgo(props.tab.capturedAt)}
              </span>
              <Show when={props.tab.publishedAt}>
                <span class="text-muted-foreground/40">·</span>
                <span class="text-sm text-muted-foreground">
                  Published {formatTimeAgo(props.tab.publishedAt!)}
                </span>
              </Show>
            </div>
            {description() && (
              <p class="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {description()}
              </p>
            )}

            {/* Tags */}
            <Show when={tags().length > 0}>
              <div class="flex flex-wrap gap-2 mt-3">
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
                    class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <StickyNote size={14} />
                    <span>Add note</span>
                  </button>
                }
              >
                <button
                  onClick={props.onEditNotes}
                  class="text-sm text-muted-foreground hover:text-foreground transition-colors text-left leading-relaxed"
                >
                  <span class="flex items-center gap-1.5 mb-1 text-foreground/70">
                    <StickyNote size={14} />
                    Note
                  </span>
                  <span class="line-clamp-2">{props.tab.notes}</span>
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
