import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import ConfirmDialog from "./ConfirmDialog";
import UserMenu from "./UserMenu";
import { useSettings } from "@/lib/hooks/useSettings";
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

interface SettingsPanelProps {
  onClose: () => void;
}

type SettingsTab = "general" | "ai" | "sync" | "domains" | "data";

export default function SettingsPanel(props: SettingsPanelProps) {
  const navigate = useNavigate();
  const { settings, save: rawSave } = useSettings();
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [aiTestResult, setAiTestResult] = createSignal<{ ok: boolean; message: string } | null>(null);
  const [aiTesting, setAiTesting] = createSignal(false);
  const [activeSettingsTab, setActiveSettingsTab] = createSignal<SettingsTab>("general");

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

  return (
    <div class="h-full bg-background text-foreground overflow-y-auto">
      {/* Header — matches detail page action bar */}
      <div class="flex items-center gap-2 px-4 py-4 bg-background border-b-3 border-[#161618] flex-shrink-0">
        <span class="text-sm font-medium text-foreground flex-1 min-w-0">Settings</span>

        <div class="w-6 flex-shrink-0" />
        <button
          onClick={() => navigate("/")}
          class="text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          Collections
        </button>

        <div class="w-px h-5 bg-muted-foreground/20 flex-shrink-0 mx-2" />

        <UserMenu />
      </div>

      <div class="flex gap-1.5 px-4 pt-4 pb-2.5 overflow-x-auto scrollbar-hide max-w-2xl mx-auto">
        {(
          [
            ["general", "General"],
            ["ai", "AI"],
            ["sync", "Sync"],
            ["domains", "Blocked Domains"],
            ["data", "Data"],
          ] as const
        ).map(([key, label]) => (
          <button
            class={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              activeSettingsTab() === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setActiveSettingsTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <Show when={settings()}>
        {(s) => (
          <div class="p-4 space-y-2 max-w-2xl mx-auto">

            {/* General tab */}
            <Show when={activeSettingsTab() === "general"}>
              <div class="space-y-4 px-1 py-3">
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
                <div class="pt-4 border-t border-muted-foreground/10">
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
                      <div class="flex gap-2">
                        <button
                          class={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                            s().notchSide === "left"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          onClick={() => save({ notchSide: "left" })}
                        >
                          Left
                        </button>
                        <button
                          class={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                            s().notchSide === "right"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
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

            {/* AI tab */}
            <Show when={activeSettingsTab() === "ai"}>
              <div class="space-y-4 px-1 py-3">
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
                </div>
                <div>
                  <label class="block text-sm text-muted-foreground mb-1.5">
                    Model
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
                    Without an API key, pages are grouped by domain
                  </p>
                </div>

                {/* Chat Model */}
                <div>
                  <label class="block text-sm font-medium text-foreground mb-1.5">Chat Model</label>
                  <p class="text-sm text-muted-foreground mb-2">Model used for document chat conversations</p>
                  <select
                    class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none"
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
                </div>

                {/* Chat Compression */}
                <div class="flex items-center justify-between">
                  <div>
                    <label class="block text-sm font-medium text-foreground">Content Compression</label>
                    <p class="text-sm text-muted-foreground">Compress long documents to save tokens in chat (50-70% savings)</p>
                  </div>
                  <button
                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      s().chatCompression ? "bg-sky-500" : "bg-muted"
                    }`}
                    onClick={() => save({ chatCompression: !s().chatCompression })}
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        s().chatCompression ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Groq API Key (Voice) */}
                <div>
                  <label class="block text-sm font-medium text-foreground mb-1.5">
                    Groq API Key
                    {s().groqApiKey && (
                      <span class="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        Voice enabled
                      </span>
                    )}
                  </label>
                  <p class="text-sm text-muted-foreground mb-2">Optional — enables voice input in chat (Whisper transcription)</p>
                  <input
                    type="password"
                    class="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                    value={s().groqApiKey}
                    placeholder="gsk_..."
                    onInput={(e) => save({ groqApiKey: e.currentTarget.value.trim() })}
                  />
                </div>

                <div class="pt-4 space-y-3">
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
                </div>
                <div class="pt-2">
                  <TemplateManager />
                </div>
              </div>
            </Show>

            {/* Sync tab */}
            <Show when={activeSettingsTab() === "sync"}>
              <SyncConfigPanel settings={s()} save={save} />
            </Show>

            {/* Blocked Domains tab */}
            <Show when={activeSettingsTab() === "domains"}>
              <BlockedDomainsManager settings={s()} save={save} />
            </Show>

            {/* Data tab */}
            <Show when={activeSettingsTab() === "data"}>
              <div class="px-1 py-3 space-y-4">
                <div class="flex flex-wrap gap-2">
                  <button
                    class="px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
                    onClick={handleExportJson}
                  >
                    Export JSON
                  </button>
                  <button
                    class="px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
                    onClick={handleExportBookmarks}
                  >
                    Export Bookmarks
                  </button>
                  <button
                    class="px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
                    onClick={handleImport}
                  >
                    Import JSON
                  </button>
                </div>
                <Show when={importResult()}>
                  <p class="text-xs text-muted-foreground">{importResult()}</p>
                </Show>
                <div>
                  <button
                    class="px-3 py-2 text-sm bg-muted/40 text-foreground rounded-lg hover:bg-muted/60 transition-colors"
                    onClick={() =>
                      browser.tabs.create({ url: "chrome://extensions/shortcuts" })
                    }
                  >
                    Configure Keyboard Shortcuts
                  </button>
                </div>
                <div class="pt-2">
                  <button
                    class="px-3 py-2 text-sm bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    Clear Data
                  </button>
                  <p class="text-xs text-muted-foreground mt-1.5">
                    Clear pages from this profile or all data
                  </p>
                </div>
              </div>
            </Show>

            {/* Version */}
            <div class="pt-4 pb-2 text-center">
              <p class="text-xs text-muted-foreground/40">
                Tab Zen v{browser.runtime.getManifest().version}
              </p>
            </div>
          </div>
        )}
      </Show>

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
