import { createSignal, createEffect, on, Show, For } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import ConfirmDialog from "./ConfirmDialog";
import UserMenu from "./UserMenu";
import { useSettings } from "@/lib/hooks/useSettings";
import { Menu, Download, Upload, Keyboard, Trash2 } from "lucide-solid";
import StorageBadge from "./StorageBadge";
import {
  exportAsJson,
  exportAsHtmlBookmarks,
  importFromJson,
  downloadFile,
} from "@/lib/export";
import { clearAllData, clearProfileData } from "@/lib/db";
import SyncConfigPanel from "./settings/SyncConfigPanel";
import BlockedDomainsManager from "./settings/BlockedDomainsManager";
import TemplateManager from "./settings/TemplateManager";
import SkillManager from "./settings/SkillManager";

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsSection =
  | "general"
  | "models"
  | "api-keys"
  | "features"
  | "templates"
  | "skills"
  | "storage"
  | "domains"
  | "data";

const navGroups: { items: { key: SettingsSection; label: string }[] }[] = [
  {
    items: [{ key: "general", label: "General" }],
  },
  {
    items: [
      { key: "models", label: "Models" },
      { key: "api-keys", label: "API Keys" },
      { key: "features", label: "Features" },
      { key: "templates", label: "Templates" },
      { key: "skills", label: "Skills" },
    ],
  },
  {
    items: [
      { key: "storage", label: "Storage" },
      { key: "domains", label: "Blocked Domains" },
    ],
  },
  {
    items: [{ key: "data", label: "Data" }],
  },
];

const allSectionKeys = navGroups.flatMap(g => g.items.map(i => i.key));

function isValidSection(s: string): s is SettingsSection {
  return allSectionKeys.includes(s as SettingsSection);
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();
  const { settings, save: rawSave } = useSettings();
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [aiTestResult, setAiTestResult] = createSignal<{ ok: boolean; message: string } | null>(null);
  const [aiTesting, setAiTesting] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);

  const activeSection = (): SettingsSection => {
    const s = params.section;
    return s && isValidSection(s) ? s : "general";
  };

  const handleNavClick = (key: SettingsSection) => {
    navigate(`/settings/${key}`, { replace: true });
    setSidebarOpen(false);
  };

  const notifyChanged = () => {
    browser.runtime.sendMessage({ type: "DATA_CHANGED" }).catch(() => {});
  };

  const save: typeof rawSave = async (updates) => {
    setSaving(true);
    await rawSave(updates);
    setSaving(false);
    notifyChanged();
  };

  const handleExportJson = async () => {
    const json = await exportAsJson();
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `tab-zen-export-${date}.json`, "application/json");
  };

  const handleExportBookmarks = async () => {
    const html = await exportAsHtmlBookmarks();
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(html, `tab-zen-bookmarks-${date}.html`, "text/html");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const result = await importFromJson(text);
        setImportResult(
          `Imported ${result.imported} pages, skipped ${result.skipped} duplicates`,
        );
      } catch (err) {
        setImportResult(`Import failed: ${err}`);
      }
    };
    input.click();
  };

  const sidebarNav = (onItemClick?: () => void) => (
    <>
      {/* App header */}
      <div class="h-16 flex items-center px-5">
        <button onClick={() => navigate("/")} class="text-sm font-bold text-foreground hover:text-foreground/80 transition-colors">Tab Zen</button>
      </div>
      <div class="mx-5 border-b-3 border-muted-foreground/10" />

      {/* Nav items */}
      <nav class="flex flex-col gap-0.5 px-5 pt-6">
        <For each={navGroups}>
          {(group, groupIndex) => (
            <>
              <Show when={groupIndex() > 0}>
                <div class="my-3 border-b border-muted-foreground/10" />
              </Show>
              <For each={group.items}>
                {(item) => (
                  <button
                    class={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      activeSection() === item.key
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    onClick={() => {
                      handleNavClick(item.key);
                      onItemClick?.();
                    }}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </>
          )}
        </For>
      </nav>

      {/* Footer */}
      <div class="mt-auto px-5 pb-5 pt-6 space-y-2">
        <button
          onClick={() => navigate("/")}
          class="w-full flex items-center px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
        >
          Collections
        </button>
      </div>
    </>
  );

  return (
    <div class="flex h-full bg-background text-foreground @container">
      {/* Sidebar - persistent when container is wide enough */}
      <div class="hidden @[768px]:block w-72 flex-shrink-0 h-full bg-[#161618] overflow-y-auto scrollbar-hide flex-col">
        {sidebarNav()}
      </div>

      {/* Sidebar drawer overlay for narrow views */}
      <Show when={sidebarOpen()}>
        <div class="fixed inset-0 z-40 flex @[768px]:hidden">
          <div class="w-64 h-full bg-[#161618] overflow-y-auto flex flex-col">
            {sidebarNav(() => setSidebarOpen(false))}
          </div>
          <div
            class="flex-1 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      </Show>

      {/* Content column */}
      <div class="flex-1 min-w-0 flex flex-col h-full">
        {/* Content header — matches Collections top bar */}
        <div class="flex items-center gap-2 px-4 py-4 bg-background border-b-3 border-[#161618] flex-shrink-0">
          {/* Hamburger - visible only when sidebar is hidden */}
          <button
            class="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors @[768px]:hidden flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen())}
            title="Settings navigation"
          >
            <Menu size={16} />
          </button>

          <span class="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
            Settings
            <span class="text-muted-foreground font-normal">
              {" / "}
              {navGroups.flatMap(g => g.items).find(i => i.key === activeSection())?.label}
            </span>
          </span>

          <span class="text-xs text-muted-foreground/40 flex-shrink-0">v{browser.runtime.getManifest().version}</span>

          <StorageBadge />

          <div class="w-px h-5 bg-muted-foreground/20 flex-shrink-0 mx-2" />

          <UserMenu />
        </div>

        {/* Scrollable content */}
        <div class="flex-1 overflow-y-auto">
        <Show when={settings()}>
          {(s) => (
            <div class="max-w-2xl mx-auto p-8 space-y-4">

              {/* General */}
              <Show when={activeSection() === "general"}>
                <div class="space-y-6">
                  <div>
                    <label class="block text-sm text-muted-foreground mb-1.5">
                      Browser / Profile Name
                    </label>
                    <input
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                      value={s().sourceLabel}
                      onChange={(e) => save({ sourceLabel: e.currentTarget.value })}
                    />
                    <p class="text-xs text-muted-foreground mt-1.5">
                      Tags your captures so you know where they came from
                    </p>
                  </div>
                  <div class="bg-muted/20 px-4 py-4 rounded-lg">
                    <div class="flex items-center justify-between mb-3">
                      <div>
                        <p class="text-sm text-foreground">Capture button on pages</p>
                        <p class="text-xs text-muted-foreground mt-0.5">Show a floating save button on every web page</p>
                      </div>
                      <button
                        class={`w-10 h-6 rounded-full transition-colors ${
                          s().notchEnabled ? "bg-sky-500" : "bg-muted/60"
                        }`}
                        onClick={() => save({ notchEnabled: !s().notchEnabled })}
                      >
                        <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                          s().notchEnabled ? "translate-x-4" : "translate-x-0"
                        }`} />
                      </button>
                    </div>
                    <Show when={s().notchEnabled}>
                      <div>
                        <label class="block text-sm text-muted-foreground mb-1.5">
                          Button position
                        </label>
                        <div class="inline-flex bg-muted/40 rounded-lg p-1">
                          <button
                            class={`px-3 py-1 text-sm rounded-md transition-colors ${
                              s().notchSide === "left"
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => save({ notchSide: "left" })}
                          >
                            Left
                          </button>
                          <button
                            class={`px-3 py-1 text-sm rounded-md transition-colors ${
                              s().notchSide === "right"
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => save({ notchSide: "right" })}
                          >
                            Right
                          </button>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Models */}
              <Show when={activeSection() === "models"}>
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm text-muted-foreground mb-1.5">
                      AI Model
                    </label>
                    <select
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                      value={s().aiModel}
                      onChange={(e) => save({ aiModel: e.currentTarget.value })}
                    >
                      <option value="openai/gpt-4o-mini">GPT-4o Mini (default)</option>
                      <option value="openai/gpt-4o">GPT-4o</option>
                      <option value="anthropic/claude-haiku-4-5-20251001">Claude Haiku</option>
                      <option value="anthropic/claude-sonnet-4-6">Claude Sonnet</option>
                      <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash</option>
                      <option value="google/gemma-4-26b-a4b-it">Gemma 4 26B</option>
                      <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                    </select>
                    <p class="text-xs text-muted-foreground mt-1.5">
                      Used for grouping, tagging, and document generation
                    </p>
                  </div>
                  <div>
                    <label class="block text-sm text-muted-foreground mb-1.5">
                      Chat Model
                    </label>
                    <select
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                      value={s().chatModel}
                      onChange={(e) => save({ chatModel: e.currentTarget.value })}
                    >
                      <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="anthropic/claude-haiku-4">Claude Haiku 4</option>
                      <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                      <option value="openai/gpt-4o">GPT-4o</option>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </select>
                    <p class="text-xs text-muted-foreground mt-1.5">
                      Used for document chat conversations
                    </p>
                  </div>
                </div>
              </Show>

              {/* API Keys */}
              <Show when={activeSection() === "api-keys"}>
                <div class="space-y-5">
                  <div>
                    <label class="block text-sm text-muted-foreground mb-1.5">
                      OpenRouter API Key
                    </label>
                    <div class="flex gap-2">
                      <input
                        class="flex-1 bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors"
                        type="password"
                        value={s().openRouterApiKey}
                        onChange={(e) => save({ openRouterApiKey: e.currentTarget.value })}
                        placeholder="sk-or-..."
                      />
                      <button
                        class="px-3 py-2 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex-shrink-0"
                        disabled={aiTesting() || !s().openRouterApiKey}
                        onClick={async () => {
                          setAiTesting(true);
                          setAiTestResult(null);
                          try {
                            const response = await fetch("https://openrouter.ai/api/v1/models", {
                              headers: { Authorization: `Bearer ${s().openRouterApiKey}` },
                              signal: AbortSignal.timeout(5000),
                            });
                            if (response.ok) {
                              setAiTestResult({ ok: true, message: "API key is valid" });
                            } else {
                              setAiTestResult({ ok: false, message: `Invalid key (${response.status})` });
                            }
                          } catch (e) {
                            setAiTestResult({ ok: false, message: "Could not reach OpenRouter" });
                          }
                          setAiTesting(false);
                        }}
                      >
                        {aiTesting() ? "Testing..." : "Test"}
                      </button>
                    </div>
                    <Show when={aiTestResult()}>
                      {(result) => (
                        <div class="flex items-center gap-2 mt-2">
                          <div class={`w-2 h-2 rounded-full ${result().ok ? "bg-green-500" : "bg-red-500"}`} />
                          <span class={`text-xs ${result().ok ? "text-green-400" : "text-muted-foreground"}`}>
                            {result().message}
                          </span>
                        </div>
                      )}
                    </Show>
                    <p class="text-xs text-muted-foreground mt-1.5">
                      Required for AI features. Without a key, pages are grouped by domain.
                    </p>
                  </div>

                  <div class="border-b border-muted-foreground/10" />

                  <div>
                    <label class="block text-sm text-muted-foreground mb-1.5">
                      Groq API Key
                      {s().groqApiKey && (
                        <span class="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Voice enabled
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground/40"
                      value={s().groqApiKey}
                      placeholder="gsk_..."
                      onInput={(e) => save({ groqApiKey: e.currentTarget.value.trim() })}
                    />
                    <p class="text-xs text-muted-foreground mt-1.5">
                      Optional — enables voice input in chat via Whisper transcription
                    </p>
                  </div>
                </div>
              </Show>

              {/* Features */}
              <Show when={activeSection() === "features"}>
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm text-foreground">Auto-tag pages on capture</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Generate tags when pages are saved</p>
                    </div>
                    <button
                      class={`w-10 h-6 rounded-full transition-colors ${
                        s().autoTagging ? "bg-sky-500" : "bg-muted/60"
                      }`}
                      onClick={() => save({ autoTagging: !s().autoTagging })}
                      disabled={!s().openRouterApiKey}
                    >
                      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                        s().autoTagging ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm text-foreground">Auto-generate chapters for videos</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Create chapter headings from video transcripts</p>
                    </div>
                    <button
                      class={`w-10 h-6 rounded-full transition-colors ${
                        s().autoChapters ? "bg-sky-500" : "bg-muted/60"
                      }`}
                      onClick={() => save({ autoChapters: !s().autoChapters })}
                      disabled={!s().openRouterApiKey}
                    >
                      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                        s().autoChapters ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm text-foreground">Content compression</p>
                      <p class="text-xs text-muted-foreground mt-0.5">Compress long documents to save tokens in chat (50-70% savings)</p>
                    </div>
                    <button
                      class={`w-10 h-6 rounded-full transition-colors ${
                        s().chatCompression ? "bg-sky-500" : "bg-muted/60"
                      }`}
                      onClick={() => save({ chatCompression: !s().chatCompression })}
                    >
                      <div class={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${
                        s().chatCompression ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                </div>
              </Show>

              {/* Templates */}
              <Show when={activeSection() === "templates"}>
                <TemplateManager />
              </Show>

              {/* Skills */}
              <Show when={activeSection() === "skills"}>
                <SkillManager />
              </Show>

              {/* Storage */}
              <Show when={activeSection() === "storage"}>
                <SyncConfigPanel settings={s()} save={save} />
              </Show>

              {/* Blocked Domains */}
              <Show when={activeSection() === "domains"}>
                <BlockedDomainsManager settings={s()} save={save} />
              </Show>

              {/* Data */}
              <Show when={activeSection() === "data"}>
                <div class="space-y-6">
                  {/* Export */}
                  <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 px-1">Export</p>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                      onClick={handleExportJson}
                    >
                      <div class="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
                        <Download size={14} class="text-muted-foreground" />
                      </div>
                      <div>
                        <p class="text-sm text-foreground">Export as JSON</p>
                        <p class="text-xs text-muted-foreground mt-0.5">Full backup of all pages, groups, and captures</p>
                      </div>
                    </button>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                      onClick={handleExportBookmarks}
                    >
                      <div class="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
                        <Download size={14} class="text-muted-foreground" />
                      </div>
                      <div>
                        <p class="text-sm text-foreground">Export as Bookmarks</p>
                        <p class="text-xs text-muted-foreground mt-0.5">HTML bookmark file compatible with any browser</p>
                      </div>
                    </button>
                  </div>

                  {/* Import */}
                  <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 px-1">Import</p>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                      onClick={handleImport}
                    >
                      <div class="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
                        <Upload size={14} class="text-muted-foreground" />
                      </div>
                      <div>
                        <p class="text-sm text-foreground">Import from JSON</p>
                        <p class="text-xs text-muted-foreground mt-0.5">Restore from a previous Tab Zen export</p>
                      </div>
                    </button>
                    <Show when={importResult()}>
                      <p class="text-sm text-muted-foreground px-1">{importResult()}</p>
                    </Show>
                  </div>

                  {/* Shortcuts */}
                  <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50 px-1">Shortcuts</p>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg hover:bg-muted/40 transition-colors text-left group"
                      onClick={() => browser.tabs.create({ url: "chrome://extensions/shortcuts" })}
                    >
                      <div class="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-muted/70 transition-colors">
                        <Keyboard size={14} class="text-muted-foreground" />
                      </div>
                      <div>
                        <p class="text-sm text-foreground">Keyboard Shortcuts</p>
                        <p class="text-xs text-muted-foreground mt-0.5">Configure hotkeys for quick capture and navigation</p>
                      </div>
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-red-400/50 px-1">Danger Zone</p>
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 bg-red-500/5 rounded-lg hover:bg-red-500/10 transition-colors text-left group"
                      onClick={() => setShowClearConfirm(true)}
                    >
                      <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/15 transition-colors">
                        <Trash2 size={14} class="text-red-400/70" />
                      </div>
                      <div>
                        <p class="text-sm text-red-300">Clear Data</p>
                        <p class="text-xs text-muted-foreground mt-0.5">Remove pages from this profile or clear everything</p>
                      </div>
                    </button>
                  </div>
                </div>
              </Show>

            </div>
          )}
        </Show>
        </div>
      </div>

      <Show when={showClearConfirm()}>
        {(() => {
          const [confirming, setConfirming] = createSignal<"profile" | "all" | null>(null);

          return (
            <>
              <Show when={!confirming()}>
                <div
                  class="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center transition-colors"
                  onClick={() => setShowClearConfirm(false)}
                >
                  <div
                    class="bg-card rounded-xl p-6 w-[400px] max-w-[90vw]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 class="text-base font-semibold text-foreground mb-4">Clear Data</h3>
                    <div class="space-y-3">
                      <button
                        class="w-full text-left bg-muted/30 rounded-lg p-4 hover:bg-muted/40 transition-colors"
                        onClick={() => setConfirming("profile")}
                      >
                        <p class="text-sm font-medium text-foreground">Clear this profile's data</p>
                        <p class="text-xs text-muted-foreground mt-1">
                          Only removes pages captured from "{settings()?.sourceLabel}". Data from other devices is kept.
                        </p>
                      </button>
                      <button
                        class="w-full text-left bg-red-500/10 rounded-lg p-4 hover:bg-red-500/15 transition-colors"
                        onClick={() => setConfirming("all")}
                      >
                        <p class="text-sm font-medium text-red-300">Clear all data</p>
                        <p class="text-xs text-muted-foreground mt-1">
                          Removes all pages, groups, and captures from every device. Cannot be undone.
                        </p>
                      </button>
                    </div>
                    <div class="mt-4">
                      <button
                        class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                        onClick={() => setShowClearConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </Show>

              <Show when={confirming() === "profile"}>
                <ConfirmDialog
                  title="Clear profile data"
                  message={`Remove all pages from "${settings()?.sourceLabel}"? Pages from other devices will be kept.`}
                  confirmLabel="Clear Profile"
                  destructive
                  onConfirm={async () => {
                    const s = settings();
                    if (s?.deviceId) await clearProfileData(s.deviceId);
                    notifyChanged();
                    setShowClearConfirm(false);
                    props.onClose();
                  }}
                  onCancel={() => setConfirming(null)}
                />
              </Show>

              <Show when={confirming() === "all"}>
                <ConfirmDialog
                  title="Clear all data"
                  message="Delete all pages, groups, and captures from every device? This cannot be undone."
                  confirmLabel="Clear Everything"
                  destructive
                  onConfirm={async () => {
                    await clearAllData();
                    notifyChanged();
                    setShowClearConfirm(false);
                    props.onClose();
                  }}
                  onCancel={() => setConfirming(null)}
                />
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
}
