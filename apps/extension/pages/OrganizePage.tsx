import { createSignal, onMount, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Folder, FolderOpen, ChevronRight, BookmarkCheck } from "lucide-solid";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@tab-zen/chat";
import { sendMessage } from "@/lib/messages";
import { getDomain } from "@/lib/domains";
import type { BookmarkPlan, BookmarkFolder, TabEntry } from "@/lib/bookmark-plan";

function faviconFor(url: string): string {
  const domain = getDomain(url);
  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : "";
}

function countNewTabs(folders: BookmarkFolder[]): number {
  return folders.reduce(
    (sum, f) => sum + f.tabs.filter((t) => !t.alreadyBookmarked).length,
    0,
  );
}

export default function OrganizePage() {
  const navigate = useNavigate();

  const [plan, setPlan] = createSignal<BookmarkPlan | null>(null);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [confirming, setConfirming] = createSignal(false);
  const [confirmError, setConfirmError] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const res = await sendMessage({ type: "GET_ORGANIZE_PLAN" });
      if (res.type === "ORGANIZE_PLAN") {
        setPlan(res.plan);
      } else if (res.type === "ERROR") {
        setLoadError(res.message);
      } else {
        setLoadError("Unexpected response loading plan.");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load plan.");
    }
  });

  const handleConfirm = async () => {
    const p = plan();
    if (!p || confirming()) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await sendMessage({ type: "CONFIRM_ORGANIZE", plan: p });
      if (res.type === "ORGANIZE_DONE") {
        setSuccessMsg(`Added ${res.created} bookmark${res.created !== 1 ? "s" : ""}`);
        setTimeout(() => navigate("/"), 1500);
      } else if (res.type === "ERROR") {
        setConfirmError(res.message);
        setConfirming(false);
      } else {
        setConfirmError("Unexpected response from background.");
        setConfirming(false);
      }
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Failed to organize.");
      setConfirming(false);
    }
  };

  const handleCancel = () => navigate("/");

  // --- Loading state ---
  const isLoading = () => !plan() && !loadError();

  return (
    <div class="h-full overflow-y-auto bg-background text-foreground">
      <div class="mx-auto w-full max-w-3xl px-4 py-6">

        {/* Load error */}
        <Show when={loadError()}>
          <div class="flex flex-col items-center justify-center py-20 gap-4">
            <p class="text-sm text-red-400">{loadError()}</p>
            <button
              class="px-4 py-2 text-sm font-medium rounded-full bg-muted/50 text-foreground hover:bg-muted transition-colors"
              onClick={handleCancel}
            >
              Back
            </button>
          </div>
        </Show>

        {/* Loading skeleton */}
        <Show when={isLoading()}>
          <div class="flex items-center justify-center py-20">
            <p class="text-sm text-muted-foreground">Loading plan…</p>
          </div>
        </Show>

        {/* Empty plan */}
        <Show when={plan() && plan()!.folders.length === 0}>
          <div class="flex flex-col items-center justify-center py-20 gap-3">
            <BookmarkCheck size={28} class="text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">Nothing to organize.</p>
            <p class="text-xs text-muted-foreground/60">
              All open tabs are already bookmarked under Tab Zen.
            </p>
            <button
              class="mt-2 px-4 py-2 text-sm font-medium rounded-full bg-muted/50 text-foreground hover:bg-muted transition-colors"
              onClick={handleCancel}
            >
              Back
            </button>
          </div>
        </Show>

        {/* Plan view */}
        <Show when={plan() && plan()!.folders.length > 0}>
          {(_) => {
            const p = plan()!;
            const newTabCount = countNewTabs(p.folders);

            return (
              <>
                {/* Header */}
                <div class="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h1 class="text-base font-semibold text-foreground">
                      Organize {newTabCount} tab{newTabCount !== 1 ? "s" : ""} into{" "}
                      {p.folders.length} folder{p.folders.length !== 1 ? "s" : ""}
                    </h1>
                    <p class="text-xs text-muted-foreground mt-1">
                      {p.skippedCount > 0
                        ? `${p.skippedCount} already saved will be skipped`
                        : "No existing bookmarks to skip"}
                    </p>
                  </div>
                  {/* Mode badge */}
                  <span
                    class={`flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      p.mode === "ai"
                        ? "bg-sky-500/15 text-sky-400"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {p.mode === "ai" ? "AI" : "Type-based"}
                  </span>
                </div>

                {/* Folder list */}
                <div class="flex flex-col gap-2">
                  <For each={p.folders}>
                    {(folder) => <FolderSection folder={folder} />}
                  </For>
                </div>

                {/* Success message */}
                <Show when={successMsg()}>
                  <div class="mt-4 bg-emerald-500/10 rounded-xl px-4 py-3">
                    <p class="text-sm text-emerald-400">{successMsg()}</p>
                  </div>
                </Show>

                {/* Confirm error */}
                <Show when={confirmError()}>
                  <div class="mt-4 bg-red-500/10 rounded-xl px-4 py-3">
                    <p class="text-sm text-red-400">{confirmError()}</p>
                  </div>
                </Show>

                {/* Footer */}
                <div class="flex items-center gap-3 mt-6">
                  <button
                    class="flex-1 px-6 py-2.5 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                    onClick={handleConfirm}
                    disabled={confirming() || !!successMsg()}
                  >
                    {confirming() ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    class="px-6 py-2.5 text-sm font-medium rounded-full bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    onClick={handleCancel}
                    disabled={confirming()}
                  >
                    Cancel
                  </button>
                </div>
              </>
            );
          }}
        </Show>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderSection — collapsible folder row
// ---------------------------------------------------------------------------

function FolderSection(props: { folder: BookmarkFolder }) {
  const newCount = () =>
    props.folder.tabs.filter((t) => !t.alreadyBookmarked).length;

  return (
    <Collapsible defaultOpen>
      <div class="bg-muted/30 rounded-xl overflow-hidden">
        {/* Trigger row */}
        <CollapsibleTrigger class="group/folder w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors outline-none">
          <ChevronRight
            size={14}
            class="flex-shrink-0 text-muted-foreground transition-transform duration-150 group-data-[expanded]/folder:rotate-90"
          />
          <Folder
            size={15}
            class="flex-shrink-0 text-muted-foreground group-data-[expanded]/folder:hidden"
          />
          <FolderOpen
            size={15}
            class="flex-shrink-0 text-muted-foreground hidden group-data-[expanded]/folder:block"
          />
          <span class="flex-1 min-w-0 text-left text-sm font-medium text-foreground truncate">
            {props.folder.name}
          </span>
          {/* new / existing badge */}
          <span
            class={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
              props.folder.existingId === null
                ? "bg-sky-500/15 text-sky-400"
                : "bg-muted/60 text-muted-foreground"
            }`}
          >
            {props.folder.existingId === null ? "new" : "existing"}
          </span>
          {/* tab count */}
          <span class="flex-shrink-0 text-xs text-muted-foreground/60">
            {newCount()} tab{newCount() !== 1 ? "s" : ""}
          </span>
        </CollapsibleTrigger>

        {/* Tab rows */}
        <CollapsibleContent>
          <div class="pb-1">
            <For each={props.folder.tabs}>
              {(tab) => <TabRow tab={tab} />}
            </For>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// TabRow — single tab inside a folder
// ---------------------------------------------------------------------------

function TabRow(props: { tab: TabEntry }) {
  const domain = () => getDomain(props.tab.url);

  return (
    <div
      class={`flex items-center gap-3 px-4 py-2.5 ${
        props.tab.alreadyBookmarked ? "opacity-40" : ""
      }`}
    >
      {/* Favicon */}
      <div class="w-4 h-4 flex-shrink-0">
        <Show
          when={domain()}
          fallback={
            <div class="w-4 h-4 rounded-sm bg-muted/50" />
          }
        >
          <img
            src={faviconFor(props.tab.url)}
            alt=""
            class="w-4 h-4 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </Show>
      </div>

      {/* Title + domain */}
      <div class="flex-1 min-w-0">
        <p class="text-sm text-foreground truncate leading-snug">
          {props.tab.title}
        </p>
        <p class="text-xs text-muted-foreground/60 truncate mt-0.5">
          {domain()}
        </p>
      </div>

      {/* Already saved label */}
      <Show when={props.tab.alreadyBookmarked}>
        <span class="flex-shrink-0 text-xs text-muted-foreground/50">
          already saved
        </span>
      </Show>
    </div>
  );
}
