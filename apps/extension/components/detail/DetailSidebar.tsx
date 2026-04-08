import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { StickyNote } from "lucide-solid";
import type { Tab } from "@/lib/types";

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

interface DetailSidebarProps {
  tab: Tab;
  tocEntries: TocEntry[];
  scrollRef: HTMLElement | undefined;
  onEditNotes: () => void;
}

export default function DetailSidebar(props: DetailSidebarProps) {
  const [activeId, setActiveId] = createSignal<string>("");

  // Track which heading is in view using IntersectionObserver
  createEffect(() => {
    const entries = props.tocEntries;
    const scrollEl = props.scrollRef;
    if (entries.length === 0 || !scrollEl) return;

    const headingEls = entries
      .map((e) => scrollEl.querySelector(`#${CSS.escape(e.id)}`))
      .filter(Boolean) as Element[];

    if (headingEls.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        root: scrollEl,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      },
    );

    for (const el of headingEls) observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  const handleTocClick = (id: string) => {
    const el = props.scrollRef?.querySelector(`#${CSS.escape(id)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Extract external links from markdown content
  const externalLinks = () => {
    const content = props.tab.content || "";
    const links: { text: string; href: string }[] = [];
    const seen = new Set<string>();
    // Match [text](url) but not ![image](url)
    const regex = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const text = match[1];
      const href = match[2];
      // Skip image URLs
      if (/\.(png|jpe?g|gif|svg|webp|ico|bmp)(\?|$)/i.test(href)) continue;
      // Skip links to the same domain as the source
      try {
        const linkDomain = new URL(href).hostname;
        const sourceDomain = new URL(props.tab.url).hostname;
        if (linkDomain === sourceDomain) continue;
      } catch {}
      if (seen.has(href)) continue;
      seen.add(href);
      links.push({ text, href });
    }
    return links.slice(0, 8); // Cap at 8 links
  };

  return (
    <div class="w-[256px] flex-shrink-0 pl-4 pr-4 py-4 sticky top-0 self-start overflow-y-auto scrollbar-hide border-l border-muted-foreground/10" style={{ "max-height": "calc(100vh - 42px)" }}>
      {/* Table of Contents */}
      <Show when={props.tocEntries.length > 0}>
        <div class="mb-5">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            On this page
          </div>
          <div class="relative">
            <For each={props.tocEntries}>
              {(entry) => (
                <button
                  onClick={() => handleTocClick(entry.id)}
                  class={`relative block w-full text-left text-sm py-1 transition-colors ${
                    entry.level >= 3 ? "pl-3" : ""
                  } ${
                    activeId() === entry.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {/* Active indicator bar */}
                  <Show when={activeId() === entry.id}>
                    <div class="absolute left-[-17px] top-1 bottom-1 w-[2px] bg-sky-400 rounded-full" />
                  </Show>
                  {entry.text}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Notes */}
      <div class="mb-5">
        <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Notes
        </div>
        <Show
          when={props.tab.notes}
          fallback={
            <button
              onClick={props.onEditNotes}
              class="flex items-center gap-1.5 text-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <StickyNote size={13} />
              <span>Add a note...</span>
            </button>
          }
        >
          <button
            onClick={props.onEditNotes}
            class="w-full text-left bg-muted/30 rounded-lg px-3 py-2.5 text-sm text-muted-foreground leading-relaxed hover:bg-muted/40 transition-colors line-clamp-4"
          >
            {props.tab.notes}
          </button>
        </Show>
      </div>

      {/* Tags */}
      <Show when={props.tab.tags && props.tab.tags.length > 0}>
        <div class="mb-5">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Tags
          </div>
          <div class="flex flex-wrap gap-x-2 gap-y-1">
            <For each={props.tab.tags}>
              {(tag) => (
                <span class="text-sm text-sky-400 cursor-pointer hover:opacity-70 transition-opacity">
                  #{tag}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* External Links */}
      <Show when={externalLinks().length > 0}>
        <div class="mb-5">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Links
          </div>
          <For each={externalLinks()}>
            {(link) => (
              <a
                href={link.href}
                target="_blank"
                class="block text-sm text-sky-400 py-0.5 hover:opacity-70 transition-opacity truncate"
              >
                {link.text}
              </a>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
