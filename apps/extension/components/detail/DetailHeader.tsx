import { createMemo, createSignal, Show } from "solid-js";
import {
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  Copy,
  Check,
  Menu,
  Ellipsis,
} from "lucide-solid";
import type { Page } from "@/lib/types";
import { extractCreator, getDomain, getFaviconUrl } from "@/lib/domains";
import { formatTimeAgo } from "@/lib/format";
import { stripEmojis } from "@/lib/youtube";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";
import TagList from "@/components/TagList";

interface DetailHeaderProps {
  page: Page;
  onBack: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  copied?: boolean;
  /** Render only the hero card (no action bar) */
  heroOnly?: boolean;
  /** Show menu button for sidebar toggle on narrow screens */
  onMenuToggle?: () => void;
}

export default function DetailHeader(props: DetailHeaderProps) {
  const domain = createMemo(() => getDomain(props.page.url) || props.page.url);

  const creator = createMemo(() => extractCreator(props.page));
  const faviconSrc = createMemo(() => getFaviconUrl(props.page));

  const avatarSrc = createMemo(() => {
    if (props.page.creatorAvatar && creator()) return props.page.creatorAvatar;
    return faviconSrc();
  });

  const description = createMemo(() => {
    const raw = props.page.ogDescription || props.page.metaDescription || null;
    return raw ? stripEmojis(raw) : null;
  });

  const tags = createMemo(() => props.page.tags || []);
  const title = createMemo(() => props.page.ogTitle || props.page.title);

  const [descExpanded, setDescExpanded] = createSignal(false);
  const [descOverflows, setDescOverflows] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  let descRef: HTMLParagraphElement | undefined;

  // ── Hero Only mode: the scrollable card ──
  if (props.heroOnly) {
    return (
      <div class="@container px-4 pt-24 pb-6 md:pb-12">
        <div class="flex flex-col @[480px]:flex-row gap-4 @[480px]:gap-5">
          {/* Thumbnail — clickable, opens source URL */}
          <a
            href={props.page.url}
            target="_blank"
            class="w-full @[480px]:w-[40%] aspect-video rounded-xl overflow-hidden bg-muted/40 flex-shrink-0 max-h-[200px] cursor-pointer hover:opacity-90 transition-opacity"
          >
            {props.page.ogImage ? (
              <img
                src={props.page.ogImage}
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
          </a>

          {/* Info */}
          <div class="flex-1 min-w-0">
            <a
              href={props.page.url}
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
                    const url = props.page.creatorUrl;
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
              <span>Saved {formatTimeAgo(props.page.capturedAt)}</span>
              <Show when={props.page.publishedAt}>
                <span class="text-muted-foreground/30">·</span>
                <span>Published {formatTimeAgo(props.page.publishedAt!)}</span>
              </Show>
            </div>

            {/* Description */}
            {description() && (
              <div class="mt-2.5">
                <p
                  ref={(el) => {
                    descRef = el;
                    requestAnimationFrame(() => {
                      if (el) setDescOverflows(el.scrollHeight > el.clientHeight);
                    });
                  }}
                  class={`text-sm text-muted-foreground leading-relaxed ${descExpanded() ? "" : "line-clamp-2"}`}
                >
                  {description()}
                </p>
                <Show when={descOverflows() || descExpanded()}>
                  <button
                    onClick={() => setDescExpanded(!descExpanded())}
                    class="text-xs text-muted-foreground/50 hover:text-foreground transition-colors mt-1"
                  >
                    {descExpanded() ? "Show less" : "Show more"}
                  </button>
                </Show>
              </div>
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
    <div class="flex items-center gap-2 px-4 py-4 bg-background border-b-3 border-[#161618] flex-shrink-0 relative z-20">
      {/* Menu button — narrow screens only */}
      <Show when={props.onMenuToggle}>
        <IconButton
          onClick={() => props.onMenuToggle!()}
          title="Toggle sidebar"
        >
          <Menu size={16} />
        </IconButton>
      </Show>

      {/* Left: Star + Title */}
      <button
        class={`flex-shrink-0 p-1 rounded-md transition-colors ${
          props.page.starred
            ? "text-yellow-400 hover:text-yellow-300"
            : "text-muted-foreground/30 hover:text-yellow-400"
        }`}
        onClick={props.onToggleStar}
        title={props.page.starred ? "Unstar" : "Star"}
      >
        <Star size={16} fill={props.page.starred ? "currentColor" : "none"} />
      </button>

      <span class="text-sm font-medium text-foreground truncate flex-1 min-w-0">
        {title()}
      </span>

      {/* Right: Collections | separator | Kebab */}
      <div class="w-6 flex-shrink-0" />
      <button
        onClick={props.onBack}
        class="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
      >
        Collections
      </button>

      <div class="w-px h-5 bg-muted-foreground/20 flex-shrink-0 mx-2" />

      {/* Vertical kebab menu */}
      <div class="relative flex-shrink-0">
        <IconButton
          onClick={() => setMenuOpen(!menuOpen())}
          title="More actions"
        >
          <Ellipsis size={16} class="rotate-90" />
        </IconButton>

        <Show when={menuOpen()}>
          {/* Backdrop to close menu */}
          <div class="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />

          <div class="absolute right-0 top-full mt-1 z-40 bg-[#1e1e22] rounded-lg py-1 min-w-[180px] shadow-xl shadow-black/40">
            <Show when={props.onCopy}>
              <button
                class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => { props.onCopy?.(); setMenuOpen(false); }}
              >
                <Show when={props.copied} fallback={<Copy size={14} />}>
                  <Check size={14} class="text-green-400" />
                </Show>
                <span>{props.copied ? "Copied!" : "Copy content"}</span>
              </button>
            </Show>
            <button
              class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              onClick={() => { props.onArchive(); setMenuOpen(false); }}
            >
              <Show when={props.page.archived} fallback={<Archive size={14} />}>
                <ArchiveRestore size={14} />
              </Show>
              <span>{props.page.archived ? "Unarchive" : "Archive"}</span>
            </button>
            <button
              class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              onClick={() => { props.onDelete(); setMenuOpen(false); }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
