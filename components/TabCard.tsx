import { Eye, StickyNote } from "lucide-solid";
import type { Tab } from "@/lib/types";

interface TabCardProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
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

  return (
    <div
      class="cursor-pointer group"
      onClick={() => props.onOpen(props.tab)}
    >
      {/* Thumbnail - 16:9 ratio like YouTube */}
      <div class="aspect-video rounded-xl overflow-hidden bg-muted/40 mb-3">
        {props.tab.ogImage ? (
          <img
            src={props.tab.ogImage}
            alt=""
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
      </div>

      {/* Info below thumbnail - YouTube style */}
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
            {props.tab.ogTitle || props.tab.title}
          </h3>
          <p class="text-xs text-muted-foreground mt-1">{domain()}</p>
          {description() && (
            <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {description()}
            </p>
          )}
          <div class="flex items-center gap-3 mt-1.5">
            {props.tab.viewCount > 0 && (
              <span class="text-xs text-muted-foreground flex items-center gap-1">
                <Eye size={12} /> {props.tab.viewCount}
              </span>
            )}
            <span class="text-xs text-muted-foreground">
              {props.tab.sourceLabel}
            </span>
            <button
              class={`ml-auto ${props.tab.notes ? "text-muted-foreground" : "text-muted-foreground/40"} hover:text-foreground`}
              onClick={(e) => {
                e.stopPropagation();
                props.onEditNotes(props.tab);
              }}
              title={props.tab.notes ? "Edit notes" : "Add notes"}
            >
              <StickyNote size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
