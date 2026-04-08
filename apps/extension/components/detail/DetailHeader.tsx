import { createMemo, Show } from "solid-js";
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Trash2,
  Copy,
  Check,
} from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator, getDomain, getFaviconUrl } from "@/lib/domains";
import { formatTimeAgo } from "@/lib/format";
import { stripEmojis } from "@/lib/youtube";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";
import TagList from "@/components/TagList";

interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  copied?: boolean;
  /** Render only the hero card (no action bar) */
  heroOnly?: boolean;
  /** Show compact title + thumbnail in the action bar */
  compact?: boolean;
}

export default function DetailHeader(props: DetailHeaderProps) {
  const domain = createMemo(() => getDomain(props.tab.url) || props.tab.url);

  const creator = createMemo(() => extractCreator(props.tab));
  const faviconSrc = createMemo(() => getFaviconUrl(props.tab));

  const avatarSrc = createMemo(() => {
    if (props.tab.creatorAvatar && creator()) return props.tab.creatorAvatar;
    return faviconSrc();
  });

  const description = createMemo(() => {
    const raw = props.tab.ogDescription || props.tab.metaDescription || null;
    return raw ? stripEmojis(raw) : null;
  });

  const tags = createMemo(() => props.tab.tags || []);
  const title = createMemo(() => props.tab.ogTitle || props.tab.title);

  // ── Hero Only mode: the scrollable card ──
  if (props.heroOnly) {
    return (
      <div class="@container px-4 pt-24 pb-6 md:pb-12">
        {/*
          Container query breakpoints:
          < 480px: stacked (thumbnail on top, info below) — like a card
          >= 480px: side-by-side (thumbnail left, info right)
          >= 700px: larger thumbnail
        */}
        <div class="flex flex-col @[480px]:flex-row gap-4 @[480px]:gap-5">
          {/* Thumbnail — full width when stacked, fixed width when side-by-side */}
          <div class="w-full @[480px]:w-[40%] aspect-video rounded-xl overflow-hidden bg-muted/40 flex-shrink-0 max-h-[200px]">
            {props.tab.ogImage ? (
              <img
                src={props.tab.ogImage}
                alt=""
                class="w-full h-full object-cover object-top-left"
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
            <a
              href={props.tab.url}
              target="_blank"
              class="text-xl @[480px]:text-2xl font-bold text-foreground leading-snug hover:text-sky-400 transition-colors cursor-pointer"
            >
              {title()}
            </a>

            {/* Creator — clickable */}
            <div class="flex items-center gap-2 mt-2">
              <Show when={creator()}>
                <button
                  class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    const url = props.tab.creatorUrl;
                    if (url) window.open(url, "_blank");
                  }}
                >
                  {avatarSrc() && <Avatar src={avatarSrc()} size="md" />}
                  <span>{creator()}</span>
                </button>
              </Show>
              <Show when={!creator()}>
                <a
                  href={`https://${domain()}`}
                  target="_blank"
                  class="text-sm text-muted-foreground hover:text-sky-400 transition-colors cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {domain()}
                </a>
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
            <TagList tags={tags()} class="mt-2.5" />
          </div>
        </div>
      </div>
    );
  }

  // ── Action bar mode (default) ──
  return (
    <div class="flex items-center gap-1 px-4 py-2.5 bg-muted/30 flex-shrink-0 relative z-20">
      <button
        onClick={props.onBack}
        class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* Compact title — visible when hero scrolled past */}
      <Show when={props.compact}>
        <div class="flex items-center gap-2.5 ml-3 flex-1 min-w-0">
          {props.tab.ogImage && (
            <img
              src={props.tab.ogImage}
              alt=""
              class="w-7 h-7 rounded object-cover flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span class="text-sm font-medium text-foreground truncate">
            {title()}
          </span>
        </div>
      </Show>
      <Show when={!props.compact}>
        <div class="flex-1" />
      </Show>

      <div class="flex items-center gap-0.5 ml-auto">
        <IconButton
          onClick={() => props.onCopy?.()}
          class={`${props.onCopy ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity`}
          title="Copy transcript"
        >
          <Show when={props.copied} fallback={<Copy size={16} />}>
            <Check size={16} class="text-green-400" />
          </Show>
        </IconButton>
        <div
          class={`w-px h-4 mx-1.5 transition-opacity ${props.onCopy ? "bg-muted-foreground/30" : "bg-transparent"}`}
        />
        <IconButton onClick={props.onOpenSource} title="Visit page">
          <ExternalLink size={16} />
        </IconButton>
        <IconButton
          onClick={props.onToggleStar}
          active={props.tab.starred}
          title={props.tab.starred ? "Unstar" : "Star"}
        >
          <Star size={16} fill={props.tab.starred ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          onClick={props.onArchive}
          title={props.tab.archived ? "Unarchive" : "Archive"}
        >
          <Show when={props.tab.archived} fallback={<Archive size={16} />}>
            <ArchiveRestore size={16} />
          </Show>
        </IconButton>
        <IconButton
          onClick={props.onDelete}
          variant="destructive"
          title="Delete"
        >
          <Trash2 size={16} />
        </IconButton>
      </div>
    </div>
  );
}
