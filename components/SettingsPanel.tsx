import { createSignal, createResource, Show } from "solid-js";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  exportAsJson,
  exportAsHtmlBookmarks,
  importFromJson,
  downloadFile,
} from "@/lib/export";
import type { Settings } from "@/lib/types";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [settings] = createResource(async () => getSettings());
  const [saving, setSaving] = createSignal(false);
  const [importResult, setImportResult] = createSignal<string | null>(null);

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
    <div class="h-full bg-slate-900 text-slate-200 overflow-y-auto">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h1 class="text-base font-bold text-slate-50">Settings</h1>
        <button
          class="text-xs text-slate-400 hover:text-slate-200"
          onClick={props.onClose}
        >
          ← Back
        </button>
      </div>

      <Show when={settings()}>
        {(s) => (
          <div class="p-4 space-y-6">
            {/* Source Label */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Browser / Profile Name
              </label>
              <input
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                value={s().sourceLabel}
                onChange={(e) => save({ sourceLabel: e.currentTarget.value })}
              />
              <p class="text-[10px] text-slate-500 mt-1">
                Tags your captures so you know where they came from
              </p>
            </div>

            {/* OpenRouter API Key */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                OpenRouter API Key
              </label>
              <input
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
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
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                AI Model
              </label>
              <select
                class="w-full bg-slate-800 text-sm text-slate-200 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
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
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Sync
              </label>
              <div class="flex items-center gap-3 mb-2">
                <button
                  class={`px-3 py-1.5 text-xs rounded ${
                    s().syncEnabled
                      ? "bg-green-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                  onClick={() => save({ syncEnabled: !s().syncEnabled })}
                >
                  {s().syncEnabled ? "Sync Enabled" : "Enable Sync"}
                </button>
              </div>
              <Show when={s().syncToken}>
                <div class="bg-slate-800 rounded-md p-3">
                  <p class="text-[10px] text-slate-500 mb-1">Sync Token</p>
                  <code class="text-xs text-slate-300 break-all">
                    {s().syncToken}
                  </code>
                </div>
              </Show>
              <div class="mt-2">
                <label class="block text-[10px] text-slate-500 mb-1">
                  Sync URL
                </label>
                <input
                  class="w-full bg-slate-800 text-xs text-slate-300 rounded-md px-3 py-2 border border-slate-700 outline-none focus:border-blue-500"
                  value={s().syncUrl}
                  onChange={(e) => save({ syncUrl: e.currentTarget.value })}
                />
              </div>
            </div>

            {/* Export / Import */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Export / Import
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleExportJson}
                >
                  Export JSON
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleExportBookmarks}
                >
                  Export Bookmarks
                </button>
                <button
                  class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  onClick={handleImport}
                >
                  Import JSON
                </button>
              </div>
              <Show when={importResult()}>
                <p class="text-xs text-slate-400 mt-2">{importResult()}</p>
              </Show>
            </div>

            {/* Keyboard shortcuts */}
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">
                Keyboard Shortcuts
              </label>
              <button
                class="px-3 py-1.5 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                onClick={() =>
                  browser.tabs.create({
                    url: "chrome://extensions/shortcuts",
                  })
                }
              >
                Configure Shortcuts
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
