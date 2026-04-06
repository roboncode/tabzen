import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab, softDeleteTab } from "@/lib/db";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import ChatPanel from "./ChatPanel";
import PlaceholderTab from "./PlaceholderTab";

type ContentTab = "transcript" | "summary" | "content";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [activeTab, setActiveTab] = createSignal<ContentTab>("transcript");
  const [chatCollapsed, setChatCollapsed] = createSignal(true);
  const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[]>(
    (props.tab as any).transcript || [],
  );
  const [fetchingTranscript, setFetchingTranscript] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);
  const [isNarrow, setIsNarrow] = createSignal(false);
  const [heroScrolledPast, setHeroScrolledPast] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;
  let heroRef: HTMLDivElement | undefined;
  let scrollRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;

    // Detect narrow width
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 768);
      }
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => resizeObserver.disconnect());
  });

  const handleScroll = () => {
    if (!heroRef || !scrollRef) return;
    const heroBottom = heroRef.offsetTop + heroRef.offsetHeight;
    setHeroScrolledPast(scrollRef.scrollTop > heroBottom - 10);
  };

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.tab.url));

  const handleBack = () => { window.close(); };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleOpenSource = () => { window.open(props.tab.url, "_blank"); };

  const handleArchive = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { archived: !tab.archived });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleDelete = async () => {
    await softDeleteTab(currentTab().id);
    window.close();
  };

  const handleEditNotes = async () => {
    const tab = currentTab();
    const note = prompt("Edit note:", tab.notes || "");
    if (note !== null) {
      await updateTab(tab.id, { notes: note || null });
      const updated = await getTab(tab.id);
      if (updated) setCurrentTab(updated);
    }
  };

  const handleFetchTranscript = async () => {
    setFetchingTranscript(true);
    try {
      const response = await sendMessage({ type: "GET_TRANSCRIPT", tabId: props.tab.id });
      if (response.type === "TRANSCRIPT" && response.transcript) {
        setTranscriptSegments(response.transcript);
      }
    } catch (e) {
      console.error("Failed to fetch transcript:", e);
    } finally {
      setFetchingTranscript(false);
    }
  };

  const contentTabs: { id: ContentTab; label: string }[] = [
    { id: "transcript", label: "Transcript" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
  ];

  const PillTabs = () => (
    <div class="flex gap-2">
      {contentTabs.map((tab) => (
        <button
          class={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap outline-none ${
            activeTab() === tab.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const TabContent = () => (
    <>
      <Show when={activeTab() === "transcript"}>
        <Show
          when={isYouTube()}
          fallback={
            <PlaceholderTab
              title="Transcript not available"
              description="Transcripts are available for YouTube videos"
            />
          }
        >
          <TranscriptView
            segments={transcriptSegments()}
            videoUrl={props.tab.url}
            onFetchTranscript={
              transcriptSegments().length === 0 ? handleFetchTranscript : undefined
            }
            loading={fetchingTranscript()}
          />
        </Show>
      </Show>
      <Show when={activeTab() === "summary"}>
        <PlaceholderTab title="Summary" description="AI-generated summaries coming in a future update" />
      </Show>
      <Show when={activeTab() === "content"}>
        <PlaceholderTab title="Content" description="Web page content extraction coming in a future update" />
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
          compact={heroScrolledPast()}
          isNarrow={isNarrow()}
        />

        {/* Sticky compact header + tabs (visible when hero scrolled past) */}
        <Show when={heroScrolledPast()}>
          <div class="px-4 py-2 flex-shrink-0">
            <PillTabs />
          </div>
        </Show>

        {/* Scrollable area: hero + tabs + content */}
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
              isNarrow={isNarrow()}
            />
          </div>

          {/* Tabs (scroll with content, replaced by sticky when scrolled past) */}
          <Show when={!heroScrolledPast()}>
            <div class="px-4 py-3">
              <PillTabs />
            </div>
          </Show>

          {/* Tab content */}
          <div class="px-4 pb-6 flex-1">
            <TabContent />
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
        overlay={isNarrow()}
      />
    </div>
  );
}
