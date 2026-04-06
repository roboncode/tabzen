import { createMemo } from "solid-js";
import { ArrowLeft, Star, ExternalLink } from "lucide-solid";
import type { Tab } from "@/lib/types";
import { extractCreator, getFaviconUrl } from "@/lib/domains";

interface DetailHeaderProps {
  tab: Tab;
  onBack: () => void;
  onToggleStar: () => void;
  onOpenSource: () => void;
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

  const description = createMemo(
    () => props.tab.ogDescription || props.tab.metaDescription || null,
  );

  return (
    <div>
      {/* Top bar */}
      <div class="flex items-center gap-3 px-6 py-3 border-b border-border">
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
            <span>Open source</span>
          </button>
        </div>
      </div>

      {/* Hero: Thumbnail + Title */}
      <div class="flex gap-5 px-6 py-5">
        <div class="w-[180px] h-[101px] rounded-xl overflow-hidden bg-muted/40 flex-shrink-0">
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
            {avatarSrc() && (
              <img src={avatarSrc()} alt="" class="w-5 h-5 rounded-full flex-shrink-0" />
            )}
            <span class="text-sm text-muted-foreground">
              {creator() || domain()}
            </span>
            <span class="text-muted-foreground/40">·</span>
            <span class="text-sm text-muted-foreground">
              {formatTimeAgo(props.tab.publishedAt || props.tab.capturedAt)}
            </span>
          </div>
          {description() && (
            <p class="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
              {description()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
