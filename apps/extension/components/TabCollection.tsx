import { createSignal, createMemo, onMount, onCleanup, For, Show } from "solid-js";
import { Maximize2, PanelRight, Settings as SettingsIcon, Menu, X, ExternalLink, ArrowRight, Trash2, Star, StickyNote, Calendar, Archive, Inbox } from "lucide-solid";
import { buildDomainIndex, getDomain, extractCreator } from "@/lib/domains";
import AppSidebar from "./AppSidebar";
import type {
  Tab,
  Group,
  Capture,
  Settings,
  CapturePreviewData,
} from "@/lib/types";
import {
  getAllTabs,
  getAllGroups,
  getAllCaptures,
  updateTab,
  updateGroup,
  softDeleteTab,
  hardDeleteTab,
  restoreTab,
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

interface TabCollectionProps {
  viewMode: Settings["viewMode"];
  onViewModeChange: (mode: "cards" | "rows") => void;
  showExpandButton?: boolean;
  onOpenSettings?: () => void;
}

export default function TabCollection(props: TabCollectionProps) {
  const [filter, setFilter] = createSignal<Settings["activeFilter"]>("all");
  const [deviceFilter, setDeviceFilter] = createSignal<string>("all");
  const [domainFilter, setDomainFilter] = createSignal<string | null>(null);
  const [creatorFilter, setCreatorFilter] = createSignal<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [openMode, setOpenMode] = createSignal<"new-tab" | "current-tab">("new-tab");
  const [syncError, setSyncError] = createSignal<string | null>(null);
  let searchBarApi: { setSearch: (q: string) => void } | undefined;
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [searchResults, setSearchResults] = createSignal<Tab[] | null>(null);
  const [editingTab, setEditingTab] = createSignal<Tab | null>(null);
  const [deletingTab, setDeletingTab] = createSignal<Tab | null>(null);
  const [emptyingTrash, setEmptyingTrash] = createSignal(false);
  const [capturePreview, setCapturePreview] =
    createSignal<CapturePreviewData | null>(null);

  const [allTabs, setAllTabs] = createSignal<Tab[]>([]);
  const [allGroups, setAllGroups] = createSignal<Group[]>([]);
  const [allCaptures, setAllCaptures] = createSignal<Capture[]>([]);

  const loadData = async () => {
    const [tabs, groups, captures] = await Promise.all([
      getAllTabs(),
      getAllGroups(),
      getAllCaptures(),
    ]);
    setAllTabs(tabs);
    setAllGroups(groups);
    setAllCaptures(captures);
  };

  // Update a single tab in place without refetching everything
  const patchTab = (id: string, updates: Partial<Tab>) => {
    setAllTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  };

  // Remove a tab from the local list
  const removeTab = (id: string) => {
    setAllTabs((prev) => prev.filter((t) => t.id !== id));
  };

  // Full refresh (for captures, syncs, bulk changes)
  const refresh = () => loadData();

  // Listen for data changes from background worker
  onMount(() => {
    loadData();
    getSettings().then((s) => {
      setOpenMode(s.openMode || "new-tab");
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
  });

  const filteredGroups = createMemo(() => {
    const groups = allGroups() || [];
    const f = filter();

    let filtered: Group[];
    if (f === "archived") {
      // Show all groups -- archived tabs can live in any group
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

  const domainIndex = createMemo(() => buildDomainIndex(allTabs() || []));

  const tagIndex = createMemo(() => {
    const tabs = allTabs() || [];
    const counts = new Map<string, number>();
    for (const tab of tabs) {
      if (tab.deletedAt || !tab.tags) continue;
      for (const tag of tab.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  });

  const uniqueDevices = createMemo(() => {
    const tabs = allTabs() || [];
    const deviceMap = new Map<string, string>();
    for (const t of tabs) {
      const id = t.deviceId || t.sourceLabel;
      if (id && !deviceMap.has(id)) {
        deviceMap.set(id, t.sourceLabel);
      }
    }
    return Array.from(deviceMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  const filteredTabs = createMemo(() => {
    let tabs = searchResults() || allTabs() || [];
    const f = filter();
    const device = deviceFilter();

    // Apply device filter
    if (device !== "all") {
      tabs = tabs.filter((t) => (t.deviceId || t.sourceLabel) === device);
    }

    if (f === "trash") return tabs.filter((t) => t.deletedAt !== null && t.deletedAt !== undefined);

    // All non-trash views exclude soft-deleted tabs
    tabs = tabs.filter((t) => !t.deletedAt);

    // Apply domain filter
    const domain = domainFilter();
    if (domain) {
      tabs = tabs.filter((t) => getDomain(t.url) === domain);
      // Apply creator filter within domain
      const creator = creatorFilter();
      if (creator) {
        tabs = tabs.filter((t) => extractCreator(t) === creator);
      }
    }

    if (f === "archived") return tabs.filter((t) => t.archived);
    if (f === "starred") return tabs.filter((t) => t.starred && !t.archived);
    if (f === "notes") return tabs.filter((t) => t.notes && !t.archived);
    if (f === "duplicates") {
      const live = tabs.filter((t) => !t.archived);
      const urlCount = new Map<string, number>();
      for (const t of live) {
        const normalized = t.url.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
        urlCount.set(normalized, (urlCount.get(normalized) || 0) + 1);
      }
      return live.filter((t) => {
        const normalized = t.url.replace(/\/$/, "").replace(/^https?:\/\/www\./, "https://");
        return urlCount.get(normalized)! > 1;
      });
    }
    return tabs.filter((t) => !t.archived);
  });

  const tabsForGroup = (groupId: string) => {
    return filteredTabs().filter((t) => t.groupId === groupId);
  };

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const tabDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (tabDay.getTime() === today.getTime()) return "Today";
    if (tabDay.getTime() === yesterday.getTime()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const tabsByDate = createMemo(() => {
    const tabs = filteredTabs();
    const groups = new Map<string, { label: string; tabs: Tab[] }>();

    // Sort by capturedAt descending
    const sorted = [...tabs].sort((a, b) =>
      b.capturedAt.localeCompare(a.capturedAt),
    );

    for (const tab of sorted) {
      const dayKey = tab.capturedAt.slice(0, 10); // YYYY-MM-DD
      if (!groups.has(dayKey)) {
        groups.set(dayKey, { label: formatDateLabel(tab.capturedAt), tabs: [] });
      }
      groups.get(dayKey)!.tabs.push(tab);
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
    const response = await sendMessage({ type: "SEARCH_TABS", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.tabs);
      setSearchQuery(query);
    }
  };

  const handleAISearch = async (query: string) => {
    const response = await sendMessage({ type: "AI_SEARCH", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.tabs);
    }
  };

  /** Notify other views that data changed */
  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const handleOpenTab = async (tab: Tab) => {
    await sendMessage({ type: "OPEN_TAB", tabId: tab.id });
    patchTab(tab.id, { viewCount: tab.viewCount + 1, lastViewedAt: new Date().toISOString() });
  };

  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    patchTab(tabId, { notes: notes || null });
    notifyChanged();
  };

  const handleToggleStar = async (tab: Tab) => {
    const starred = !tab.starred;
    await updateTab(tab.id, { starred });
    patchTab(tab.id, { starred });
    notifyChanged();
  };

  const handleArchive = async (tab: Tab) => {
    const archived = !tab.archived;
    await updateTab(tab.id, { archived });
    patchTab(tab.id, { archived });
    notifyChanged();
  };

  const handleDelete = async (tab: Tab) => {
    await softDeleteTab(tab.id);
    patchTab(tab.id, { deletedAt: new Date().toISOString() });
    notifyChanged();
  };

  const handleRestore = async (tab: Tab) => {
    await restoreTab(tab.id);
    patchTab(tab.id, { deletedAt: null });
    notifyChanged();
  };

  const handleHardDelete = (tab: Tab) => {
    setDeletingTab(tab);
  };

  const [blockingTab, setBlockingTab] = createSignal<Tab | null>(null);

  const handleBlockDomain = (tab: Tab) => {
    setBlockingTab(tab);
  };

  const confirmBlockDomain = async () => {
    const tab = blockingTab();
    if (tab) {
      const domain = (() => {
        try { return new URL(tab.url).hostname.replace("www.", ""); }
        catch { return ""; }
      })();
      if (domain) {
        const settings = await getSettings();
        const blocked = [...(settings.blockedDomains || [])];
        if (!blocked.includes(domain)) {
          blocked.push(domain);
          await updateSettings({ blockedDomains: blocked });
          notifyChanged();
        }
      }
      setBlockingTab(null);
    }
  };

  const confirmDelete = async () => {
    const tab = deletingTab();
    if (tab) {
      await hardDeleteTab(tab.id);
      setDeletingTab(null);
      removeTab(tab.id);
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

  const openSidePanel = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.sidePanel.open({ tabId: tab.id });
    }
  };

  const openFullPage = async () => {
    await browser.tabs.create({ url: browser.runtime.getURL("/tabs.html") });
    // Close the side panel if we're in one
    if (props.showExpandButton) {
      window.close();
    }
  };

  return (
    <div class="flex h-full bg-background text-foreground @container">
      {/* Sidebar - persistent when container is wide enough */}
      <div class="hidden @[768px]:flex w-72 flex-shrink-0 h-full">
        <AppSidebar
          domains={domainIndex()}
          activeDomain={domainFilter()}
          activeCreator={creatorFilter()}
          onSelectDomain={(d) => { setDomainFilter(d); setCreatorFilter(null); }}
          onSelectCreator={(d, c) => { setDomainFilter(d); setCreatorFilter(c); }}
          totalCount={(allTabs() || []).filter((t) => !t.deletedAt && !t.archived).length}
        />
      </div>

      {/* Sidebar drawer overlay for narrow views */}
      <Show when={sidebarOpen()}>
        <div class="fixed inset-0 z-40 flex @[768px]:hidden">
          <div class="w-64 h-full bg-background overflow-y-auto">
            <AppSidebar
              domains={domainIndex()}
              activeDomain={domainFilter()}
              activeCreator={creatorFilter()}
              onSelectDomain={(d) => { setDomainFilter(d); setCreatorFilter(null); }}
              onSelectCreator={(d, c) => { setDomainFilter(d); setCreatorFilter(c); if (c) setSidebarOpen(false); }}
              totalCount={(allTabs() || []).filter((t) => !t.deletedAt && !t.archived).length}
            />
          </div>
          <div class="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 flex flex-col h-full min-w-0">
        {/* Top Bar */}
        <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
          <div class="flex items-center gap-2">
            {/* Hamburger - visible only when sidebar is hidden */}
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors @[768px]:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen())}
              title="Browse domains"
            >
              <Menu size={16} />
            </button>
            <h1 class="text-base font-semibold text-foreground">
              Tab Zen
              <Show when={domainFilter()}>
                <span class="text-muted-foreground font-normal">
                  {" / "}{domainFilter()}
                  <Show when={creatorFilter()}>
                    {" / "}{creatorFilter()}
                  </Show>
                </span>
              </Show>
            </h1>
          </div>
          <div class="flex items-center gap-2">
            <ViewToggle
              mode={props.viewMode}
              onChange={props.onViewModeChange}
            />
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => {
                const next = openMode() === "new-tab" ? "current-tab" : "new-tab";
                setOpenMode(next);
                updateSettings({ openMode: next });
              }}
              title={openMode() === "new-tab" ? "Opens in new tab (click to change)" : "Opens in current tab (click to change)"}
            >
              {openMode() === "new-tab" ? <ExternalLink size={15} /> : <ArrowRight size={15} />}
            </button>
            <Show when={props.showExpandButton}>
              <button
                class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={openFullPage}
                title="Open full page"
              >
                <Maximize2 size={15} />
              </button>
            </Show>
            <Show when={!props.showExpandButton}>
              <button
                class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={openSidePanel}
                title="Open side panel"
              >
                <PanelRight size={15} />
              </button>
            </Show>
            <button
              class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => props.onOpenSettings?.()}
              title="Settings"
            >
              <SettingsIcon size={15} />
            </button>
          </div>
        </div>

      {/* Sync error banner */}
      <Show when={syncError()}>
        <div class="mx-4 mt-2 flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2">
          <p class="text-xs text-red-300">{syncError()}</p>
          <div class="flex items-center gap-2">
            <button
              class="text-xs text-red-300 hover:text-red-200 transition-colors"
              onClick={() => props.onOpenSettings?.()}
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

      <SearchBar
        onSearch={handleSearch}
        onAISearch={handleAISearch}
        tags={tagIndex()}
        onInit={(api) => { searchBarApi = api; }}
      />
      <div class="flex items-center gap-2 px-4 pb-4">
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
        <Show when={(allTabs() || []).filter((t) => !t.deletedAt).length > 0} fallback={<EmptyState />}>
          {/* Notes view */}
          <Show when={filter() === "notes"}>
            <Show
              when={filteredTabs().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div class="text-muted-foreground/40 mb-5"><StickyNote size={52} /></div>
                  <h2 class="text-base font-semibold text-foreground mb-2">No notes yet</h2>
                  <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Add notes to any tab to see them here.</p>
                </div>
              }
            >
              <div class="grid grid-cols-1 @[600px]:grid-cols-2 @[900px]:grid-cols-3 gap-4 p-4">
                <For each={filteredTabs()}>
                  {(tab) => (
                    <NoteCard
                      tab={tab}
                      onOpen={handleOpenTab}
                      onEditNotes={setEditingTab}
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>

          {/* By Date view */}
          <Show when={filter() === "byDate"}>
            <Show
              when={filteredTabs().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div class="text-muted-foreground/40 mb-5"><Calendar size={52} /></div>
                  <h2 class="text-base font-semibold text-foreground mb-2">No tabs saved yet</h2>
                  <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Capture some tabs to see them organized by date.</p>
                </div>
              }
            >
              <For each={tabsByDate()}>
                {(dateGroup) => (
                  <GroupSection
                    group={{
                      id: dateGroup.label,
                      name: dateGroup.label,
                      captureId: "",
                      position: 0,
                      archived: false,
                    }}
                    tabs={dateGroup.tabs}
                    viewMode={props.viewMode}
                    searchQuery={searchQuery()}
                    onOpenTab={handleOpenTab}
                    onEditNotes={setEditingTab}
                    onRenameGroup={() => {}}
                    onToggleStar={handleToggleStar}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onBlockDomain={handleBlockDomain}
                    onSelectCreator={(d, c) => { setDomainFilter(d); setCreatorFilter(c); }}
                    onTagClick={handleTagClick}
                    onExpandTab={(tab) => {
                      const detailUrl = browser.runtime.getURL(`/detail.html?tabId=${tab.id}`);
                      window.open(detailUrl, "_blank");
                    }}
                  />
                )}
              </For>
            </Show>
          </Show>

          {/* Trash view */}
          <Show when={filter() === "trash"}>
            <div class="mx-4 mt-3 mb-4 px-4 py-3 bg-muted/30 rounded-xl flex items-center justify-between gap-4">
              <div class="flex items-center gap-2.5 min-w-0">
                <Trash2 size={15} class="text-muted-foreground/50 flex-shrink-0" />
                <span class="text-sm text-muted-foreground">
                  Items are automatically deleted after 30 days
                </span>
              </div>
              <Show when={filteredTabs().length > 0}>
                <button
                  class="text-sm font-medium text-red-400/80 hover:text-red-400 transition-colors flex-shrink-0 px-3 py-1 rounded-full hover:bg-red-400/10"
                  onClick={() => setEmptyingTrash(true)}
                >
                  Empty Now
                </button>
              </Show>
            </div>
            <Show
              when={filteredTabs().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div class="text-muted-foreground/40 mb-5"><Trash2 size={52} /></div>
                  <h2 class="text-base font-semibold text-foreground mb-2">Trash is empty</h2>
                  <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Deleted tabs will appear here.</p>
                </div>
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
              tabs={filteredTabs()}
              viewMode={props.viewMode}
              onOpenTab={handleOpenTab}
              onEditNotes={setEditingTab}
              onRenameGroup={() => {}}
              onToggleStar={handleToggleStar}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onHardDelete={handleHardDelete}
              onExpandTab={(tab) => {
                const detailUrl = browser.runtime.getURL(`/detail.html?tabId=${tab.id}`);
                window.open(detailUrl, "_blank");
              }}
              isTrash
            />
            </Show>
          </Show>

          {/* Default group view (All, Starred, Archived, Duplicates) */}
          <Show when={filter() !== "notes" && filter() !== "byDate" && filter() !== "trash"}>
            <Show
              when={filteredTabs().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
                  {filter() === "starred" ? (
                    <>
                      <div class="text-muted-foreground/40 mb-5"><Star size={52} /></div>
                      <h2 class="text-base font-semibold text-foreground mb-2">No starred tabs</h2>
                      <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Star tabs to quickly find them later.</p>
                    </>
                  ) : filter() === "archived" ? (
                    <>
                      <div class="text-muted-foreground/40 mb-5"><Archive size={52} /></div>
                      <h2 class="text-base font-semibold text-foreground mb-2">No archived tabs</h2>
                      <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Archive tabs to declutter without deleting.</p>
                    </>
                  ) : (
                    <>
                      <div class="text-muted-foreground/40 mb-5"><Inbox size={52} /></div>
                      <h2 class="text-base font-semibold text-foreground mb-2">No tabs to show</h2>
                      <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Capture some tabs to get started.</p>
                    </>
                  )}
                </div>
              }
            >
              <For each={filteredGroups()}>
                {(group) => {
                  const tabs = () => tabsForGroup(group.id);
                  return (
                    <Show when={tabs().length > 0}>
                      <GroupSection
                        group={group}
                        tabs={tabs()}
                        viewMode={props.viewMode}
                        searchQuery={searchQuery()}
                        onOpenTab={handleOpenTab}
                        onEditNotes={setEditingTab}
                        onRenameGroup={handleRenameGroup}
                        onToggleStar={handleToggleStar}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onBlockDomain={handleBlockDomain}
                        onExpandTab={(tab) => {
                          const detailUrl = browser.runtime.getURL(`/detail.html?tabId=${tab.id}`);
                          window.open(detailUrl, "_blank");
                        }}
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
      <Show when={editingTab()}>
        {(tab) => (
          <NotesEditor
            tab={tab()}
            onSave={handleSaveNotes}
            onClose={() => setEditingTab(null)}
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
      <Show when={deletingTab()}>
        {(tab) => (
          <ConfirmDialog
            title="Delete forever"
            message={`Permanently delete "${tab().title}"? This cannot be undone.`}
            confirmLabel="Delete Forever"
            destructive
            onConfirm={confirmDelete}
            onCancel={() => setDeletingTab(null)}
          />
        )}
      </Show>

      {/* Block Domain Confirmation */}
      <Show when={blockingTab()}>
        {(tab) => {
          const domain = () => {
            try { return new URL(tab().url).hostname.replace("www.", ""); }
            catch { return tab().url; }
          };
          return (
            <ConfirmDialog
              title="Block domain"
              message={`Block "${domain()}"? Future captures will skip all tabs from this domain. You can unblock it in Settings.`}
              confirmLabel="Block"
              onConfirm={confirmBlockDomain}
              onCancel={() => setBlockingTab(null)}
            />
          );
        }}
      </Show>

      {/* Empty Trash Confirmation */}
      <Show when={emptyingTrash()}>
        <ConfirmDialog
          title="Empty trash"
          message={`Permanently delete all ${filteredTabs().length} items in trash? This cannot be undone.`}
          confirmLabel="Empty Trash"
          destructive
          onConfirm={async () => {
            const trashTabs = (allTabs() || []).filter((t) => t.deletedAt);
            for (const tab of trashTabs) {
              await hardDeleteTab(tab.id);
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
