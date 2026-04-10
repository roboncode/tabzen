import { createMemo } from "solid-js";
import type { Page } from "@/lib/types";
import { getDomain, getFaviconUrl } from "@/lib/domains";
import Avatar from "./Avatar";

interface NoteCardProps {
  page: Page;
  onOpen: (page: Page) => void;
  onEditNotes: (page: Page) => void;
}

export default function NoteCard(props: NoteCardProps) {
  const domain = createMemo(() => getDomain(props.page.url) || props.page.url);

  const faviconSrc = createMemo(() => getFaviconUrl(props.page));

  return (
    <div class="group">
      {/* Note content - primary */}
      <div
        class="bg-muted/30 rounded-xl p-4 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          props.onEditNotes(props.page);
        }}
      >
        <p class="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {props.page.notes}
        </p>
      </div>

      {/* Page context - secondary, below the note */}
      <div
        class="flex items-center gap-2.5 mt-2.5 px-1 cursor-pointer"
        onClick={() => props.onOpen(props.page)}
      >
        <Avatar src={faviconSrc()} size="md" />
        <div class="flex-1 min-w-0">
          <p class="text-xs text-muted-foreground truncate hover:text-foreground transition-colors">
            {props.page.ogTitle || props.page.title}
          </p>
          <p class="text-xs text-muted-foreground/60 truncate">{domain()}</p>
        </div>
      </div>
    </div>
  );
}
