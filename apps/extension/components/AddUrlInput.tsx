import { createSignal, Show } from "solid-js";
import { Plus, Loader2 } from "lucide-solid";
import { sendMessage } from "@/lib/messages";
import { useNavigate } from "@solidjs/router";

const modKey = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";

export default function AddUrlInput() {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [result, setResult] = createSignal<{ message: string; pageId?: string } | null>(null);

  const isValidUrl = (text: string) => {
    try {
      const u = new URL(text.trim());
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    const trimmed = url().trim();
    if (!isValidUrl(trimmed)) return;

    setSaving(true);
    setResult(null);

    const response = await sendMessage({ type: "CAPTURE_URL", url: trimmed });

    if (response.type === "URL_SAVED") {
      setResult({
        message: response.saved ? "Saved!" : "Already saved",
        pageId: response.pageId,
      });
      setUrl("");
      setTimeout(() => setResult(null), 3000);
    } else if (response.type === "ERROR") {
      setResult({ message: "Could not save" });
      setTimeout(() => setResult(null), 3000);
    }

    setSaving(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setUrl("");
  };

  return (
    <div class="flex items-center flex-1 min-w-0">
      <Show when={result()}>
        {(r) => (
          <div class="flex items-center gap-2">
            <span class="text-xs text-green-400">{r().message}</span>
            <Show when={r().pageId}>
              <button
                class="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                onClick={() => navigate(`/page/${r().pageId}`)}
              >
                View
              </button>
            </Show>
          </div>
        )}
      </Show>
      <Show when={!result()}>
        <div class="flex items-center bg-muted/40 rounded-lg px-3 py-1 gap-2 flex-1">
          <input
            class="bg-transparent text-sm text-foreground outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50"
            placeholder={`Add URL · or ${modKey}V anywhere`}
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={saving()}
          />
          <Show
            when={!saving()}
            fallback={<Loader2 size={14} class="text-muted-foreground/40 animate-spin" />}
          >
            <Show when={isValidUrl(url())}>
              <button
                class="w-6 h-6 rounded-full flex items-center justify-center text-foreground hover:bg-muted/40 cursor-pointer transition-colors flex-shrink-0"
                onClick={handleSubmit}
              >
                <Plus size={18} />
              </button>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}
