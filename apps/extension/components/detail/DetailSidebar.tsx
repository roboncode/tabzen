import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import type { Page } from "@/lib/types";
import NotesDisplay from "@/components/NotesDisplay";

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

interface DetailSidebarProps {
  page: Page;
  tocEntries: TocEntry[];
  scrollRef: HTMLElement | undefined;
  onSaveNotes: (pageId: string, notes: string) => void;
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
    const content = props.page.content || "";
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
        const sourceDomain = new URL(props.page.url).hostname;
        if (linkDomain === sourceDomain) continue;
      } catch {}
      if (seen.has(href)) continue;
      seen.add(href);
      links.push({ text, href });
    }
    return links.slice(0, 8);
  };

  return (
    <div class="pl-4 pr-4 pt-20 pb-8 border-l border-muted-foreground/5">
      {/* Table of Contents */}
      <Show when={props.tocEntries.length > 0}>
        <div class="mb-5">
          <div class="text-xs font-semibold text-foreground/90 mb-3">
            On this page
          </div>
          <div class="relative">
            <For each={props.tocEntries}>
              {(entry) => (
                <button
                  onClick={() => handleTocClick(entry.id)}
                  class={`relative block w-full text-left text-xs py-1 transition-colors ${
                    entry.level >= 3 ? "pl-3" : ""
                  } ${
                    activeId() === entry.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
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
        <div class="text-xs font-semibold text-foreground/90 mb-3">
          Notes
        </div>
        <NotesDisplay
          tab={props.page}
          onSave={props.onSaveNotes}
          clampLines={3}
        />
      </div>

      {/* Tags */}
      <Show when={props.page.tags && props.page.tags.length > 0}>
        <div class="mb-5">
          <div class="text-xs font-semibold text-foreground/90 mb-3">
            Tags
          </div>
          <div class="flex flex-wrap gap-x-2 gap-y-1">
            <For each={props.page.tags}>
              {(tag) => (
                <span class="text-xs text-sky-400 cursor-pointer hover:opacity-70 transition-opacity">
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
          <div class="text-xs font-semibold text-foreground/90 mb-3">
            Links
          </div>
          <For each={externalLinks()}>
            {(link) => (
              <a
                href={link.href}
                target="_blank"
                class="block text-xs text-sky-400 py-0.5 hover:opacity-70 transition-opacity truncate"
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
