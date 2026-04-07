import { createSignal, createMemo, createEffect, Show, onMount, onCleanup } from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { formatTimestamp } from "./TranscriptView";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab, softDeleteTab } from "@/lib/db";
import { getPendingMigrations } from "@/lib/page-extract";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import MarkdownView from "./MarkdownView";
import DetailSidebar, { type TocEntry } from "./DetailSidebar";
import ChatFab from "./ChatFab";
import NotesEditor from "@/components/NotesEditor";
import ReadingProgress from "@/components/ReadingProgress";
import { X } from "lucide-solid";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[]>(
    props.tab.transcript || [],
  );
  const [markdownContent, setMarkdownContent] = createSignal<string>(
    props.tab.content || "",
  );
  const [fetchingContent, setFetchingContent] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);
  const [isNarrow, setIsNarrow] = createSignal(false);
  const [editingNotes, setEditingNotes] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [heroScrolledPast, setHeroScrolledPast] = createSignal(false);
  const [reExtracting, setReExtracting] = createSignal(false);
  const [migrationDismissed, setMigrationDismissed] = createSignal(false);
  const [updateSuccess, setUpdateSuccess] = createSignal(false);
  const [tocEntries, setTocEntries] = createSignal<TocEntry[]>([]);

  // Check for pending migrations
  const pendingMigrations = createMemo(() => getPendingMigrations(props.tab.contentVersion));

  const promptedActions = createMemo(() => {
    if (migrationDismissed()) return [];
    return pendingMigrations().flatMap((m) =>
      m.actions.filter((a: { behavior: string }) => a.behavior === "prompted"),
    );
  });

  const hasPromptedReExtract = createMemo(() =>
    promptedActions().some((a) => a.type === "re-extract-content"),
  );

  let containerRef: HTMLDivElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  let heroRef: HTMLDivElement | undefined;

  onMount(() => {
    // Auto-run silent migration actions
    const silentActions = pendingMigrations().flatMap((m) =>
      m.actions.filter((a) => a.behavior === "silent"),
    );
    if (silentActions.some((a) => a.type === "re-extract-content")) {
      handleReExtract();
    }

    if (!containerRef) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 768);
      }
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => resizeObserver.disconnect());

    // Listen for data changes from other views
    const handleMessage = async (message: any) => {
      if (message.type === "DATA_CHANGED") {
        const updated = await getTab(props.tab.id);
        if (updated) {
          setCurrentTab(updated);
          if (updated.transcript) {
            setTranscriptSegments(updated.transcript);
          }
          if (updated.content) {
            setMarkdownContent(updated.content);
          }
        }
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    onCleanup(() => browser.runtime.onMessage.removeListener(handleMessage));
  });

  // Extract TOC entries from rendered headings after content changes
  createEffect(() => {
    // Track these signals so effect re-runs when content changes
    markdownContent();
    transcriptSegments();

    requestAnimationFrame(() => {
      if (!scrollRef) return;
      const headings = scrollRef.querySelectorAll("h1[id], h2[id], h3[id]");
      const entries: TocEntry[] = [];
      for (const h of headings) {
        const level = parseInt(h.tagName[1]);
        if (level <= 3) {
          entries.push({ id: h.id, text: h.textContent || "", level });
        }
      }
      setTocEntries(entries);
    });
  });

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.tab.url));

  const hasContent = createMemo(() =>
    transcriptSegments().length > 0 || markdownContent().length > 0,
  );

  const readingTimeMin = createMemo(() => {
    const segments = transcriptSegments();
    const content = markdownContent();
    let totalWords = 0;

    if (segments.length > 0) {
      totalWords = segments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
    } else if (content) {
      totalWords = content.split(/\s+/).length;
    }

    return Math.max(1, Math.round(totalWords / 200));
  });

  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleBack = () => { window.close(); };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleOpenSource = () => { window.open(props.tab.url, "_blank"); };

  const handleArchive = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { archived: !tab.archived });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleDelete = async () => {
    await softDeleteTab(currentTab().id);
    notifyChanged();
    window.close();
  };

  const handleEditNotes = () => {
    setEditingNotes(true);
  };

  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    const updated = await getTab(tabId);
    if (updated) setCurrentTab(updated);
    setEditingNotes(false);
    notifyChanged();
  };

  const handleFetchContent = async () => {
    setFetchingContent(true);
    try {
      if (isYouTube()) {
        const response = await sendMessage({ type: "GET_TRANSCRIPT", tabId: props.tab.id });
        if (response.type === "TRANSCRIPT" && response.transcript) {
          setTranscriptSegments(response.transcript);
        }
      } else {
        const response = await sendMessage({ type: "GET_CONTENT", tabId: props.tab.id });
        if (response.type === "CONTENT" && response.content) {
          setMarkdownContent(response.content);
        }
      }
    } catch (e) {
      console.error("Failed to fetch content:", e);
    } finally {
      setFetchingContent(false);
    }
  };

  const handleCopy = () => {
    const segments = transcriptSegments();
    const content = markdownContent();

    if (segments.length > 0) {
      const text = segments.map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`).join("\n");
      navigator.clipboard.writeText(text);
    } else if (content) {
      navigator.clipboard.writeText(content);
    } else {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReExtract = async () => {
    setReExtracting(true);
    try {
      const response = await sendMessage({ type: "RE_EXTRACT_CONTENT", tabId: props.tab.id });
      if (response.type === "CONTENT" && response.content) {
        setMarkdownContent(response.content);
        setMigrationDismissed(true);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      } else if (response.type === "ERROR") {
        console.error("Re-extraction failed:", response.message);
      }
    } catch (e) {
      console.error("Re-extraction failed:", e);
    } finally {
      setReExtracting(false);
    }
  };

  const handleScroll = () => {
    if (!heroRef || !scrollRef) return;
    const heroBottom = heroRef.offsetTop + heroRef.offsetHeight;
    setHeroScrolledPast(scrollRef.scrollTop > heroBottom - 10);
  };

  const ContentView = () => (
    <>
      <Show when={isYouTube()}>
        <TranscriptView
          segments={transcriptSegments()}
          videoUrl={props.tab.url}
          onFetchTranscript={transcriptSegments().length === 0 ? handleFetchContent : undefined}
          loading={fetchingContent()}
        />
      </Show>
      <Show when={!isYouTube() && markdownContent()}>
        <MarkdownView content={markdownContent()} sourceUrl={props.tab.url} />
      </Show>
      <Show when={!isYouTube() && !markdownContent()}>
        <MarkdownView
          content=""
          sourceUrl={props.tab.url}
          onFetchContent={handleFetchContent}
          loading={fetchingContent()}
        />
      </Show>
    </>
  );

  return (
    <div ref={containerRef} class="@container flex h-screen bg-background relative">
      {/* Main content + sidebar */}
      <div class="flex-1 min-w-0 flex flex-col">
        {/* Fixed action bar */}
        <DetailHeader
          tab={currentTab()}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenSource={handleOpenSource}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onEditNotes={handleEditNotes}
          onCopy={hasContent() ? handleCopy : undefined}
          copied={copied()}
          compact={heroScrolledPast()}
        />

        {/* Scrollable area containing content + sticky sidebar */}
        <div
          ref={scrollRef}
          class="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          {/* Content + sidebar in a flex row */}
          <div class="flex max-w-[1000px] mx-auto">
            {/* Content column */}
            <div class="flex-1 min-w-0">
              {/* Hero card */}
              <div ref={heroRef}>
                <DetailHeader
                  tab={currentTab()}
                  onBack={handleBack}
                  onToggleStar={handleToggleStar}
                  onOpenSource={handleOpenSource}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onEditNotes={handleEditNotes}
                  heroOnly
                />
              </div>

              {/* Narrow: inline tags + notes */}
              <Show when={isNarrow()}>
                <div class="px-4 flex flex-col gap-2 mb-2">
                  <Show when={currentTab().tags && currentTab().tags.length > 0}>
                    <div class="flex flex-wrap gap-x-2 gap-y-1">
                      {currentTab().tags.map((tag) => (
                        <span class="text-sm text-sky-400">#{tag}</span>
                      ))}
                    </div>
                  </Show>
                  <Show when={currentTab().notes}>
                    <button
                      onClick={handleEditNotes}
                      class="text-left bg-muted/30 rounded-lg px-3 py-2 text-sm text-muted-foreground leading-relaxed hover:bg-muted/40 transition-colors line-clamp-2"
                    >
                      {currentTab().notes}
                    </button>
                  </Show>
                </div>
              </Show>

              {/* Reading progress */}
              <Show when={hasContent()}>
                <div class="sticky top-0 z-10 bg-background">
                  <ReadingProgress
                    scrollRef={scrollRef}
                    readingTimeMin={readingTimeMin()}
                  />
                </div>
              </Show>

              {/* Article / Transcript content */}
              <div class="px-4 pb-6">
                <ContentView />
              </div>
            </div>

            {/* Sidebar — sticky, hidden on narrow */}
            <Show when={!isNarrow()}>
              <DetailSidebar
                tab={currentTab()}
                tocEntries={tocEntries()}
                scrollRef={scrollRef}
                onEditNotes={handleEditNotes}
              />
            </Show>
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <ChatFab />

      {/* Notes editor */}
      <Show when={editingNotes()}>
        <NotesEditor
          tab={currentTab()}
          onSave={handleSaveNotes}
          onClose={() => setEditingNotes(false)}
        />
      </Show>

      {/* Update available toast */}
      <Show when={hasPromptedReExtract() && hasContent()}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#1e1e22]/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] whitespace-nowrap">
          <span class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reExtracting() ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]"}`} />
          <span class="text-sm text-foreground/70">
            {reExtracting() ? "Updating..." : "Content update available"}
          </span>
          <button
            onClick={handleReExtract}
            disabled={reExtracting()}
            class="text-sm font-medium text-emerald-400 hover:bg-emerald-400/10 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          >
            Update
          </button>
          <button
            onClick={() => setMigrationDismissed(true)}
            class="text-foreground/20 hover:text-foreground/40 transition-colors p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      </Show>

      {/* Success toast */}
      <Show when={updateSuccess()}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#1e1e22]/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] whitespace-nowrap animate-[fadeIn_0.2s_ease-out]">
          <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
          <span class="text-sm text-foreground/70">Content updated</span>
        </div>
      </Show>
    </div>
  );
}
