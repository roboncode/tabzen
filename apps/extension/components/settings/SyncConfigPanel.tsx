import { createSignal, Show } from "solid-js";
import { RefreshCw } from "lucide-solid";
import { initSync, verifySync, checkConnection } from "@/lib/sync";
import { sendMessage } from "@/lib/messages";
import type { Settings } from "@/lib/types";

interface SyncConfigPanelProps {
  settings: Settings;
  save: (updates: Partial<Settings>) => Promise<void>;
}

export default function SyncConfigPanel(props: SyncConfigPanelProps) {
  const [syncStatus, setSyncStatus] = createSignal<string | null>(null);
  const [syncLoading, setSyncLoading] = createSignal(false);
  const [connected, setConnected] = createSignal<boolean | null>(null);
  const [checking, setChecking] = createSignal(false);

  const s = () => props.settings;

  return (
    <>
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
            onClick={() => props.save({ syncEnv: "local" })}
          >
            Local
          </button>
          <button
            class={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              s().syncEnv === "remote"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => props.save({ syncEnv: "remote" })}
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
                props.save({ syncLocalUrl: e.currentTarget.value });
              } else {
                props.save({ syncUrl: e.currentTarget.value });
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
            await props.save({ [tokenKey()]: token, syncEnabled: true });
            const valid = await verifySync();
            if (valid) {
              await props.save({ syncError: null });
              setSyncStatus("Connected! Syncing will start automatically.");
            } else {
              setSyncStatus("Invalid token or server unreachable.");
              await props.save({ [tokenKey()]: null, syncEnabled: false });
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
              await props.save({ [tokenKey()]: token, syncEnabled: true, syncError: null });
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
                        <div class={`w-2.5 h-2.5 rounded-full ${s().syncError ? "bg-red-500" : "bg-green-500"}`} />
                        <span class="text-sm text-foreground">
                          {s().syncError ? "Error" : "Syncing"}
                        </span>
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
                    <Show when={s().syncError}>
                      <p class="text-xs text-red-300 mb-3">{s().syncError}</p>
                    </Show>
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
                    onClick={() => props.save({ [tokenKey()]: null, syncEnabled: false })}
                  >
                    Disconnect
                  </button>
                </div>
              </Show>
            </div>
          );
        })()}
      </div>
    </>
  );
}
