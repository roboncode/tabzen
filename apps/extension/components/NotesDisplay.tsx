import { createSignal, Show } from "solid-js";
import { StickyNote } from "lucide-solid";
import type { Tab } from "@/lib/types";
import NotesEditor from "./NotesEditor";

interface NotesDisplayProps {
  tab: Tab;
  onSave: (tabId: string, notes: string) => void;
  /** Max lines before clamping (default 3) */
  clampLines?: number;
}

/**
 * Self-contained notes display + editor.
 * Shows notes with line clamping and show more/less toggle.
 * Click to open the notes editor modal.
 * Reusable in sidebar, narrow inline view, or anywhere else.
 */
export default function NotesDisplay(props: NotesDisplayProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [needsClamp, setNeedsClamp] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const maxLines = () => props.clampLines ?? 3;

  let textRef: HTMLDivElement | undefined;

  const checkClamp = () => {
    if (!textRef) return;
    const lineHeight = parseFloat(getComputedStyle(textRef).lineHeight) || 20;
    const maxHeight = lineHeight * maxLines();
    setNeedsClamp(textRef.scrollHeight > maxHeight + 2);
  };

  const handleSave = (tabId: string, notes: string) => {
    props.onSave(tabId, notes);
    setEditing(false);
  };

  return (
    <>
      <Show
        when={props.tab.notes}
        fallback={
          <button
            onClick={() => setEditing(true)}
            class="flex items-center gap-1.5 text-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <StickyNote size={13} />
            <span>Add a note...</span>
          </button>
        }
      >
        <div>
          <div
            onClick={() => setEditing(true)}
            class="bg-muted/30 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditing(true);
            }}
          >
            <div
              ref={(el) => {
                textRef = el;
                requestAnimationFrame(checkClamp);
              }}
              class={`text-sm text-muted-foreground leading-relaxed ${
                expanded() ? "" : "line-clamp-" + maxLines()
              }`}
            >
              {props.tab.notes}
            </div>
          </div>
          <Show when={needsClamp()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded());
              }}
              class="text-xs tracking-wider text-muted-foreground/50 hover:text-sky-400 transition-colors cursor-pointer pl-3 mt-1"
            >
              {expanded() ? "Show less" : "Show more"}
            </button>
          </Show>
        </div>
      </Show>

      {/* Notes editor modal */}
      <Show when={editing()}>
        <NotesEditor
          tab={props.tab}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      </Show>
    </>
  );
}
