import { createSignal, createResource, onMount, onCleanup, For, Show } from "solid-js";
import { Maximize2, PanelRight, Settings as SettingsIcon, Menu, X, ExternalLink, ArrowRight } from "lucide-solid";
import { buildDomainIndex, getDomain, extractCreator } from "@/lib/domains";
import AppSidebar from "./AppSidebar";
import type {
  Tab,
  Group,
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
  const [searchQuery, setSearchQuery] = createSignal<string>("");
  const [searchResults, setSearchResults] = createSignal<Tab[] | null>(null);
  const [editingTab, setEditingTab] = createSignal<Tab | null>(null);
  const [deletingTab, setDeletingTab] = createSignal<Tab | null>(null);
  const [capturePreview, setCapturePreview] =
    createSignal<CapturePreviewData | null>(null);
  const [refreshKey, setRefreshKey] = createSignal(0);

  const [allTabs] = createResource(refreshKey, async () => getAllTabs());
  const [allGroups] = createResource(refreshKey, async () => getAllGroups());
  const [allCaptures] = createResource(
    refreshKey,
    async () => getAllCaptures(),
  );

  const refresh = () => setRefreshKey((k) => k + 1);

  // Listen for data changes from background worker
  onMount(() => {
    getSettings().then((s) => setOpenMode(s.openMode || "new-tab"));

    const listener = (message: any) => {
      if (message.type === "DATA_CHANGED") {
        refresh();
      }
    };
    browser.runtime.onMessage.addListener(listener);
    onCleanup(() => browser.runtime.onMessage.removeListener(listener));
  });

  const filteredGroups = () => {
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
  };

  const domainIndex = () => buildDomainIndex(allTabs() || []);

  const uniqueDevices = () => {
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
  };

  const filteredTabs = () => {
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
  };

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

  const tabsByDate = () => {
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

  const handleOpenTab = async (tab: Tab) => {
    await sendMessage({ type: "OPEN_TAB", tabId: tab.id });
    refresh();
  };

  const handleSaveNotes = async (tabId: string, notes: string) => {
    await updateTab(tabId, { notes: notes || null });
    refresh();
  };

  const handleToggleStar = async (tab: Tab) => {
    await updateTab(tab.id, { starred: !tab.starred });
    refresh();
  };

  const handleArchive = async (tab: Tab) => {
    await updateTab(tab.id, { archived: !tab.archived });
    refresh();
  };

  const handleDelete = async (tab: Tab) => {
    await softDeleteTab(tab.id);
    refresh();
  };

  const handleRestore = async (tab: Tab) => {
    await restoreTab(tab.id);
    refresh();
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
      refresh();
    }
  };

  const handleRenameGroup = async (group: Group, newName: string) => {
    await updateGroup(group.id, { name: newName });
    refresh();
  };

  const handleConfirmCapture = async () => {
    const preview = capturePreview();
    if (preview) {
      await sendMessage({ type: "CONFIRM_CAPTURE", captureData: preview });
      setCapturePreview(null);
      refresh();
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

  const isWide = () => !props.showExpandButton; // full page view

  return (
    <div class="flex h-full bg-background text-foreground">
      {/* Sidebar - persistent in full page, drawer in side panel */}
      <Show when={isWide()}>
        <div class="w-72 flex-shrink-0 h-full">
          <AppSidebar
            domains={domainIndex()}
            activeDomain={domainFilter()}
            activeCreator={creatorFilter()}
            onSelectDomain={(d) => { setDomainFilter(d); setCreatorFilter(null); }}
            onSelectCreator={(d, c) => { setDomainFilter(d); setCreatorFilter(c); }}
            totalCount={(allTabs() || []).filter((t) => !t.deletedAt && !t.archived).length}
          />
        </div>
      </Show>

      {/* Sidebar drawer overlay for narrow views */}
      <Show when={!isWide() && sidebarOpen()}>
        <div class="fixed inset-0 z-40 flex" onClick={() => setSidebarOpen(false)}>
          <div class="w-64 h-full bg-background" onClick={(e) => e.stopPropagation()}>
            <AppSidebar
              domains={domainIndex()}
              activeDomain={domainFilter()}
              activeCreator={creatorFilter()}
              onSelectDomain={(d) => { setDomainFilter(d); setCreatorFilter(null); setSidebarOpen(false); }}
              onSelectCreator={(d, c) => { setDomainFilter(d); setCreatorFilter(c); setSidebarOpen(false); }}
              totalCount={(allTabs() || []).filter((t) => !t.deletedAt && !t.archived).length}
            />
          </div>
          <div class="flex-1 bg-black/60" />
        </div>
      </Show>

      {/* Main content */}
      <div class="flex-1 flex flex-col h-full min-w-0">
        {/* Top Bar */}
        <div class="flex items-center justify-between px-4 py-3 bg-muted/30">
          <div class="flex items-center gap-2">
            <Show when={!isWide()}>
              <button
                class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setSidebarOpen(!sidebarOpen())}
                title="Browse domains"
              >
                <Menu size={16} />
              </button>
            </Show>
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

      <SearchBar onSearch={handleSearch} onAISearch={handleAISearch} />
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
        <Show when={(allTabs() || []).length > 0} fallback={<EmptyState />}>
          {/* Notes view */}
          <Show when={filter() === "notes"}>
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

          {/* By Date view */}
          <Show when={filter() === "byDate"}>
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
                />
              )}
            </For>
          </Show>

          {/* Trash view */}
          <Show when={filter() === "trash"}>
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
              isTrash
            />
          </Show>

          {/* Default group view (All, Starred, Archived, Duplicates) */}
          <Show when={filter() !== "notes" && filter() !== "byDate" && filter() !== "trash"}>
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
                    />
                  </Show>
                );
              }}
            </For>
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
      </div>
    </div>
  );
}
