import { createSignal, Show } from "solid-js";
import { HardDrive, RefreshCw } from "lucide-solid";
import { initSync, verifySync, checkConnection } from "@/lib/sync";
import { sendMessage } from "@/lib/messages";
import { setServiceActive } from "@/lib/adapter-state";
import { checkServiceHealth, migrateToService } from "@/lib/data-layer";
import type { Settings } from "@/lib/types";

interface SyncConfigPanelProps {
  settings: Settings;
  save: (updates: Partial<Settings>) => Promise<void>;
}

type StorageMode = "browser" | "sync" | "service";

function deriveStorageMode(settings: Settings): StorageMode {
  if (settings.dataSource === "service") return "service";
  if (settings.syncEnabled) return "sync";
  return "browser";
}

export default function SyncConfigPanel(props: SyncConfigPanelProps) {
  const [syncStatus, setSyncStatus] = createSignal<string | null>(null);
  const [syncLoading, setSyncLoading] = createSignal(false);
  const [connected, setConnected] = createSignal<boolean | null>(null);
  const [checking, setChecking] = createSignal(false);

  // Service-specific state
  const [serviceHealthy, setServiceHealthy] = createSignal<boolean | null>(null);
  const [serviceChecking, setServiceChecking] = createSignal(false);
  const [migrating, setMigrating] = createSignal(false);
  const [migrateResult, setMigrateResult] = createSignal<string | null>(null);

  const s = () => props.settings;
  const mode = () => deriveStorageMode(s());

  async function handleStorageChange(newMode: StorageMode) {
    if (newMode === "browser") {
      setServiceActive(false);
      await props.save({ dataSource: "local", syncEnabled: false });
    } else if (newMode === "sync") {
      setServiceActive(false);
      await props.save({ dataSource: "local" });
      // Don't set syncEnabled here -- that happens when a token is generated/pasted
    } else if (newMode === "service") {
      setServiceChecking(true);
      const healthy = await checkServiceHealth();
      setServiceHealthy(healthy);
      setServiceChecking(false);
      if (healthy) {
        setServiceActive(true);
        await props.save({ dataSource: "service" });
      }
      // If not healthy, don't switch -- the UI will show the status
    }
  }

  async function handleCheckServiceHealth() {
    setServiceChecking(true);
    const healthy = await checkServiceHealth();
    setServiceHealthy(healthy);
    setServiceChecking(false);
    if (healthy && s().dataSource === "service") {
      setServiceActive(true);
    }
  }

  async function handleMigrate() {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await migrateToService();
      setMigrateResult(`Migrated ${result.imported} items (${result.skipped} skipped)`);
    } catch (e) {
      setMigrateResult(`Migration failed: ${e}`);
    }
    setMigrating(false);
  }

  return (
    <>
      <p class="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 -mx-4 px-4 py-2.5 mt-2 first:mt-0">
        <HardDrive size={14} /> Storage
      </p>
      <div class="px-1 py-3 space-y-2">

        {/* Browser Only */}
        <button
          class={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-colors ${
            mode() === "browser" ? "bg-muted/50" : "bg-transparent hover:bg-muted/20"
          }`}
          onClick={() => handleStorageChange("browser")}
        >
          <div class={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
            mode() === "browser" ? "bg-primary" : "bg-muted/60"
          }`}>
            <Show when={mode() === "browser"}>
              <div class="w-2 h-2 rounded-full bg-background" />
            </Show>
          </div>
          <div>
            <div class="text-sm text-foreground">Browser Only</div>
            <div class="text-sm text-muted-foreground">Data stays in this browser. No sync across devices.</div>
          </div>
        </button>

        {/* Browser + Cloud Sync */}
        <div>
          <button
            class={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-colors ${
              mode() === "sync" ? "bg-muted/50" : "bg-transparent hover:bg-muted/20"
            }`}
            onClick={() => handleStorageChange("sync")}
          >
            <div class={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              mode() === "sync" ? "bg-primary" : "bg-muted/60"
            }`}>
              <Show when={mode() === "sync"}>
                <div class="w-2 h-2 rounded-full bg-background" />
              </Show>
            </div>
            <div>
              <div class="text-sm text-foreground">Browser + Cloud Sync</div>
              <div class="text-sm text-muted-foreground">Sync data across devices via a sync server.</div>
            </div>
          </button>

          {/* Expanded sync config */}
          <Show when={mode() === "sync"}>
            <div class="ml-10 mt-2 space-y-4">
              <SyncConfig
                settings={s()}
                save={props.save}
                syncStatus={syncStatus}
                setSyncStatus={setSyncStatus}
                syncLoading={syncLoading}
                setSyncLoading={setSyncLoading}
                connected={connected}
                setConnected={setConnected}
                checking={checking}
                setChecking={setChecking}
              />
            </div>
          </Show>
        </div>

        {/* Local Service */}
        <div>
          <button
            class={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-colors ${
              mode() === "service" ? "bg-muted/50" : "bg-transparent hover:bg-muted/20"
            }`}
            onClick={() => handleStorageChange("service")}
          >
            <div class={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              mode() === "service" ? "bg-primary" : "bg-muted/60"
            }`}>
              <Show when={mode() === "service"}>
                <div class="w-2 h-2 rounded-full bg-background" />
              </Show>
            </div>
            <div>
              <div class="text-sm text-foreground">Local Service <span class="text-muted-foreground">(experimental)</span></div>
              <div class="text-sm text-muted-foreground">Store data via a local desktop service.</div>
            </div>
          </button>

          {/* Expanded service config */}
          <Show when={mode() === "service"}>
            <div class="ml-10 mt-2 space-y-3">
              {/* Service URL (read-only) */}
              <div>
                <label class="block text-sm text-muted-foreground mb-1.5">Service URL</label>
                <input
                  class="w-full bg-muted/40 text-sm text-foreground rounded-lg px-3 py-2 outline-none transition-colors cursor-default"
                  value="http://localhost:7824"
                  readOnly
                />
              </div>

              {/* Connection status */}
              <div class="bg-muted/30 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class={`w-2.5 h-2.5 rounded-full ${
                      serviceHealthy() === true ? "bg-green-500" :
                      serviceHealthy() === false ? "bg-red-500" :
                      "bg-muted-foreground/30"
                    }`} />
                    <span class="text-sm text-foreground">
                      {serviceChecking() ? "Checking..." :
                       serviceHealthy() === true ? "Connected" :
                       serviceHealthy() === false ? "Unreachable" :
                       "Not checked"}
                    </span>
                  </div>
                  <button
                    class="px-3 py-1.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    disabled={serviceChecking()}
                    onClick={handleCheckServiceHealth}
                  >
                    {serviceChecking() ? "Checking..." : "Check"}
                  </button>
                </div>
              </div>

              {/* Migrate data */}
              <div class="space-y-2">
                <button
                  class="px-4 py-2.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  disabled={migrating() || serviceHealthy() !== true}
                  onClick={handleMigrate}
                >
                  {migrating() ? "Migrating..." : "Migrate Data"}
                </button>
                <Show when={migrateResult()}>
                  <p class="text-sm text-muted-foreground">{migrateResult()}</p>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}

/** Inner component: the existing sync configuration UI */
function SyncConfig(props: {
  settings: Settings;
  save: (updates: Partial<Settings>) => Promise<void>;
  syncStatus: () => string | null;
  setSyncStatus: (v: string | null) => void;
  syncLoading: () => boolean;
  setSyncLoading: (v: boolean) => void;
  connected: () => boolean | null;
  setConnected: (v: boolean | null) => void;
  checking: () => boolean;
  setChecking: (v: boolean) => void;
}) {
  const s = () => props.settings;

  return (
    <div class="space-y-4">
      {/* Environment toggle */}
      <div class="flex bg-muted/40 rounded-lg p-1">
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

      {/* URL field */}
      <div>
        <label class="block text-sm text-muted-foreground mb-1.5">
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
          <p class="text-sm text-muted-foreground mt-1.5">
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
          props.setSyncLoading(true);
          props.setSyncStatus(null);
          await props.save({ [tokenKey()]: token, syncEnabled: true });
          const valid = await verifySync();
          if (valid) {
            await props.save({ syncError: null });
            props.setSyncStatus("Connected! Syncing will start automatically.");
          } else {
            props.setSyncStatus("Invalid token or server unreachable.");
            await props.save({ [tokenKey()]: null, syncEnabled: false });
          }
          props.setSyncLoading(false);
        };

        const handleConnect = async () => {
          props.setChecking(true);
          props.setConnected(null);
          props.setSyncStatus(null);
          const ok = await checkConnection();
          props.setConnected(ok);
          if (!ok) {
            props.setSyncStatus(
              isLocal()
                ? "Cannot reach server. Run bun run sync:dev"
                : "Cannot reach server. Check the URL."
            );
          }
          props.setChecking(false);
        };

        const handleGenerateToken = async () => {
          props.setSyncLoading(true);
          props.setSyncStatus(null);
          try {
            const token = await initSync();
            await props.save({ [tokenKey()]: token, syncEnabled: true, syncError: null });
            props.setSyncStatus("Token generated!");
          } catch (e) {
            props.setConnected(false);
            props.setSyncStatus(
              isLocal()
                ? "Failed. Is the server running? (bun run sync:dev)"
                : `Failed: ${e}`
            );
          }
          props.setSyncLoading(false);
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
                          props.connected() === true ? "bg-green-500" :
                          props.connected() === false ? "bg-red-500" :
                          "bg-muted-foreground/30"
                        }`} />
                        <span class="text-sm text-foreground">
                          {props.connected() === true ? "Server reachable" :
                           props.connected() === false ? "Unreachable" :
                           "Not connected"}
                        </span>
                      </div>
                      <button
                        class="px-3 py-1.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                        disabled={props.checking()}
                        onClick={handleConnect}
                      >
                        {props.checking() ? "Checking..." : props.connected() === true ? "Recheck" : "Connect"}
                      </button>
                    </div>
                    <Show when={props.syncStatus() && !props.connected()}>
                      <p class="text-sm text-muted-foreground mt-2">{props.syncStatus()}</p>
                    </Show>
                  </div>

                  {/* Step 2: Generate or paste token (only after connected) */}
                  <Show when={props.connected()}>
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
                              disabled={props.syncLoading() || !pasteValue().trim()}
                              onClick={handlePasteConnect}
                            >
                              {props.syncLoading() ? "Connecting..." : "Connect"}
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
                          disabled={props.syncLoading()}
                          onClick={handleGenerateToken}
                        >
                          {props.syncLoading() ? "Generating..." : "Generate New Token"}
                        </button>
                        <button
                          class="px-4 py-2.5 text-sm bg-muted/50 text-foreground rounded-lg hover:bg-muted transition-colors"
                          onClick={() => setPasteMode(true)}
                        >
                          Paste Token
                        </button>
                      </div>
                    </Show>
                    <Show when={props.syncStatus() && props.connected()}>
                      <p class="text-sm text-green-400">{props.syncStatus()}</p>
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
                      disabled={props.syncLoading()}
                      onClick={async () => {
                        props.setSyncLoading(true);
                        props.setSyncStatus(null);
                        const response = await sendMessage({ type: "SYNC_NOW" });
                        if (response.type === "SYNC_COMPLETE") {
                          props.setSyncStatus(`Synced! Pushed ${response.pushed} tabs, pulled ${response.pulled} new tabs.`);
                          props.setConnected(true);
                        } else if (response.type === "ERROR") {
                          props.setSyncStatus(`Sync failed: ${response.message}`);
                        }
                        props.setSyncLoading(false);
                      }}
                    >
                      {props.syncLoading() ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                  <Show when={s().syncError}>
                    <p class="text-sm text-red-300 mb-3">{s().syncError}</p>
                  </Show>
                  <p class="text-sm text-muted-foreground mb-1.5">Token</p>
                  <div class="flex items-center gap-2">
                    <code class="text-sm text-foreground break-all flex-1">
                      {activeToken()}
                    </code>
                    <button
                      class="px-2.5 py-1 text-sm bg-muted/50 text-muted-foreground rounded-lg hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
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
  );
}
