import {
  createSignal,
  createMemo,
  createEffect,
  on,
  Show,
  For,
  onMount,
  onCleanup,
} from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { slugToSectionId, sectionIdToSlug } from "@/lib/routes";
import type { Page } from "@/lib/types";
import type { TranscriptSegment } from "@tab-zen/shared";
import { formatTimestamp } from "./TranscriptView";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { sendMessage } from "@/lib/messages";
import { updatePage, getPage, softDeletePage, getAllTemplates, getDocumentsForPage, putDocument, putTemplate, deleteDocument, deleteTemplate } from "@/lib/db";
import { getPendingMigrations } from "@/lib/page-extract";
import { generateDocument } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { v4 as uuidv4 } from "uuid";
import { toast } from "solid-sonner";
import type { AITemplate, AIDocument } from "@/lib/types";
import DetailHeader from "./DetailHeader";
import TranscriptView from "./TranscriptView";
import MarkdownView from "./MarkdownView";
import DetailSidebar, { type TocEntry } from "./DetailSidebar";
import ChatFab from "./ChatFab";
import NotesDisplay from "@/components/NotesDisplay";
import DocumentNav from "./DocumentNav";
import DocumentView from "./DocumentView";
import { getSkeletonForTemplate } from "./DocumentSkeletons";
import CustomPromptView from "./CustomPromptView";
import KeyPointsView from "./KeyPointsView";
import ActionItemsView from "./ActionItemsView";
import ELI5View from "./ELI5View";
import ProductsView from "./ProductsView";
import SocialPostsView from "./SocialPostsView";
import PromptViewer from "./PromptViewer";

const SPECIALIZED_RENDERERS: Record<string, (content: string) => any> = {
  "builtin-key-points": (content: string) => <KeyPointsView content={content} />,
  "builtin-action-items": (content: string) => <ActionItemsView content={content} />,
  "builtin-eli5": (content: string) => <ELI5View content={content} />,
  "builtin-products-mentions": (content: string) => <ProductsView content={content} />,
};

// Templates that handle their own generation (not the standard document flow)
const SELF_MANAGED_TEMPLATES = new Set(["builtin-social-posts"]);
// import ReadingProgress from "@/components/ReadingProgress";
import { X, ChevronDown, List } from "lucide-solid";

interface DetailPageProps {
  page: Page;
  initialSection?: string;
}

export default function DetailPage(props: DetailPageProps) {
  const params = useParams<{ pageId: string; section?: string }>();
  const navigate = useNavigate();

  const [transcriptSegments, setTranscriptSegments] = createSignal<
    TranscriptSegment[]
  >(props.page.transcript || []);
  const [markdownContent, setMarkdownContent] = createSignal<string>(
    props.page.content || "",
  );
  const [fetchingContent, setFetchingContent] = createSignal(false);
  const [currentPage, setCurrentPage] = createSignal(props.page);
  const [isNarrow, setIsNarrow] = createSignal(window.innerWidth < 768);
  const [hideRightNav, setHideRightNav] = createSignal(window.innerWidth < 1024);
  const [hideLeftNav, setHideLeftNav] = createSignal(window.innerWidth < 1100);
  const [copied, setCopied] = createSignal(false);
  const [reExtracting, setReExtracting] = createSignal(false);
  const [migrationDismissed, setMigrationDismissed] = createSignal(false);
  const [updateSuccess, setUpdateSuccess] = createSignal(false);
  const [tocEntries, setTocEntries] = createSignal<TocEntry[]>([]);
  const [tocDropdownOpen, setTocDropdownOpen] = createSignal(false);

  const initialSectionId = slugToSectionId(props.initialSection || params.section);
  const [templates, setTemplates] = createSignal<AITemplate[]>([]);
  const [documents, setDocuments] = createSignal<AIDocument[]>([]);
  const [docsLoaded, setDocsLoaded] = createSignal(false);
  const [activeSection, setActiveSection] = createSignal<string>(initialSectionId);
  const [generatingIds, setGeneratingIds] = createSignal<Set<string>>(new Set());
  const [customGenerating, setCustomGenerating] = createSignal(false);
  const [customResult, setCustomResult] = createSignal<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  // Sync active section changes to the URL
  createEffect(on(activeSection, (section) => {
    const slug = sectionIdToSlug(section);
    const basePath = `/page/${props.page.id}`;
    const targetPath = slug === "content" ? basePath : `${basePath}/${slug}`;
    const currentSlug = params.section || "content";
    const newSlug = slug === "content" ? "content" : slug;
    if (currentSlug !== newSlug) {
      navigate(targetPath, { replace: true });
    }
  }, { defer: true }));

  // Regeneration: track pending results that need user approval
  // Maps templateId -> { oldDoc, newDoc } for keep/discard flow
  const [pendingRegen, setPendingRegen] = createSignal<
    Record<string, { oldDoc: AIDocument; newDoc: AIDocument }>
  >({});

  // Check for pending migrations
  const pendingMigrations = createMemo(() =>
    getPendingMigrations(props.page.contentVersion),
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

  onMount(() => {
    // Auto-run silent migration actions
    const pending = pendingMigrations();
    const silentActions = pending.flatMap((m) =>
      m.actions.filter((a) => a.behavior === "silent"),
    );
    if (silentActions.some((a) => a.type === "re-extract-content")) {
      handleReExtract();
    }

    const narrowQuery = window.matchMedia("(max-width: 767px)");
    const rightNavQuery = window.matchMedia("(max-width: 1023px)");
    const leftNavQuery = window.matchMedia("(max-width: 1099px)");

    const onNarrowChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    const onRightNavChange = (e: MediaQueryListEvent) => setHideRightNav(e.matches);
    const onLeftNavChange = (e: MediaQueryListEvent) => setHideLeftNav(e.matches);

    narrowQuery.addEventListener("change", onNarrowChange);
    rightNavQuery.addEventListener("change", onRightNavChange);
    leftNavQuery.addEventListener("change", onLeftNavChange);

    onCleanup(() => {
      narrowQuery.removeEventListener("change", onNarrowChange);
      rightNavQuery.removeEventListener("change", onRightNavChange);
      leftNavQuery.removeEventListener("change", onLeftNavChange);
    });

    // Listen for data changes from other views
    const handleMessage = async (message: any) => {
      if (message.type === "DATA_CHANGED") {
        const updated = await getPage(props.page.id);
        if (updated) {
          setCurrentPage(updated);
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
        getDocumentsForPage(props.page.id),
      ]);
      setTemplates(tmpl.filter((t) => t.isEnabled));
      setDocuments(docs);
      setDocsLoaded(true);
    })();
  });

  // Auto-generate when navigating to a section with no document
  // Only runs after documents have been loaded to avoid false-positive triggers
  createEffect(() => {
    if (!docsLoaded()) return;
    const section = activeSection();
    if (section === "content" || section === "custom") return;
    if (SELF_MANAGED_TEMPLATES.has(section)) return;

    const tmpl = templates().find((t) => t.id === section);
    if (!tmpl) return;

    const hasDoc = documents().some((d) => d.templateId === section);
    const isGen = generatingIds().has(section);
    const hasSource = transcriptSegments().length > 0 || markdownContent().length > 0;

    if (!hasDoc && !isGen && hasSource) {
      handleGenerate(tmpl);
    }
  });

  // Extract TOC entries from rendered headings after content changes
  createEffect(() => {
    // Track these signals so effect re-runs when content changes
    markdownContent();
    transcriptSegments();
    activeSection();

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

  const isYouTube = createMemo(() => isYouTubeWatchUrl(props.page.url));

  const hasContent = createMemo(
    () => transcriptSegments().length > 0 || markdownContent().length > 0,
  );

  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleBack = () => {
    navigate("/");
  };

  const handleToggleStar = async () => {
    const page = currentPage();
    await updatePage(page.id, { starred: !page.starred });
    const updated = await getPage(page.id);
    if (updated) setCurrentPage(updated);
    notifyChanged();
  };

  const handleArchive = async () => {
    const page = currentPage();
    await updatePage(page.id, { archived: !page.archived });
    const updated = await getPage(page.id);
    if (updated) setCurrentPage(updated);
    notifyChanged();
  };

  const handleDelete = async () => {
    await softDeletePage(currentPage().id);
    notifyChanged();
    navigate("/");
  };


  const handleSaveNotes = async (pageId: string, notes: string) => {
    await updatePage(pageId, { notes: notes || null });
    const updated = await getPage(pageId);
    if (updated) setCurrentPage(updated);
    notifyChanged();
  };

  const handleFetchContent = async () => {
    setFetchingContent(true);
    try {
      if (isYouTube()) {
        const response = await sendMessage({
          type: "GET_TRANSCRIPT",
          pageId: props.page.id,
        });
        if (response.type === "TRANSCRIPT" && response.transcript) {
          setTranscriptSegments(response.transcript);
        }
      } else {
        const response = await sendMessage({
          type: "GET_CONTENT",
          pageId: props.page.id,
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

  /** Simple hash of prompt + source content for staleness detection */
  const computeSourceHash = async (prompt: string, content: string): Promise<string> => {
    const data = new TextEncoder().encode(prompt + "\n---\n" + content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  };

  /** Get the current source hash for a template */
  const getCurrentSourceHash = async (template: AITemplate): Promise<string | null> => {
    const content = transcriptSegments().length > 0
      ? transcriptSegments().map((s) => s.text).join(" ")
      : markdownContent();
    if (!content) return null;
    return computeSourceHash(template.prompt, content);
  };

  const handleGenerate = async (template: AITemplate) => {
    const settings = await getSettings();
    if (!settings.openRouterApiKey) return;

    const content = transcriptSegments().length > 0
      ? transcriptSegments().map((s) => s.text).join(" ")
      : markdownContent();
    if (!content) return;

    // Check if this is a regeneration (existing doc)
    const existingDoc = documents().find((d) => d.templateId === template.id);
    const isRegen = !!existingDoc;

    setGeneratingIds((prev) => new Set([...prev, template.id]));
    try {
      const contentType = transcriptSegments().length > 0 ? "transcript" : "markdown" as const;
      const model = template.model || settings.aiModel;

      const result = await generateDocument(
        settings.openRouterApiKey,
        model,
        template.prompt,
        content,
        contentType,
      );

      const sourceHash = await computeSourceHash(template.prompt, content);

      const newDoc: AIDocument = {
        id: uuidv4(),
        pageId: props.page.id,
        templateId: template.id,
        content: result,
        generatedAt: new Date().toISOString(),
        promptUsed: template.prompt,
        sourceHash,
      };

      if (isRegen && existingDoc) {
        // Don't save yet — show keep/discard choice
        setPendingRegen((prev) => ({
          ...prev,
          [template.id]: { oldDoc: existingDoc, newDoc },
        }));
      } else {
        // First generation — save directly
        await putDocument(newDoc);
        setDocuments(await getDocumentsForPage(props.page.id));
      }
    } catch (e) {
      console.error(`[TabZen AI] Failed to generate ${template.name}:`, e);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const handleAcceptRegen = async (templateId: string) => {
    const pending = pendingRegen()[templateId];
    if (!pending) return;
    await putDocument(pending.newDoc);
    setDocuments(await getDocumentsForPage(props.page.id));
    setPendingRegen((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  };

  const handleDiscardRegen = (templateId: string) => {
    setPendingRegen((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  };

  const handleDeleteCustomDoc = async (template: AITemplate) => {
    const doc = documents().find((d) => d.templateId === template.id);
    if (doc) await deleteDocument(doc.id);
    await deleteTemplate(template.id);
    const [tmpl, docs] = await Promise.all([
      getAllTemplates(),
      getDocumentsForPage(props.page.id),
    ]);
    setTemplates(tmpl.filter((t) => t.isEnabled));
    setDocuments(docs);
    setActiveSection("content");
  };

  const handleUpdatePrompt = async (template: AITemplate, prompt: string) => {
    const updated = { ...template, prompt };
    await putTemplate(updated);
    const tmpl = await getAllTemplates();
    setTemplates(tmpl.filter((t) => t.isEnabled));
  };

  const handleHideTemplate = async (template: AITemplate) => {
    const updated = { ...template, isEnabled: false };
    await putTemplate(updated);
    const tmpl = await getAllTemplates();
    setTemplates(tmpl.filter((t) => t.isEnabled));
    if (activeSection() === template.id) setActiveSection("content");
    toast(template.name + " hidden", {
      description: "You can bring it back from Settings anytime",
      duration: 8000,
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = { ...template, isEnabled: true };
          await putTemplate(restored);
          const t = await getAllTemplates();
          setTemplates(t.filter((x) => x.isEnabled));
        },
      },
    });
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

      const sourceHash = await computeSourceHash(prompt, content);

      const doc: AIDocument = {
        id: uuidv4(),
        pageId: props.page.id,
        templateId: template.id,
        content: result,
        generatedAt: new Date().toISOString(),
        promptUsed: prompt,
        sourceHash,
      };
      await putDocument(doc);
      setCustomResult(result);

      // Generate a short title from the result
      try {
        const title = await generateDocument(
          settings.openRouterApiKey,
          settings.aiModel,
          "Give this content a short title (3-6 words max). Return ONLY the title, nothing else.",
          result,
          "markdown",
        );
        const cleanTitle = title.replace(/^["']|["']$/g, "").trim();
        if (cleanTitle && cleanTitle.length < 60) {
          template.name = cleanTitle;
          await putTemplate(template);
        }
      } catch {
        // Title generation failed — keep the truncated prompt as name
      }

      const [tmpl, docs] = await Promise.all([
        getAllTemplates(),
        getDocumentsForPage(props.page.id),
      ]);
      setTemplates(tmpl.filter((t) => t.isEnabled));
      setDocuments(docs);
      setActiveSection(template.id);
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
        pageId: props.page.id,
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


  const ContentView = () => (
    <>
      <Show when={isYouTube()}>
        <TranscriptView
          segments={transcriptSegments()}
          videoUrl={props.page.url}
          chapters={currentPage().chapters}
          onFetchTranscript={
            transcriptSegments().length === 0 ? handleFetchContent : undefined
          }
          loading={fetchingContent()}
        />
      </Show>
      <Show when={!isYouTube() && markdownContent()}>
        <MarkdownView content={markdownContent()} sourceUrl={props.page.url} />
      </Show>
      <Show when={!isYouTube() && !markdownContent()}>
        <MarkdownView
          content=""
          sourceUrl={props.page.url}
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
      {/* Left sidebar — always in DOM for transitions */}
      <Show when={hasContent() && templates().length > 0}>
        {/* Backdrop overlay when sidebar slides over content */}
        <Show when={hideLeftNav() && sidebarOpen()}>
          <div
            class="fixed inset-0 bg-black/50 z-40 animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setSidebarOpen(false)}
          />
        </Show>

        {/* Sidebar panel */}
        <div
          class={`flex-shrink-0 bg-[#161618] overflow-y-auto scrollbar-hide ${
            hideLeftNav()
              ? `fixed top-0 left-0 h-full w-[300px] z-50 transition-transform duration-300 ${
                  sidebarOpen() ? "translate-x-0" : "-translate-x-full"
                }`
              : "w-[300px]"
          }`}
        >
          <DocumentNav
            templates={templates()}
            documents={documents()}
            activeSection={activeSection()}
            onSectionChange={(section) => {
              setActiveSection(section);
              if (hideLeftNav()) setSidebarOpen(false);
            }}
            onAddCustom={() => {
              setActiveSection("custom");
              if (hideLeftNav()) setSidebarOpen(false);
            }}
            onHideTemplate={handleHideTemplate}
          />
        </div>
      </Show>

      {/* Main content + right sidebar */}
      <div class="flex-1 min-w-0 flex flex-col">
        {/* Fixed action bar */}
        <DetailHeader
          page={currentPage()}
          onBack={handleBack}
          onToggleStar={handleToggleStar}

          onArchive={handleArchive}
          onDelete={handleDelete}
          onCopy={hasContent() ? handleCopy : undefined}
          copied={copied()}
          onMenuToggle={hideLeftNav() && hasContent() && templates().length > 0 ? () => setSidebarOpen(!sidebarOpen()) : undefined}
        />

        {/* Narrow: "On this page" TOC button + dropdown */}
        <Show when={hideRightNav() && tocEntries().length > 0}>
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

        {/* Scrollable area containing content + sticky sidebar */}
        <div
          ref={scrollRef}
          class="flex-1 overflow-y-auto scrollbar-hide"
        >
          {/* Content + Right sidebar */}
          <div
            class="flex gap-16 mx-auto"
            style={{ "max-width": "calc(768px + 256px + 64px + 32px)" }}
          >
            {/* Content column */}
            <div class="flex-1 min-w-0 max-w-[768px] px-4">
              {/* Hero card */}
              <div>
                <DetailHeader
                  page={currentPage()}
                  onBack={handleBack}
                  onToggleStar={handleToggleStar}
        
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                          heroOnly
                />
              </div>

              {/* Narrow: inline notes (only when sidebar is hidden) */}
              <Show when={hideRightNav()}>
                <div class="mb-6">
                  <NotesDisplay
                    page={currentPage()}
                    onSave={handleSaveNotes}
                    clampLines={3}
                  />
                </div>
              </Show>

              {/* Article / Transcript / AI Document content */}
              <div class="pb-6">
                <Show when={activeSection() === "content"}>
                  <ContentView />
                </Show>
                <Show when={activeSection() === "custom"}>
                  <CustomPromptView
                    onCreateTemplate={handleCreateCustomTemplate}
                    generating={customGenerating()}
                    result={customResult()}
                  />
                </Show>
                {/* Social Posts — self-managed, handles its own generation */}
                <Show when={activeSection() === "builtin-social-posts"}>
                  <SocialPostsView
                    content={
                      transcriptSegments().length > 0
                        ? transcriptSegments().map((s) => s.text).join(" ")
                        : markdownContent()
                    }
                    contentType={transcriptSegments().length > 0 ? "transcript" : "markdown"}
                    pageId={props.page.id}
                  />
                </Show>

                <For each={templates()}>
                  {(template) => {
                    if (SELF_MANAGED_TEMPLATES.has(template.id)) return null;
                    const doc = () => documents().find((d) => d.templateId === template.id);
                    const isGenerating = () => generatingIds().has(template.id);
                    const pending = () => pendingRegen()[template.id];
                    const specializedRenderer = SPECIALIZED_RENDERERS[template.id];
                    const displayContent = () => pending()?.newDoc.content || doc()?.content;

                    // Check staleness — hash mismatch means prompt or content changed
                    const [stale, setStale] = createSignal(false);
                    createEffect(async () => {
                      const d = doc();
                      if (!d?.sourceHash) { setStale(false); return; }
                      const currentHash = await getCurrentSourceHash(template);
                      setStale(currentHash !== null && currentHash !== d.sourceHash);
                    });

                    return (
                    <Show when={activeSection() === template.id}>
                      {/* Generating state — always show skeleton */}
                      <Show when={isGenerating()}>
                        <div class="px-2 mb-4">
                          <h2 class="text-xl font-semibold text-foreground">{template.name}</h2>
                        </div>
                        {getSkeletonForTemplate(template.id)}
                      </Show>

                      {/* Not generating */}
                      <Show when={!isGenerating()}>
                        {/* Pending regen bar — keep or discard */}
                        <Show when={pending()}>
                          <div class="mx-4 mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-sky-500/10">
                            <span class="text-sm text-sky-300">New version generated</span>
                            <div class="flex items-center gap-1.5 ml-auto">
                              <button
                                onClick={() => handleAcceptRegen(template.id)}
                                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                              >
                                Use New
                              </button>
                              <button
                                onClick={() => handleDiscardRegen(template.id)}
                                class="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Keep Old
                              </button>
                            </div>
                          </div>
                        </Show>

                        <Show
                          when={!!specializedRenderer && !!displayContent()}
                          fallback={
                            <DocumentView
                              template={template}
                              document={pending()?.newDoc || doc()}
                              generating={false}
                              stale={stale()}
                              onGenerate={() => handleGenerate(template)}
                              onRegenerate={() => handleGenerate(template)}
                              onDelete={!template.isBuiltin ? () => handleDeleteCustomDoc(template) : undefined}
                              onUpdatePrompt={(p) => handleUpdatePrompt(template, p)}
                            />
                          }
                        >
                          {/* Specialized renderer with title + prompt + stale indicator */}
                          <div class="px-2">
                            <div class="flex items-center gap-2 mb-6">
                              <h2 class="text-xl font-semibold text-foreground">{template.name}</h2>
                            </div>
                            <PromptViewer
                              template={template}
                              onUpdatePrompt={(p) => handleUpdatePrompt(template, p)}
                            />
                          </div>
                          <Show when={stale()}>
                            <div class="mx-2 mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-sky-500/10">
                              <span class="text-sm text-sky-300">Source or prompt has changed</span>
                              <button
                                onClick={() => handleGenerate(template)}
                                class="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 transition-colors"
                              >
                                Regenerate
                              </button>
                            </div>
                          </Show>
                          {specializedRenderer(displayContent()!)}
                        </Show>
                      </Show>
                    </Show>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Sidebar placeholder — reserves space in the flex layout */}
            <Show when={!hideRightNav()}>
              <div class="relative flex-shrink-0 w-[256px]">
                {/* Fixed sidebar — positioned inside placeholder, full viewport height */}
                <div class="fixed top-14 max-w-96 h-[calc(100vh-42px)] overflow-y-auto scrollbar-hide z-10">
                  <DetailSidebar
                    page={currentPage()}
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
