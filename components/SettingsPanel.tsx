import { createSignal, createResource, Show } from "solid-js";
import { ArrowLeft, User, Sparkles, RefreshCw, Database, AlertTriangle, ShieldBan } from "lucide-solid";
import ConfirmDialog from "./ConfirmDialog";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  exportAsJson,
  exportAsHtmlBookmarks,
  importFromJson,
  downloadFile,
} from "@/lib/export";
import { clearAllData, clearProfileData } from "@/lib/db";
import { initSync, verifySync, checkConnection } from "@/lib/sync";
import { sendMessage } from "@/lib/messages";
import type { Settings } from "@/lib/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [settings, { refetch }] = createResource(refreshKey, async () => getSettings());
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);
  const [syncStatus, setSyncStatus] = createSignal<string | null>(null);
  const [syncLoading, setSyncLoading] = createSignal(false);
  const [connected, setConnected] = createSignal<boolean | null>(null);
  const [checking, setChecking] = createSignal(false);
  const [aiTestResult, setAiTestResult] = createSignal<{ ok: boolean; message: string } | null>(null);
  const [aiTesting, setAiTesting] = createSignal(false);

  const save = async (updates: Partial<Settings>) => {
    setSaving(true);
    await updateSettings(updates);
    setRefreshKey((k) => k + 1);
    setSaving(false);
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
          `Imported ${result.imported} tabs, skipped ${result.skipped} duplicates`,
        );
      } catch (err) {
        setImportResult(`Import failed: ${err}`);
      }
    };
    input.click();
  };

  return (
    <div class="h-full bg-background text-foreground overflow-y-auto">
      <div class="flex items-center justify-between px-4 py-3 border-b border-transparent">
        <h1 class="text-base font-bold text-foreground">Settings</h1>
        <button
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={props.onClose}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <Show when={settings()}>
        {(s) => (
          <div class="p-4 space-y-2 max-w-2xl mx-auto">

            {/* ═══ General ═══ */}
            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
              <User size={14} /> General
            </p>
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
            </div>

            {/* ═══ AI ═══ */}
            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
              <Sparkles size={14} /> AI
            </p>
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
                  Without an API key, tabs are grouped by domain
                </p>
              </div>
              <div class="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                <div>
                  <p class="text-sm text-foreground">AI Tab Grouping</p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Organize tabs into smart groups on capture
                  </p>
                </div>
                <button
                  class={`w-10 h-6 rounded-full transition-colors relative ${
                    s().aiGrouping ? "bg-green-600" : "bg-muted"
                  }`}
                  onClick={() => save({ aiGrouping: !s().aiGrouping })}
                >
                  <div
                    class={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                      s().aiGrouping ? "left-5" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* ═══ Sync ═══ */}
            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
              <RefreshCw size={14} /> Sync
            </p>
            <div class="px-1 py-3 space-y-4">

              {/* Environment toggle */}
              <div class="flex bg-muted/40 rounded-lg p-1 mb-4">
                <button
                  class={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                    s().syncEnv === "local"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => save({ syncEnv: "local" })}
                >
                  Local
                </button>
                <button
                  class={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                    s().syncEnv === "remote"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => save({ syncEnv: "remote" })}
                >
                  Remote
                </button>
              </div>

              {/* URL field - shown for both envs */}
              <div class="mb-4">
                <label class="block text-xs text-muted-foreground mb-1.5">
                  {s().syncEnv === "local" ? "Local URL" : "Remote URL"}
                </label>
                <input
                  class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
                  value={s().syncEnv === "local" ? (s().syncLocalUrl || "http://localhost:8787") : s().syncUrl}
                  onChange={(e) => {
                    if (s().syncEnv === "local") {
                      save({ syncLocalUrl: e.currentTarget.value });
                    } else {
                      save({ syncUrl: e.currentTarget.value });
                    }
                  }}
                  placeholder={s().syncEnv === "local" ? "http://localhost:8787" : "https://tab-zen-sync.your-subdomain.workers.dev"}
                />
                <Show when={s().syncEnv === "local"}>
                  <p class="text-xs text-muted-foreground mt-1.5">
                    Run <code class="text-foreground">bun run sync:dev</code> to start the local server
                  </p>
                </Show>
              </div>

              {/* Connection + token flow */}
              {(() => {
                const isLocal = () => s().syncEnv === "local";
                const activeToken = () => isLocal() ? s().syncLocalToken : s().syncToken;
                const tokenKey = () => isLocal() ? "syncLocalToken" : "syncToken";
                const [pasteMode, setPasteMode] = createSignal(false);
                const [pasteValue, setPasteValue] = createSignal("");

                const handlePasteConnect = async () => {
                  const token = pasteValue().trim();
                  if (!token) return;
                  setSyncLoading(true);
                  setSyncStatus(null);
                  await save({ [tokenKey()]: token, syncEnabled: true });
                  const valid = await verifySync();
                  if (valid) {
                    setSyncStatus("Connected! Syncing will start automatically.");
                  } else {
                    setSyncStatus("Invalid token or server unreachable.");
                    await save({ [tokenKey()]: null, syncEnabled: false });
                  }
                  setSyncLoading(false);
                };

                const handleConnect = async () => {
                  setChecking(true);
                  setConnected(null);
                  setSyncStatus(null);
                  const ok = await checkConnection();
                  setConnected(ok);
                  if (!ok) {
                    setSyncStatus(
                      isLocal()
                        ? "Cannot reach server. Run bun run sync:dev"
                        : "Cannot reach server. Check the URL."
                    );
                  }
                  setChecking(false);
                };

                const handleGenerateToken = async () => {
                  setSyncLoading(true);
                  setSyncStatus(null);
                  try {
                    const token = await initSync();
                    await save({ [tokenKey()]: token, syncEnabled: true });
                    setSyncStatus("Token generated!");
                  } catch (e) {
                    setConnected(false);
                    setSyncStatus(
                      isLocal()
                        ? "Failed. Is the server running? (bun run sync:dev)"
                        : `Failed: ${e}`
                    );
                  }
                  setSyncLoading(false);
                };

                return (
                  <div class="space-y-4">
                    <Show
                      when={activeToken()}
                      fallback={
                        <>
                          {/* Step 1: Connect */}
                          <div class="bg-muted/30 rounded-lg p-4">
                            <div class="flex items-center justify-between">
                              <div class="flex items-center gap-2">
                                <div class={`w-2.5 h-2.5 rounded-full ${
                                  connected() === true ? "bg-green-500" :
                                  connected() === false ? "bg-red-500" :
                                  "bg-muted-foreground/30"
                                }`} />
                                <span class="text-sm text-foreground">
                                  {connected() === true ? "Server reachable" :
                                   connected() === false ? "Unreachable" :
                                   "Not connected"}
                                </span>
                              </div>
                              <button
                                class="px-3 py-1.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                disabled={checking()}
                                onClick={handleConnect}
                              >
                                {checking() ? "Checking..." : connected() === true ? "Recheck" : "Connect"}
                              </button>
                            </div>
                            <Show when={syncStatus() && !connected()}>
                              <p class="text-xs text-muted-foreground mt-2">{syncStatus()}</p>
                            </Show>
                          </div>

                          {/* Step 2: Generate or paste token (only after connected) */}
                          <Show when={connected()}>
                            <Show
                              when={!pasteMode()}
                              fallback={
                                <div class="space-y-3">
                                  <input
                                    class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2.5 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
                                    placeholder="Paste sync token..."
                                    value={pasteValue()}
                                    onInput={(e) => setPasteValue(e.currentTarget.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handlePasteConnect()}
                                  />
                                  <div class="flex items-center gap-2">
                                    <button
                                      class="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                      disabled={syncLoading() || !pasteValue().trim()}
                                      onClick={handlePasteConnect}
                                    >
                                      {syncLoading() ? "Connecting..." : "Connect"}
                                    </button>
                                    <button
                                      class="px-4 py-2.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors"
                                      onClick={() => { setPasteMode(false); setPasteValue(""); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              }
                            >
                              <div class="flex items-center gap-2">
                                <button
                                  class="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                  disabled={syncLoading()}
                                  onClick={handleGenerateToken}
                                >
                                  {syncLoading() ? "Generating..." : "Generate New Token"}
                                </button>
                                <button
                                  class="px-4 py-2.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors"
                                  onClick={() => setPasteMode(true)}
                                >
                                  Paste Token
                                </button>
                              </div>
                            </Show>
                            <Show when={syncStatus() && connected()}>
                              <p class="text-xs text-green-400">{syncStatus()}</p>
                            </Show>
                          </Show>
                        </>
                      }
                    >
                      {/* Connected with token */}
                      <div class="space-y-3">
                        <div class="bg-muted/30 rounded-lg p-4">
                          <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                              <div class="w-2.5 h-2.5 rounded-full bg-green-500" />
                              <span class="text-sm text-foreground">Syncing</span>
                            </div>
                            <button
                              class="px-3 py-1.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                              disabled={syncLoading()}
                              onClick={async () => {
                                setSyncLoading(true);
                                setSyncStatus(null);
                                const response = await sendMessage({ type: "SYNC_NOW" });
                                if (response.type === "SYNC_COMPLETE") {
                                  setSyncStatus(`Synced! Pushed ${response.pushed} tabs, pulled ${response.pulled} new tabs.`);
                                  setConnected(true);
                                } else if (response.type === "ERROR") {
                                  setSyncStatus(`Sync failed: ${response.message}`);
                                }
                                setSyncLoading(false);
                              }}
                            >
                              {syncLoading() ? "Syncing..." : "Sync Now"}
                            </button>
                          </div>
                          <p class="text-xs text-muted-foreground mb-1.5">Token</p>
                          <div class="flex items-center gap-2">
                            <code class="text-xs text-foreground break-all flex-1">
                              {activeToken()}
                            </code>
                            <button
                              class="px-2.5 py-1 text-xs bg-muted/50 text-muted-foreground rounded-md hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                              onClick={() => navigator.clipboard.writeText(activeToken()!)}
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                        <button
                          class="px-3 py-2 text-sm bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors"
                          onClick={() => save({ [tokenKey()]: null, syncEnabled: false })}
                        >
                          Disconnect
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              })()}
            </div>

            {/* ═══ Data ═══ */}
            {/* ═══ Blocked Domains ═══ */}
            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
              <ShieldBan size={14} /> Blocked Domains
            </p>
            <div class="px-1 py-3 space-y-3">
              <p class="text-xs text-muted-foreground">
                Tabs from these domains will be skipped during capture.
              </p>
              <Show
                when={(s().blockedDomains || []).length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground/50">No blocked domains</p>
                }
              >
                <div class="space-y-1.5">
                  <For each={s().blockedDomains || []}>
                    {(domain) => (
                      <div class="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                        <span class="text-sm text-foreground">{domain}</span>
                        <button
                          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            const updated = (s().blockedDomains || []).filter((d) => d !== domain);
                            save({ blockedDomains: updated });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              {(() => {
                const [newDomain, setNewDomain] = createSignal("");
                const addDomain = () => {
                  const d = newDomain().trim().replace(/^https?:\/\//, "").replace("www.", "").replace(/\/.*$/, "");
                  if (d) {
                    const blocked = [...(s().blockedDomains || [])];
                    if (!blocked.includes(d)) {
                      blocked.push(d);
                      save({ blockedDomains: blocked });
                    }
                    setNewDomain("");
                  }
                };
                return (
                  <div class="flex gap-2">
                    <input
                      class="flex-1 bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:bg-muted/60 transition-colors placeholder:text-muted-foreground"
                      placeholder="Add domain (e.g. mail.google.com)"
                      value={newDomain()}
                      onInput={(e) => setNewDomain(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === "Enter" && addDomain()}
                    />
                    <button
                      class="px-3 py-2 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                      onClick={addDomain}
                    >
                      Add
                    </button>
                  </div>
                );
              })()}
            </div>

            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
              <Database size={14} /> Data
            </p>
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
            </div>

            {/* ═══ Danger Zone ═══ */}
            <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-red-400/70 bg-red-500/10 -mx-4 px-4 py-2.5 mt-2">
              <AlertTriangle size={14} /> Danger Zone
            </p>
            <div class="px-1 py-3">
              <button
                class="px-3 py-2 text-sm bg-red-900/30 text-red-300 rounded-lg hover:bg-red-900/50 transition-colors"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear Data
              </button>
              <p class="text-xs text-muted-foreground mt-1.5">
                Clear tabs from this profile or all data
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
                          Only removes tabs captured from "{settings()?.sourceLabel}". Data from other devices is kept.
                        </p>
                      </button>
                      <button
                        class="w-full text-left bg-red-500/10 rounded-lg p-4 hover:bg-red-500/15 transition-colors"
                        onClick={() => setConfirming("all")}
                      >
                        <p class="text-sm font-medium text-red-300">Clear all data</p>
                        <p class="text-xs text-muted-foreground mt-1">
                          Removes all tabs, groups, and captures from every device. Cannot be undone.
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
                  message={`Remove all tabs from "${settings()?.sourceLabel}"? Tabs from other devices will be kept.`}
                  confirmLabel="Clear Profile"
                  destructive
                  onConfirm={async () => {
                    const s = settings();
                    if (s?.deviceId) await clearProfileData(s.deviceId);
                    setShowClearConfirm(false);
                    props.onClose();
                  }}
                  onCancel={() => setConfirming(null)}
                />
              </Show>

              <Show when={confirming() === "all"}>
                <ConfirmDialog
                  title="Clear all data"
                  message="Delete all tabs, groups, and captures from every device? This cannot be undone."
                  confirmLabel="Clear Everything"
                  destructive
                  onConfirm={async () => {
                    await clearAllData();
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
