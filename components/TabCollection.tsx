import { createSignal, createResource, For, Show } from "solid-js";
import { Maximize2, Settings as SettingsIcon } from "lucide-solid";
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
} from "@/lib/db";
import { sendMessage } from "@/lib/messages";
import GroupSection from "./GroupSection";
import SearchBar from "./SearchBar";
import FilterPills from "./FilterPills";
import ViewToggle from "./ViewToggle";
import NotesEditor from "./NotesEditor";
import CapturePreview from "./CapturePreview";
import EmptyState from "./EmptyState";

interface TabCollectionProps {
  viewMode: Settings["viewMode"];
  onViewModeChange: (mode: "cards" | "rows") => void;
  showExpandButton?: boolean;
  onOpenSettings?: () => void;
}

export default function TabCollection(props: TabCollectionProps) {
  const [filter, setFilter] = createSignal<Settings["activeFilter"]>("all");
  const [searchResults, setSearchResults] = createSignal<Tab[] | null>(null);
  const [editingTab, setEditingTab] = createSignal<Tab | null>(null);
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

  const filteredGroups = () => {
    const groups = allGroups() || [];
    const f = filter();

    let filtered: Group[];
    if (f === "archived") {
      filtered = groups.filter((g) => g.archived);
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

  const tabsForGroup = (groupId: string) => {
    const tabs = searchResults() || allTabs() || [];
    return tabs.filter((t) => t.groupId === groupId);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const response = await sendMessage({ type: "SEARCH_TABS", query });
    if (response.type === "SEARCH_RESULTS") {
      setSearchResults(response.tabs);
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

  const openFullPage = () => {
    browser.tabs.create({ url: browser.runtime.getURL("/tabs.html") });
  };

  return (
    <div class="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Top Bar */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 class="text-base font-bold text-slate-50">Tab Zen</h1>
        <div class="flex items-center gap-2">
          <ViewToggle
            mode={props.viewMode}
            onChange={props.onViewModeChange}
          />
          <Show when={props.showExpandButton}>
            <button
              class="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-200"
              onClick={openFullPage}
              title="Open full page"
            >
              <Maximize2 size={14} />
            </button>
          </Show>
          <button
            class="w-7 h-7 bg-slate-800 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-200"
            onClick={() => props.onOpenSettings?.()}
            title="Settings"
          >
            <SettingsIcon size={14} />
          </button>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} onAISearch={handleAISearch} />
      <FilterPills active={filter()} onChange={setFilter} />

      {/* Collection */}
      <div class="flex-1 overflow-y-auto">
        <Show when={(allTabs() || []).length > 0} fallback={<EmptyState />}>
          <For each={filteredGroups()}>
            {(group) => {
              const tabs = () => tabsForGroup(group.id);
              return (
                <Show when={tabs().length > 0}>
                  <GroupSection
                    group={group}
                    tabs={tabs()}
                    viewMode={props.viewMode}
                    onOpenTab={handleOpenTab}
                    onEditNotes={setEditingTab}
                    onRenameGroup={handleRenameGroup}
                  />
                </Show>
              );
            }}
          </For>
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
    </div>
  );
}
