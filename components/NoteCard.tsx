import type { Tab } from "@/lib/types";
import { getFaviconUrl } from "@/lib/domains";

interface NoteCardProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function NoteCard(props: NoteCardProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  const faviconSrc = () => getFaviconUrl(props.tab);

  return (
    <div class="group">
      {/* Note content - primary */}
      <div
        class="bg-muted/30 rounded-xl p-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          props.onEditNotes(props.tab);
        }}
      >
        <p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {props.tab.notes}
        </p>
      </div>

      {/* Tab context - secondary, below the note */}
      <div
        class="flex items-center gap-2.5 mt-2.5 px-1 cursor-pointer"
        onClick={() => props.onOpen(props.tab)}
      >
        {faviconSrc() ? (
          <img src={faviconSrc()} alt="" class="w-5 h-5 rounded-full flex-shrink-0" />
        ) : (
          <div class="w-5 h-5 rounded-full bg-muted/50 flex-shrink-0" />
        )}
        <div class="flex-1 min-w-0">
          <p class="text-xs text-muted-foreground truncate hover:text-foreground transition-colors">
            {props.tab.ogTitle || props.tab.title}
          </p>
          <p class="text-xs text-muted-foreground/60 truncate">{domain()}</p>
        </div>
      </div>
    </div>
  );
}
