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

  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 768);
      }
    });
    observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.tab.url));

  const handleBack = () => {
    window.close();
  };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleOpenSource = () => {
    window.open(props.tab.url, "_blank");
  };

  const handleArchive = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { archived: !tab.archived });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
  };

  const handleDelete = async () => {
    const tab = currentTab();
    await softDeleteTab(tab.id);
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
      const response = await sendMessage({
        type: "GET_TRANSCRIPT",
        tabId: props.tab.id,
      });
      if (response.type === "TRANSCRIPT" && response.transcript) {
        setTranscriptSegments(response.transcript);
      }
    } catch (e) {
      console.error("Failed to fetch transcript:", e);
    } finally {
      setFetchingTranscript(false);
    }
  };

  const tabs: { id: ContentTab; label: string }[] = [
    { id: "transcript", label: "Transcript" },
    { id: "summary", label: "Summary" },
    { id: "content", label: "Content" },
  ];

  return (
    <div ref={containerRef} class="flex h-screen bg-background relative">
      {/* Main content — always takes full width */}
      <div class="flex-1 min-w-0 flex flex-col">
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
        />

        {/* Pill tab bar */}
        <div class="flex gap-2 px-4 @[500px]:px-6 py-3 flex-shrink-0">
          {tabs.map((tab) => (
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

        {/* Tab content */}
        <div class="flex-1 overflow-hidden px-4 @[500px]:px-6 pb-6">
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
                  transcriptSegments().length === 0
                    ? handleFetchTranscript
                    : undefined
                }
                loading={fetchingTranscript()}
              />
            </Show>
          </Show>

          <Show when={activeTab() === "summary"}>
            <PlaceholderTab
              title="Summary"
              description="AI-generated summaries coming in a future update"
            />
          </Show>

          <Show when={activeTab() === "content"}>
            <PlaceholderTab
              title="Content"
              description="Web page content extraction coming in a future update"
            />
          </Show>
        </div>
      </div>

      {/* Chat panel — overlay at narrow, side-by-side at wide */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
        overlay={isNarrow()}
      />
    </div>
  );
}
