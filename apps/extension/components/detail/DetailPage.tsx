import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
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
import ChatPanel from "./ChatPanel";
import NotesEditor from "@/components/NotesEditor";
import ReadingProgress from "@/components/ReadingProgress";
import { RefreshCw } from "lucide-solid";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [chatCollapsed, setChatCollapsed] = createSignal(true);
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

  // Check for pending migrations
  const pendingActions = createMemo(() => {
    if (migrationDismissed()) return [];
    const migrations = getPendingMigrations(props.tab.contentVersion);
    // Collect all prompted actions
    return migrations.flatMap((m) =>
      m.actions.filter((a: { behavior: string }) => a.behavior === "prompted"),
    );
  });

  const hasReExtractAction = createMemo(() =>
    pendingActions().some((a) => a.type === "re-extract-content"),
  );

  let containerRef: HTMLDivElement | undefined;
  let scrollRef: HTMLDivElement | undefined;
  let heroRef: HTMLDivElement | undefined;

  onMount(() => {
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
      {/* YouTube: always use TranscriptView (it has its own empty/fetch state) */}
      <Show when={isYouTube()}>
        <TranscriptView
          segments={transcriptSegments()}
          videoUrl={props.tab.url}
          onFetchTranscript={transcriptSegments().length === 0 ? handleFetchContent : undefined}
          loading={fetchingContent()}
        />
      </Show>
      {/* Non-YouTube with content: render markdown */}
      <Show when={!isYouTube() && markdownContent()}>
        <MarkdownView content={markdownContent()} />
      </Show>
      {/* Non-YouTube without content: show extract button */}
      <Show when={!isYouTube() && !markdownContent()}>
        <MarkdownView
          content=""
          onFetchContent={handleFetchContent}
          loading={fetchingContent()}
        />
      </Show>
    </>
  );

  return (
    <div ref={containerRef} class="flex h-screen bg-background relative">
      {/* Main content */}
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
          chatCollapsed={chatCollapsed()}
          onToggleChat={() => setChatCollapsed(!chatCollapsed())}
          onCopy={hasContent() ? handleCopy : undefined}
          copied={copied()}
          compact={heroScrolledPast()}
        />

        {/* Scrollable area: hero + progress + content */}
        <div
          ref={scrollRef}
          class="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={handleScroll}
        >
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
              chatCollapsed={chatCollapsed()}
              onToggleChat={() => setChatCollapsed(!chatCollapsed())}
              heroOnly
            />
          </div>

          {/* Migration banner */}
          <Show when={hasReExtractAction() && hasContent()}>
            <div class="mx-4 mt-2 mb-1 flex items-center gap-3 rounded-lg bg-sky-500/10 px-4 py-2.5">
              <RefreshCw size={15} class={`text-sky-400 flex-shrink-0 ${reExtracting() ? "animate-spin" : ""}`} />
              <p class="text-sm text-sky-300/80 flex-1">
                Improved content extraction available
              </p>
              <button
                onClick={handleReExtract}
                disabled={reExtracting()}
                class="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50"
              >
                {reExtracting() ? "Updating..." : "Update"}
              </button>
              <button
                onClick={() => setMigrationDismissed(true)}
                class="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Dismiss
              </button>
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

          {/* Content */}
          <div class="px-4 pb-6 flex-1">
            <ContentView />
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
        overlay={isNarrow()}
      />

      {/* Notes editor */}
      <Show when={editingNotes()}>
        <NotesEditor
          tab={currentTab()}
          onSave={handleSaveNotes}
          onClose={() => setEditingNotes(false)}
        />
      </Show>
    </div>
  );
}
