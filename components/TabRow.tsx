import { Eye, StickyNote } from "lucide-solid";
import type { Tab } from "@/lib/types";

interface TabRowProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function TabRow(props: TabRowProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  return (
    <div
      class="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer rounded-lg transition-colors"
      onClick={() => props.onOpen(props.tab)}
    >
      {props.tab.favicon ? (
        <img src={props.tab.favicon} alt="" class="w-5 h-5 rounded flex-shrink-0" />
      ) : (
        <div class="w-5 h-5 bg-muted/50 rounded flex-shrink-0" />
      )}
      <div class="flex-1 min-w-0">
        <div class="text-sm text-foreground truncate">{props.tab.title}</div>
        <div class="text-xs text-muted-foreground truncate">{domain()}</div>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        {props.tab.viewCount > 0 && (
          <span class="text-xs text-muted-foreground flex items-center gap-1">
            <Eye size={12} /> {props.tab.viewCount}
          </span>
        )}
        <button
          class={`${props.tab.notes ? "text-muted-foreground" : "text-muted-foreground/40"} hover:text-foreground`}
          onClick={(e) => {
            e.stopPropagation();
            props.onEditNotes(props.tab);
          }}
        >
          <StickyNote size={13} />
        </button>
      </div>
    </div>
  );
}
