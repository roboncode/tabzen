import { createSignal, createResource, Show } from "solid-js";
import { ArrowLeft } from "lucide-solid";
import ConfirmDialog from "./ConfirmDialog";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  exportAsJson,
  exportAsHtmlBookmarks,
  importFromJson,
  downloadFile,
} from "@/lib/export";
import { clearAllData } from "@/lib/db";
import type { Settings } from "@/lib/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [settings] = createResource(async () => getSettings());
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = createSignal(false);

  const save = async (updates: Partial<Settings>) => {
    setSaving(true);
    await updateSettings(updates);
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
          <div class="p-4 space-y-6">
            {/* Source Label */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                Browser / Profile Name
              </label>
              <input
                class="w-full bg-muted/40 text-sm text-foreground rounded-md px-3 py-2 border border-transparent outline-none focus:bg-muted/60"
                value={s().sourceLabel}
                onChange={(e) => save({ sourceLabel: e.currentTarget.value })}
              />
              <p class="text-xs text-muted-foreground mt-1">
                Tags your captures so you know where they came from
              </p>
            </div>

            {/* OpenRouter API Key */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                OpenRouter API Key
              </label>
              <input
                class="w-full bg-muted/40 text-sm text-foreground rounded-md px-3 py-2 border border-transparent outline-none focus:bg-muted/60"
                type="password"
                value={s().openRouterApiKey}
                onChange={(e) =>
                  save({ openRouterApiKey: e.currentTarget.value })
                }
                placeholder="sk-or-..."
              />
            </div>

            {/* AI Model */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                AI Model
              </label>
              <select
                class="w-full bg-muted/40 text-sm text-foreground rounded-md px-3 py-2 border border-transparent outline-none focus:bg-muted/60"
                value={s().aiModel}
                onChange={(e) => save({ aiModel: e.currentTarget.value })}
              >
                <option value="openai/gpt-4o-mini">
                  GPT-4o Mini (default)
                </option>
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="anthropic/claude-haiku-4-5-20251001">
                  Claude Haiku
                </option>
                <option value="anthropic/claude-sonnet-4-6">
                  Claude Sonnet
                </option>
                <option value="google/gemini-2.0-flash-001">
                  Gemini 2.0 Flash
                </option>
                <option value="meta-llama/llama-3.3-70b-instruct">
                  Llama 3.3 70B
                </option>
              </select>
            </div>

            {/* Sync */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                Sync
              </label>
              <div class="flex items-center gap-3 mb-2">
                <button
                  class={`px-3 py-1.5 text-xs rounded ${
                    s().syncEnabled
                      ? "bg-green-600 text-white"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => save({ syncEnabled: !s().syncEnabled })}
                >
                  {s().syncEnabled ? "Sync Enabled" : "Enable Sync"}
                </button>
              </div>
              <Show when={s().syncToken}>
                <div class="bg-muted/40 rounded-md p-3">
                  <p class="text-xs text-muted-foreground mb-1">Sync Token</p>
                  <code class="text-xs text-foreground break-all">
                    {s().syncToken}
                  </code>
                </div>
              </Show>
              <div class="mt-2">
                <label class="block text-xs text-muted-foreground mb-1">
                  Sync URL
                </label>
                <input
                  class="w-full bg-muted/40 text-xs text-foreground rounded-md px-3 py-2 border border-transparent outline-none focus:bg-muted/60"
                  value={s().syncUrl}
                  onChange={(e) => save({ syncUrl: e.currentTarget.value })}
                />
              </div>
            </div>

            {/* Export / Import */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                Export / Import
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  class="px-3 py-1.5 text-xs bg-muted/40 text-foreground rounded hover:bg-muted/60"
                  onClick={handleExportJson}
                >
                  Export JSON
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-muted/40 text-foreground rounded hover:bg-muted/60"
                  onClick={handleExportBookmarks}
                >
                  Export Bookmarks
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-muted/40 text-foreground rounded hover:bg-muted/60"
                  onClick={handleImport}
                >
                  Import JSON
                </button>
              </div>
              <Show when={importResult()}>
                <p class="text-xs text-muted-foreground mt-2">{importResult()}</p>
              </Show>
            </div>

            {/* Keyboard shortcuts */}
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">
                Keyboard Shortcuts
              </label>
              <button
                class="px-3 py-1.5 text-xs bg-muted/40 text-foreground rounded hover:bg-muted/60"
                onClick={() =>
                  browser.tabs.create({
                    url: "chrome://extensions/shortcuts",
                  })
                }
              >
                Configure Shortcuts
              </button>
            </div>

            {/* Dev: Clear All Data */}
            <div class="pt-4 border-t border-transparent">
              <label class="block text-xs font-medium text-red-400 mb-1.5">
                Danger Zone
              </label>
              <button
                class="px-3 py-1.5 text-sm bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900 transition-colors"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear All Data
              </button>
              <p class="text-xs text-muted-foreground mt-1">
                Removes all saved tabs, groups, and captures from local storage
              </p>
            </div>
          </div>
        )}
      </Show>

      <Show when={showClearConfirm()}>
        <ConfirmDialog
          title="Clear all data"
          message="Delete all saved tabs, groups, and captures? This cannot be undone."
          confirmLabel="Clear Everything"
          destructive
          onConfirm={async () => {
            await clearAllData();
            setShowClearConfirm(false);
            props.onClose();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      </Show>
    </div>
  );
}
