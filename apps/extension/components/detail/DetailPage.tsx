import { createSignal, createMemo, Show } from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab } from "@/lib/db";
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
  const [chatCollapsed, setChatCollapsed] = createSignal(false);
  const [transcriptSegments, setTranscriptSegments] = createSignal<TranscriptSegment[]>(
    (props.tab as any).transcript || [],
  );
  const [fetchingTranscript, setFetchingTranscript] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);

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
    <div class="flex h-screen bg-background">
      {/* Left: Main content */}
      <div class="flex-1 min-w-0 flex flex-col relative">
        <DetailHeader
          tab={currentTab()}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenSource={handleOpenSource}
        />

        {/* Tab bar */}
        <div class="flex gap-0 px-6 border-b border-border flex-shrink-0">
          {tabs.map((tab) => (
            <button
              class={`px-4 py-2.5 text-sm transition-colors relative ${
                activeTab() === tab.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab() === tab.id && (
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-ring" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-hidden p-6">
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

      {/* Right: Chat panel */}
      <ChatPanel
        collapsed={chatCollapsed()}
        onToggle={() => setChatCollapsed(!chatCollapsed())}
      />
    </div>
  );
}
