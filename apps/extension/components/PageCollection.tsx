import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Menu,
  X,
  Trash2,
  Star,
  StickyNote,
  Calendar,
  Archive,
  Inbox,
} from "lucide-solid";
import UserMenu from "./UserMenu";
import AddUrlInput from "./AddUrlInput";
import EmptyBlock from "./EmptyBlock";
import { buildDomainIndex, getDomain, extractCreator } from "@/lib/domains";
import AppSidebar from "./AppSidebar";
import type {
  Page,
  Group,
  Capture,
  Settings,
  CapturePreviewData,
} from "@/lib/types";
import {
  getAllPages,
  getAllGroups,
  getAllCaptures,
  updatePage,
  updateGroup,
  hardDeletePage,
  restorePage,
} from "@/lib/db";
import { sendMessage } from "@/lib/messages";
import { getSettings, updateSettings } from "@/lib/settings";
import GroupSection from "./GroupSection";
import SearchBar from "./SearchBar";
import FilterPills from "./FilterPills";
import ViewToggle from "./ViewToggle";
import NotesEditor from "./NotesEditor";
import CapturePreview from "./CapturePreview";
import EmptyState from "./EmptyState";
import NoteCard from "./NoteCard";
import ConfirmDialog from "./ConfirmDialog";

interface PageCollectionProps {
  viewMode: Settings["viewMode"];
  onViewModeChange: (mode: "cards" | "rows") => void;
}

export default function PageCollection(props: PageCollectionProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal<Settings["activeFilter"]>("all");
  const [deviceFilter, setDeviceFilter] = createSignal<string>("all");
  const [domainFilter, setDomainFilter] = createSignal<string | null>(null);
  const [creatorFilter, setCreatorFilter] = createSignal<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string | null>(null);
  let searchBarApi: { setSearch: (q: string) => void } | undefined;
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [searchResults, setSearchResults] = createSignal<Page[] | null>(null);
  const [editingPage, setEditingPage] = createSignal<Page | null>(null);
  const [deletingPage, setDeletingPage] = createSignal<Page | null>(null);
  const [emptyingTrash, setEmptyingTrash] = createSignal(false);
  const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);
  const [pasteSaving, setPasteSaving] = createSignal(false);
  const [capturePreview, setCapturePreview] =
    createSignal<CapturePreviewData | null>(null);

  const [allPages, setAllPages] = createSignal<Page[]>([]);
  const [allGroups, setAllGroups] = createSignal<Group[]>([]);
  const [allCaptures, setAllCaptures] = createSignal<Capture[]>([]);

  const loadData = async () => {
    const [pages, groups, captures] = await Promise.all([
      getAllPages(),
      getAllGroups(),
      getAllCaptures(),
    ]);
    setAllPages(pages);
    setAllGroups(groups);
    setAllCaptures(captures);
  };

  // Update a single page in place without refetching everything
  const patchPage = (id: string, updates: Partial<Page>) => {
    setAllPages((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  // Remove a page from the local list
  const removePage = (id: string) => {
    setAllPages((prev) => prev.filter((t) => t.id !== id));
  };

  // Full refresh (for captures, syncs, bulk changes)
  const refresh = () => loadData();

  // Listen for data changes from background worker
  onMount(() => {
    loadData();
    getSettings().then((s) => {
      if (s.syncError) setSyncError(s.syncError);
    });

    const listener = (message: any) => {
      if (message.type === "DATA_CHANGED") {
        loadData();
      }
      if (message.type === "SYNC_ERROR") {
        setSyncError(message.message);
      }
      if (message.type === "SYNC_ERROR_CLEARED") {
        setSyncError(null);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    onCleanup(() => browser.runtime.onMessage.removeListener(listener));

    // Global paste detection — capture URLs pasted anywhere (not in inputs)
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;

      try {
        const u = new URL(text);
        if (u.protocol !== "https:" && u.protocol !== "http:") return;
      } catch {
        return;
      }

      // Valid URL pasted — confirm with user
      setPastedUrl(text);
    };
    document.addEventListener("paste", handlePaste);
    onCleanup(() => document.removeEventListener("paste", handlePaste));
  });

  const filteredGroups = createMemo(() => {
    const groups = allGroups() || [];
    const f = filter();

    let filtered: Group[];
    if (f === "archived") {
      // Show all groups -- archived pages can live in any group
      filtered = [...groups];
    } else {
      filtered = groups.filter((g) => !g.archived);
    }

    filtered.sort((a, b) => a.position - b.position);

    if (f === "byDate") {
      const captures = allCaptures() || [];
      const captureMap = new Map(captures.map((c) => [c.id, c]));
      filtered.sort((a, b) => {
        const ca = captureMap.get(a.captureId);
        const cb = captureMap.get(b.captureId);
        return (cb?.capturedAt || "").localeCompare(ca?.capturedAt || "");
      });
    }

    return filtered;
  });

  const domainIndex = createMemo(() => buildDomainIndex(allPages() || []));

  const tagIndex = createMemo(() => {
    const pages = allPages() || [];
    const counts = new Map<string, number>();
    for (const page of pages) {
      if (page.deletedAt || !page.tags) continue;
      for (const tag of page.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  });

  const uniqueDevices = createMemo(() => {
    const pages = allPages() || [];
    const deviceMap = new Map<string, string>();
    for (const t of pages) {
      const id = t.deviceId || t.sourceLabel;
      if (id && !deviceMap.has(id)) {
        deviceMap.set(id, t.sourceLabel);
      }
    }
    return Array.from(deviceMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  const filteredPages = createMemo(() => {
    let pages = searchResults() || allPages() || [];
    const f = filter();
    const device = deviceFilter();

    // Apply device filter
    if (device !== "all") {
      pages = pages.filter((t) => (t.deviceId || t.sourceLabel) === device);
    }

    if (f === "trash")
      return pages.filter(
        (t) => t.deletedAt !== null && t.deletedAt !== undefined,
      );

    // All non-trash views exclude soft-deleted pages
    pages = pages.filter((t) => !t.deletedAt);

    // Apply domain filter
    const domain = domainFilter();
    if (domain) {
      pages = pages.filter((t) => getDomain(t.url) === domain);
      // Apply creator filter within domain
      const creator = creatorFilter();
      if (creator) {
        pages = pages.filter((t) => extractCreator(t) === creator);
      }
    }

    if (f === "archived") return pages.filter((t) => t.archived);
    if (f === "starred") return pages.filter((t) => t.starred && !t.archived);
    if (f === "notes") return pages.filter((t) => t.notes && !t.archived);
    if (f === "duplicates") {
      const live = pages.filter((t) => !t.archived);
      const urlCount = new Map<string, number>();
      for (const t of live) {
        const normalized = t.url
          .replace(/\/$/, "")
          .replace(/^https?:\/\/www\./, "https://");
        urlCount.set(normalized, (urlCount.get(normalized) || 0) + 1);
      }
      return live.filter((t) => {
        const normalized = t.url
          .replace(/\/$/, "")
          .replace(/^https?:\/\/www\./, "https://");
        return urlCount.get(normalized)! > 1;
      });
    }
    return pages.filter((t) => !t.archived);
  });

  const pagesForGroup = (groupId: string) => {
    return filteredPages().filter((t) => t.groupId === groupId);
  };

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const pageDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (pageDay.getTime() === today.getTime()) return "Today";
    if (pageDay.getTime() === yesterday.getTime()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const pagesByDate = createMemo(() => {
    const pages = filteredPages();
    const groups = new Map<string, { label: string; pages: Page[] }>();

    // Sort by capturedAt descending
    const sorted = [...pages].sort((a, b) =>
      b.capturedAt.localeCompare(a.capturedAt),
    );

    for (const page of sorted) {
      const dayKey = page.capturedAt.slice(0, 10); // YYYY-MM-DD
      if (!groups.has(dayKey)) {
        groups.set(dayKey, {
          label: formatDateLabel(page.capturedAt),
          pages: [],
        });
      }
      groups.get(dayKey)!.pages.push(page);
    }

    return Array.from(groups.values());
  });

  const handleTagClick = (tag: string) => {
    searchBarApi?.setSearch(`#${tag}`);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchQuery("");
      setSearchResults(null);
      return;
    }
    const response = await sendMessage({ type: "SEARCH_PAGES", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.pages);
      setSearchQuery(query);
    }
  };

  const handleAISearch = async (query: string) => {
    const response = await sendMessage({ type: "AI_SEARCH", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.pages);
    }
  };

  /** Notify other views that data changed */
  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleOpenPage = (page: Page) => {
    navigate(`/page/${page.id}`);
  };

  const handleOpenSource = async (page: Page) => {
    await sendMessage({ type: "OPEN_PAGE", pageId: page.id });
    patchPage(page.id, {
      viewCount: page.viewCount + 1,
      lastViewedAt: new Date().toISOString(),
    });
  };

  const handleSaveNotes = async (pageId: string, notes: string) => {
    await updatePage(pageId, { notes: notes || null });
    patchPage(pageId, { notes: notes || null });
    notifyChanged();
  };

  const handleToggleStar = async (page: Page) => {
    const starred = !page.starred;
    await updatePage(page.id, { starred });
    patchPage(page.id, { starred });
    notifyChanged();
  };

  const handleRestore = async (page: Page) => {
    await restorePage(page.id);
    patchPage(page.id, { deletedAt: null });
    notifyChanged();
  };

  const handleHardDelete = (page: Page) => {
    setDeletingPage(page);
  };

  const confirmDelete = async () => {
    const page = deletingPage();
    if (page) {
      await hardDeletePage(page.id);
      setDeletingPage(null);
      removePage(page.id);
      notifyChanged();
    }
  };

  const handleRenameGroup = async (group: Group, newName: string) => {
    await updateGroup(group.id, { name: newName });
    setAllGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, name: newName } : g)),
    );
    notifyChanged();
  };

  const handleConfirmCapture = async () => {
    const preview = capturePreview();
    if (preview) {
      await sendMessage({ type: "CONFIRM_CAPTURE", captureData: preview });
      setCapturePreview(null);
      loadData(); // Full reload for new captures
    }
  };

  return (
    <div class="flex h-full bg-background text-foreground @container">
      {/* Sidebar - persistent when container is wide enough */}
      <div class="hidden @[768px]:block w-72 flex-shrink-0 h-full bg-[#161618]">
        <AppSidebar
          domains={domainIndex()}
          activeDomain={domainFilter()}
          activeCreator={creatorFilter()}
          onSelectDomain={(d) => {
            setDomainFilter(d);
            setCreatorFilter(null);
          }}
          onSelectCreator={(d, c) => {
            setDomainFilter(d);
            setCreatorFilter(c);
          }}
          totalCount={
            (allPages() || []).filter((t) => !t.deletedAt && !t.archived).length
          }
        />
      </div>

      {/* Sidebar drawer overlay for narrow views */}
      <Show when={sidebarOpen()}>
        <div class="fixed inset-0 z-40 flex @[768px]:hidden">
          <div class="w-64 h-full bg-[#161618] overflow-y-auto">
            <AppSidebar
              domains={domainIndex()}
              activeDomain={domainFilter()}
              activeCreator={creatorFilter()}
              onSelectDomain={(d) => {
                setDomainFilter(d);
                setCreatorFilter(null);
              }}
              onSelectCreator={(d, c) => {
                setDomainFilter(d);
                setCreatorFilter(c);
                if (c) setSidebarOpen(false);
              }}
              totalCount={
                (allPages() || []).filter((t) => !t.deletedAt && !t.archived)
                  .length
              }
            />
          </div>
          <div
            class="flex-1 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 flex flex-col h-full min-w-0">
        {/* Top Bar — matches detail page header */}
        <div class="flex items-center gap-2 px-4 py-4 bg-background border-b-3 border-[#161618] flex-shrink-0">
          {/* Hamburger - visible only when sidebar is hidden */}
          <button
            class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors @[768px]:hidden flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen())}
            title="Browse domains"
          >
            <Menu size={16} />
          </button>

          <span class="text-sm font-medium text-foreground truncate flex-1 min-w-0">
            Collections
            <Show when={domainFilter()}>
              <span class="text-muted-foreground font-normal">
                {" / "}
                {domainFilter()}
                <Show when={creatorFilter()}>
                  {" / "}
                  {creatorFilter()}
                </Show>
              </span>
            </Show>
          </span>

          <AddUrlInput />

          <ViewToggle mode={props.viewMode} onChange={props.onViewModeChange} />

          <div class="w-px h-5 bg-muted-foreground/20 flex-shrink-0 mx-2" />

          <UserMenu />
        </div>

        {/* Sync error banner */}
        <Show when={syncError()}>
          <div class="mx-4 mt-2 flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2">
            <p class="text-xs text-red-300">{syncError()}</p>
            <div class="flex items-center gap-2">
              <button
                class="text-xs text-red-300 hover:text-red-200 transition-colors"
                onClick={() => navigate("/settings")}
              >
                Settings
              </button>
              <button
                class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setSyncError(null);
                  updateSettings({ syncError: null });
                  sendMessage({ type: "GET_UNCAPTURED_COUNT" }); // triggers badge refresh
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </Show>

        {/* Paste URL confirmation */}
        <Show when={pastedUrl()}>
          <div class="mx-4 mt-3 flex items-center justify-between bg-sky-500 rounded-lg px-5 py-3 gap-6">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white">Add to collection?</p>
              <p class="text-xs text-white mt-0.5 truncate">{pastedUrl()}</p>
            </div>
            <div class="flex items-center gap-4 flex-shrink-0">
              <button
                class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-sky-600 hover:bg-white/90 transition-colors disabled:opacity-50"
                disabled={pasteSaving()}
                onClick={async () => {
                  setPasteSaving(true);
                  const response = await sendMessage({ type: "CAPTURE_URL", url: pastedUrl()! });
                  setPasteSaving(false);
                  if (response.type === "URL_SAVED" && response.pageId) {
                    setPastedUrl(null);
                    navigate(`/page/${response.pageId}`);
                  } else {
                    setPastedUrl(null);
                  }
                }}
              >
                {pasteSaving() ? "Saving..." : "Save"}
              </button>
              <button
                class="text-sm text-white/80 hover:text-white transition-colors"
                onClick={() => setPastedUrl(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </Show>

        <SearchBar
          onSearch={handleSearch}
          onAISearch={handleAISearch}
          tags={tagIndex()}
          onInit={(api) => {
            searchBarApi = api;
          }}
        />
        <div class="flex items-center gap-2 px-4 pt-8 pb-4">
          <div class="flex-1 overflow-x-auto scrollbar-hide">
            <FilterPills active={filter()} onChange={setFilter} />
          </div>
          <Show when={uniqueDevices().length > 1}>
            <select
              class="bg-muted/40 text-sm text-foreground rounded-lg px-3 py-1.5 outline-none focus:bg-muted/60 transition-colors flex-shrink-0"
              value={deviceFilter()}
              onChange={(e) => setDeviceFilter(e.currentTarget.value)}
            >
              <option value="all">All Devices</option>
              <For each={uniqueDevices()}>
                {(device) => <option value={device.id}>{device.label}</option>}
              </For>
            </select>
          </Show>
        </div>

        {/* Collection - @container for responsive card grid */}
        <div class="flex-1 overflow-y-auto @container">
          <Show
            when={(allPages() || []).filter((t) => !t.deletedAt).length > 0}
            fallback={<EmptyState />}
          >
            {/* Notes view */}
            <Show when={filter() === "notes"}>
              <Show
                when={filteredPages().length > 0}
                fallback={
                  <EmptyBlock
                    icon={<StickyNote size={52} />}
                    title="No notes yet"
                    description="Add notes to any page to see them here."
                  />
                }
              >
                <div class="grid grid-cols-1 @[600px]:grid-cols-2 @[900px]:grid-cols-3 gap-4 p-4">
                  <For each={filteredPages()}>
                    {(page) => (
                      <NoteCard
                        page={page}
                        onOpen={handleOpenPage}
                        onEditNotes={setEditingPage}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </Show>

            {/* By Date view */}
            <Show when={filter() === "byDate"}>
              <Show
                when={filteredPages().length > 0}
                fallback={
                  <EmptyBlock
                    icon={<Calendar size={52} />}
                    title="No pages saved yet"
                    description="Capture some pages to see them organized by date."
                  />
                }
              >
                <For each={pagesByDate()}>
                  {(dateGroup) => (
                    <GroupSection
                      group={{
                        id: dateGroup.label,
                        name: dateGroup.label,
                        captureId: "",
                        position: 0,
                        archived: false,
                      }}
                      pages={dateGroup.pages}
                      viewMode={props.viewMode}
                      searchQuery={searchQuery()}
                      onOpenPage={handleOpenPage}
                      onEditNotes={setEditingPage}
                      onRenameGroup={() => {}}
                      onToggleStar={handleToggleStar}
                      onOpenSource={handleOpenSource}
                      onSelectCreator={(d, c) => {
                        setDomainFilter(d);
                        setCreatorFilter(c);
                      }}
                      onTagClick={handleTagClick}
                    />
                  )}
                </For>
              </Show>
            </Show>

            {/* Trash view */}
            <Show when={filter() === "trash"}>
              <div class="mx-4 mt-3 mb-4 px-4 py-3 bg-muted/30 rounded-xl flex items-center justify-between gap-4">
                <div class="flex items-center gap-2.5 min-w-0">
                  <Trash2
                    size={15}
                    class="text-muted-foreground/50 flex-shrink-0"
                  />
                  <span class="text-sm text-muted-foreground">
                    Items are automatically deleted after 30 days
                  </span>
                </div>
                <Show when={filteredPages().length > 0}>
                  <button
                    class="text-sm font-medium text-red-400/80 hover:text-red-400 transition-colors flex-shrink-0 px-3 py-1 rounded-full hover:bg-red-400/10"
                    onClick={() => setEmptyingTrash(true)}
                  >
                    Empty Now
                  </button>
                </Show>
              </div>
              <Show
                when={filteredPages().length > 0}
                fallback={
                  <EmptyBlock
                    icon={<Trash2 size={52} />}
                    title="Trash is empty"
                    description="Deleted pages will appear here."
                  />
                }
              >
                <GroupSection
                  group={{
                    id: "trash",
                    name: "Trash",
                    captureId: "",
                    position: 0,
                    archived: false,
                  }}
                  pages={filteredPages()}
                  viewMode={props.viewMode}
                  onOpenPage={handleOpenPage}
                  onEditNotes={setEditingPage}
                  onRenameGroup={() => {}}
                  onToggleStar={handleToggleStar}
                  onRestore={handleRestore}
                  onHardDelete={handleHardDelete}
                  isTrash
                />
              </Show>
            </Show>

            {/* Default group view (All, Starred, Archived, Duplicates) */}
            <Show
              when={
                filter() !== "notes" &&
                filter() !== "byDate" &&
                filter() !== "trash"
              }
            >
              <Show
                when={filteredPages().length > 0}
                fallback={
                  filter() === "starred" ? (
                    <EmptyBlock
                      icon={<Star size={52} />}
                      title="No starred pages"
                      description="Star pages to quickly find them later."
                    />
                  ) : filter() === "archived" ? (
                    <EmptyBlock
                      icon={<Archive size={52} />}
                      title="No archived pages"
                      description="Archive pages to declutter without deleting."
                    />
                  ) : (
                    <EmptyBlock
                      icon={<Inbox size={52} />}
                      title="No pages to show"
                      description="Capture some pages to get started."
                    />
                  )
                }
              >
                <For each={filteredGroups()}>
                  {(group) => {
                    const pages = () => pagesForGroup(group.id);
                    return (
                      <Show when={pages().length > 0}>
                        <GroupSection
                          group={group}
                          pages={pages()}
                          viewMode={props.viewMode}
                          searchQuery={searchQuery()}
                          onOpenPage={handleOpenPage}
                          onEditNotes={setEditingPage}
                          onRenameGroup={handleRenameGroup}
                          onToggleStar={handleToggleStar}
                          onOpenSource={handleOpenSource}
                        />
                      </Show>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </Show>
        </div>

        {/* Notes Editor Modal */}
        <Show when={editingPage()}>
          {(page) => (
            <NotesEditor
              page={page()}
              onSave={handleSaveNotes}
              onClose={() => setEditingPage(null)}
            />
          )}
        </Show>

        {/* Capture Preview Modal */}
        <Show when={capturePreview()}>
          {(preview) => (
            <CapturePreview
              data={preview()}
              onConfirm={handleConfirmCapture}
              onCancel={() => setCapturePreview(null)}
            />
          )}
        </Show>

        {/* Delete Forever Confirmation */}
        <Show when={deletingPage()}>
          {(page) => (
            <ConfirmDialog
              title="Delete forever"
              message={`Permanently delete "${page().title}"? This cannot be undone.`}
              confirmLabel="Delete Forever"
              destructive
              onConfirm={confirmDelete}
              onCancel={() => setDeletingPage(null)}
            />
          )}
        </Show>

        {/* Empty Trash Confirmation */}
        <Show when={emptyingTrash()}>
          <ConfirmDialog
            title="Empty trash"
            message={`Permanently delete all ${filteredPages().length} items in trash? This cannot be undone.`}
            confirmLabel="Empty Trash"
            destructive
            onConfirm={async () => {
              const trashPages = (allPages() || []).filter((t) => t.deletedAt);
              for (const page of trashPages) {
                await hardDeletePage(page.id);
              }
              setEmptyingTrash(false);
              loadData();
              notifyChanged();
            }}
            onCancel={() => setEmptyingTrash(false)}
          />
        </Show>
      </div>
    </div>
  );
}
