import { createSignal, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { getSettings, watchSettings } from "@/lib/settings";
import { HardDrive, Cloud, Monitor } from "lucide-solid";
import type { Settings } from "@/lib/types";
import { checkConnection } from "@/lib/sync";
import { checkServiceHealth } from "@/lib/data-layer";

type StorageMode = "browser" | "sync" | "service";
type ConnectionStatus = "idle" | "checking" | "connected" | "disconnected";

function getMode(s: Settings): StorageMode {
  if (s.dataSource === "service") return "service";
  if (s.syncEnabled) return "sync";
  return "browser";
}

const CHECK_INTERVAL = 60_000;

export default function StorageBadge() {
  const navigate = useNavigate();
  const [mode, setMode] = createSignal<StorageMode>("browser");
  const [status, setStatus] = createSignal<ConnectionStatus>("idle");

  let checkTimer: ReturnType<typeof setInterval> | null = null;

  async function runHealthCheck(m: StorageMode) {
    if (m === "browser") {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    try {
      const healthy = m === "service"
        ? await checkServiceHealth()
        : await checkConnection();
      setStatus(healthy ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  }

  function startChecking(m: StorageMode) {
    if (checkTimer) clearInterval(checkTimer);
    runHealthCheck(m);
    if (m !== "browser") {
      checkTimer = setInterval(() => runHealthCheck(m), CHECK_INTERVAL);
    }
  }

  function applySettings(s: Settings) {
    const m = getMode(s);
    setMode(m);
    startChecking(m);
  }

  onMount(async () => {
    const s = await getSettings();
    applySettings(s);
  });

  const unwatch = watchSettings((s) => {
    applySettings(s);
  });

  onCleanup(() => {
    unwatch();
    if (checkTimer) clearInterval(checkTimer);
  });

  const tooltip = () => {
    const m = mode();
    const s = status();

    if (m === "browser") return "Storage: Browser Only";

    const label = m === "service" ? "Local Service" : "Cloud Sync";
    switch (s) {
      case "checking": return `Storage: ${label} — checking...`;
      case "connected": return `Storage: ${label} — connected`;
      case "disconnected": return `Storage: ${label} — ${m === "service" ? "not running" : "unreachable"}`;
      default: return `Storage: ${label}`;
    }
  };

  const iconColor = () => {
    const m = mode();
    const s = status();

    if (m === "browser") return "text-muted-foreground";
    if (s === "connected") return "text-green-400";
    if (s === "disconnected") return "text-red-400";
    if (s === "checking") return "text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <button
      onClick={() => navigate("/settings/storage")}
      class={`w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted/50 transition-colors flex-shrink-0 ${iconColor()}`}
      title={tooltip()}
    >
      {mode() === "service" && <Monitor size={18} />}
      {mode() === "sync" && <Cloud size={18} />}
      {mode() === "browser" && <HardDrive size={18} />}
    </button>
  );
}
