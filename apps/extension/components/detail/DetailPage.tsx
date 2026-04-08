import {
  createSignal,
  createMemo,
  createEffect,
  Show,
  For,
  onMount,
  onCleanup,
} from "solid-js";
import type { Tab } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { formatTimestamp } from "./TranscriptView";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updateTab, getTab, softDeleteTab, getAllTemplates, getDocumentsForTab, putDocument, putTemplate } from "@/lib/db";
import { getPendingMigrations } from "@/lib/page-extract";
import { generateDocument } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { v4 as uuidv4 } from "uuid";
import type { AITemplate, AIDocument } from "@/lib/types";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import MarkdownView from "./MarkdownView";
import DetailSidebar, { type TocEntry } from "./DetailSidebar";
import ChatFab from "./ChatFab";
import NotesDisplay from "@/components/NotesDisplay";
import DocumentTabs from "./DocumentTabs";
import DocumentView from "./DocumentView";
import CustomPromptView from "./CustomPromptView";
// import ReadingProgress from "@/components/ReadingProgress";
import { X, ChevronDown, List } from "lucide-solid";

interface DetailPageProps {
  tab: Tab;
}

export default function DetailPage(props: DetailPageProps) {
  const [transcriptSegments, setTranscriptSegments] = createSignal<
    TranscriptSegment[]
  >(props.tab.transcript || []);
  const [markdownContent, setMarkdownContent] = createSignal<string>(
    props.tab.content || "",
  );
  const [fetchingContent, setFetchingContent] = createSignal(false);
  const [currentTab, setCurrentTab] = createSignal(props.tab);
  const [isNarrow, setIsNarrow] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [heroScrolledPast, setHeroScrolledPast] = createSignal(false);
  const [reExtracting, setReExtracting] = createSignal(false);
  const [migrationDismissed, setMigrationDismissed] = createSignal(false);
  const [updateSuccess, setUpdateSuccess] = createSignal(false);
  const [tocEntries, setTocEntries] = createSignal<TocEntry[]>([]);
  const [tocDropdownOpen, setTocDropdownOpen] = createSignal(false);

  const [templates, setTemplates] = createSignal<AITemplate[]>([]);
  const [documents, setDocuments] = createSignal<AIDocument[]>([]);
  const [activeDocTab, setActiveDocTab] = createSignal<string>("content");
  const [generatingIds, setGeneratingIds] = createSignal<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = createSignal(false);
  const [customGenerating, setCustomGenerating] = createSignal(false);
  const [customResult, setCustomResult] = createSignal<string | null>(null);

  // Check for pending migrations
  const pendingMigrations = createMemo(() =>
    getPendingMigrations(props.tab.contentVersion),
  );

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
    const pending = pendingMigrations();
    const silentActions = pending.flatMap((m) =>
      m.actions.filter((a) => a.behavior === "silent"),
    );
    console.log(
      "[TabZen Migration] Tab contentVersion:",
      props.tab.contentVersion,
      "| pending migrations:",
      pending.length,
      "| silent re-extract:",
      silentActions.some((a) => a.type === "re-extract-content"),
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

    // Load AI templates and documents
    (async () => {
      const [tmpl, docs] = await Promise.all([
        getAllTemplates(),
        getDocumentsForTab(props.tab.id),
      ]);
      setTemplates(tmpl.filter((t) => t.isEnabled));
      setDocuments(docs);
    })();
  });

  // Extract TOC entries from rendered headings after content changes
  createEffect(() => {
    // Track these signals so effect re-runs when content changes
    markdownContent();
    transcriptSegments();
    activeDocTab();

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

  const hasContent = createMemo(
    () => transcriptSegments().length > 0 || markdownContent().length > 0,
  );

  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleBack = () => {
    window.close();
  };

  const handleToggleStar = async () => {
    const tab = currentTab();
    await updateTab(tab.id, { starred: !tab.starred });
    const updated = await getTab(tab.id);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleOpenSource = () => {
    window.open(props.tab.url, "_blank");
  };

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


  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    const updated = await getTab(tabId);
    if (updated) setCurrentTab(updated);
    notifyChanged();
  };

  const handleFetchContent = async () => {
    setFetchingContent(true);
    try {
      if (isYouTube()) {
        const response = await sendMessage({
          type: "GET_TRANSCRIPT",
          tabId: props.tab.id,
        });
        if (response.type === "TRANSCRIPT" && response.transcript) {
          setTranscriptSegments(response.transcript);
        }
      } else {
        const response = await sendMessage({
          type: "GET_CONTENT",
          tabId: props.tab.id,
        });
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
      const text = segments
        .map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
        .join("\n");
      navigator.clipboard.writeText(text);
    } else if (content) {
      navigator.clipboard.writeText(content);
    } else {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async (template: AITemplate) => {
    const settings = await getSettings();
    if (!settings.openRouterApiKey) return;

    setGeneratingIds((prev) => new Set([...prev, template.id]));
    try {
      const content = transcriptSegments().length > 0
        ? transcriptSegments().map((s) => s.text).join(" ")
        : markdownContent();
      const contentType = transcriptSegments().length > 0 ? "transcript" : "markdown" as const;
      const model = template.model || settings.aiModel;

      const result = await generateDocument(
        settings.openRouterApiKey,
        model,
        template.prompt,
        content,
        contentType,
      );

      const doc: AIDocument = {
        id: uuidv4(),
        tabId: props.tab.id,
        templateId: template.id,
        content: result,
        generatedAt: new Date().toISOString(),
        promptUsed: template.prompt,
      };
      await putDocument(doc);
      setDocuments(await getDocumentsForTab(props.tab.id));
    } catch (e) {
      console.error(`Failed to generate ${template.name}:`, e);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    const ungeneratedTemplates = templates().filter(
      (t) => !documents().some((d) => d.templateId === t.id),
    );
    await Promise.allSettled(ungeneratedTemplates.map((t) => handleGenerate(t)));
    setGeneratingAll(false);
  };

  const handleCreateCustomTemplate = async (name: string, prompt: string) => {
    const settings = await getSettings();
    if (!settings.openRouterApiKey) return;

    const template: AITemplate = {
      id: uuidv4(),
      name,
      prompt,
      isBuiltin: false,
      defaultPrompt: null,
      isEnabled: true,
      sortOrder: templates().length + 1,
      model: null,
    };
    await putTemplate(template);

    setCustomGenerating(true);
    try {
      const content = transcriptSegments().length > 0
        ? transcriptSegments().map((s) => s.text).join(" ")
        : markdownContent();
      const contentType = transcriptSegments().length > 0 ? "transcript" : "markdown" as const;

      const result = await generateDocument(
        settings.openRouterApiKey,
        settings.aiModel,
        prompt,
        content,
        contentType,
      );

      const doc: AIDocument = {
        id: uuidv4(),
        tabId: props.tab.id,
        templateId: template.id,
        content: result,
        generatedAt: new Date().toISOString(),
        promptUsed: prompt,
      };
      await putDocument(doc);
      setCustomResult(result);

      const [tmpl, docs] = await Promise.all([
        getAllTemplates(),
        getDocumentsForTab(props.tab.id),
      ]);
      setTemplates(tmpl.filter((t) => t.isEnabled));
      setDocuments(docs);
      setActiveDocTab(template.id);
    } catch (e) {
      console.error("Custom generation failed:", e);
    } finally {
      setCustomGenerating(false);
    }
  };

  const handleReExtract = async () => {
    setReExtracting(true);
    try {
      const response = await sendMessage({
        type: "RE_EXTRACT_CONTENT",
        tabId: props.tab.id,
      });
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
    const heroRect = heroRef.getBoundingClientRect();
    const scrollRect = scrollRef.getBoundingClientRect();
    // Hero is scrolled past when its bottom goes above the scroll container's top edge
    // (which is right below the action bar)
    setHeroScrolledPast(heroRect.bottom < scrollRect.top + 52);
  };

  const ContentView = () => (
    <>
      <Show when={isYouTube()}>
        <TranscriptView
          segments={transcriptSegments()}
          videoUrl={props.tab.url}
          onFetchTranscript={
            transcriptSegments().length === 0 ? handleFetchContent : undefined
          }
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
    <div
      ref={containerRef}
      class="@container flex h-screen bg-background relative"
    >
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
          onCopy={hasContent() ? handleCopy : undefined}
          copied={copied()}
          compact={heroScrolledPast()}
        />

        {/* Narrow: "On this page" TOC button + dropdown */}
        <Show when={isNarrow() && tocEntries().length > 0}>
          <div class="relative">
            <button
              onClick={() => setTocDropdownOpen(!tocDropdownOpen())}
              class="flex items-center gap-1.5 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-muted/20"
            >
              <List size={14} />
              <span>On this page</span>
              <ChevronDown
                size={14}
                class={`ml-auto transition-transform ${tocDropdownOpen() ? "rotate-180" : ""}`}
              />
            </button>
            <Show when={tocDropdownOpen()}>
              {/* Backdrop to close on outside click */}
              <div
                class="fixed inset-0 z-10"
                onClick={() => setTocDropdownOpen(false)}
              />
              <div class="absolute top-full left-0 right-0 z-20 bg-background/95 backdrop-blur-sm shadow-lg animate-[fadeIn_0.15s_ease-out]">
                {tocEntries().map((entry) => (
                  <button
                    class={`block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-muted/30 ${
                      entry.level >= 3 ? "pl-8" : ""
                    } text-muted-foreground hover:text-foreground`}
                    onClick={() => {
                      const el = scrollRef?.querySelector(
                        `#${CSS.escape(entry.id)}`,
                      );
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      setTocDropdownOpen(false);
                    }}
                  >
                    {entry.text}
                  </button>
                ))}
              </div>
            </Show>
          </div>
        </Show>

        {/* AI Document Tabs */}
        <Show when={hasContent() && templates().length > 0}>
          <DocumentTabs
            templates={templates()}
            documents={documents()}
            activeTab={activeDocTab()}
            onTabChange={setActiveDocTab}
            onGenerateAll={handleGenerateAll}
            onAddCustom={() => setActiveDocTab("custom")}
            generatingAll={generatingAll()}
            hasContent={hasContent()}
          />
        </Show>

        {/* Scrollable area containing content + sticky sidebar */}
        <div
          ref={scrollRef}
          class="flex-1 overflow-y-auto scrollbar-hide"
          onScroll={handleScroll}
        >
          {/* Content + sidebar row */}
          <div
            class="flex gap-16 mx-auto"
            style={{ "max-width": "calc(768px + 256px + 64px + 32px)" }}
          >
            {/* Content column — max 688px like VitePress */}
            <div class="flex-1 min-w-0 max-w-[768px] px-4">
              {/* Hero card */}
              <div ref={heroRef}>
                <DetailHeader
                  tab={currentTab()}
                  onBack={handleBack}
                  onToggleStar={handleToggleStar}
                  onOpenSource={handleOpenSource}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                          heroOnly
                />
              </div>

              {/* Narrow: inline notes (only when sidebar is hidden) */}
              <Show when={isNarrow()}>
                <div class="mb-6">
                  <NotesDisplay
                    tab={currentTab()}
                    onSave={handleSaveNotes}
                    clampLines={3}
                  />
                </div>
              </Show>

              {/* Article / Transcript / AI Document content */}
              <div class="pb-6">
                <Show when={activeDocTab() === "content"}>
                  <ContentView />
                </Show>
                <Show when={activeDocTab() === "custom"}>
                  <CustomPromptView
                    onCreateTemplate={handleCreateCustomTemplate}
                    generating={customGenerating()}
                    result={customResult()}
                  />
                </Show>
                <For each={templates()}>
                  {(template) => (
                    <Show when={activeDocTab() === template.id}>
                      <DocumentView
                        template={template}
                        document={documents().find((d) => d.templateId === template.id)}
                        generating={generatingIds().has(template.id)}
                        onGenerate={() => handleGenerate(template)}
                        onRegenerate={() => handleGenerate(template)}
                      />
                    </Show>
                  )}
                </For>
              </div>
            </div>

            {/* Sidebar placeholder — reserves space in the flex layout */}
            <Show when={!isNarrow()}>
              <div class="relative flex-shrink-0 w-[256px]">
                {/* Fixed sidebar — positioned inside placeholder, full viewport height */}
                <div class="fixed top-14 max-w-96 h-[calc(100vh-42px)] overflow-y-auto scrollbar-hide z-10">
                  <DetailSidebar
                    tab={currentTab()}
                    tocEntries={tocEntries()}
                    scrollRef={scrollRef}
                    onSaveNotes={handleSaveNotes}
                  />
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <ChatFab />

      {/* Update available toast */}
      <Show when={hasPromptedReExtract() && hasContent()}>
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#1e1e22]/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] whitespace-nowrap">
          <span
            class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${reExtracting() ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite]"}`}
          />
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
