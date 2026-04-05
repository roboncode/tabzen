import { createSignal, onMount } from "solid-js";
import type { Tab } from "@/lib/types";

interface NotesEditorProps {
  tab: Tab;
  onSave: (tabId: string, notes: string) => void;
  onClose: () => void;
}

export default function NotesEditor(props: NotesEditorProps) {
  const [notes, setNotes] = createSignal(props.tab.notes || "");
  const [visible, setVisible] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let sheetRef: HTMLDivElement | undefined;
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  onMount(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setVisible(true));
    textareaRef?.focus();
    if (textareaRef) {
      textareaRef.selectionStart = textareaRef.value.length;
    }
  });

  const handleSave = () => {
    props.onSave(props.tab.id, notes());
    animateClose();
  };

  const animateClose = () => {
    setVisible(false);
    setTimeout(() => props.onClose(), 200);
  };

  // Drag-to-dismiss handlers
  const onDragStart = (clientY: number) => {
    dragging = true;
    startY = clientY;
  };

  const onDragMove = (clientY: number) => {
    if (!dragging || !sheetRef) return;
    currentY = Math.max(0, clientY - startY);
    sheetRef.style.transform = `translateY(${currentY}px)`;
    sheetRef.style.transition = "none";
  };

  const onDragEnd = () => {
    if (!dragging || !sheetRef) return;
    dragging = false;
    sheetRef.style.transition = "";
    if (currentY > 120) {
      animateClose();
    } else {
      sheetRef.style.transform = "";
    }
    currentY = 0;
  };

  const isNarrow = () => window.innerWidth < 500;

  return (
    <div
      class={`fixed inset-0 z-50 transition-colors duration-200 ${visible() ? "bg-black/60" : "bg-black/0"}`}
      onClick={animateClose}
    >
      {/* Wide view: centered dialog */}
      <div
        class={`hidden @[500px]:flex items-center justify-center h-full ${isNarrow() ? "!hidden" : ""}`}
        style={{ display: isNarrow() ? "none" : undefined }}
      >
        <div
          class={`bg-card rounded-xl p-6 w-[480px] max-w-[90vw] transition-all duration-200 ${visible() ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 class="text-base font-semibold text-foreground mb-1">Notes</h3>
          <p class="text-sm text-muted-foreground mb-4 truncate">{props.tab.title}</p>
          <textarea
            ref={(el) => { if (isNarrow()) return; textareaRef = el; }}
            class="w-full h-48 bg-muted/40 text-sm text-foreground rounded-lg p-4 outline-none focus:bg-muted/60 transition-colors resize-y placeholder:text-muted-foreground"
            value={notes()}
            onInput={(e) => setNotes(e.currentTarget.value)}
            placeholder="Add notes about this tab..."
          />
          <div class="flex justify-end gap-2 mt-4">
            <button
              class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              onClick={animateClose}
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Narrow view: bottom sheet */}
      <div
        class={isNarrow() ? "flex items-end h-full" : "hidden"}
      >
        <div
          ref={sheetRef}
          class={`w-full bg-card rounded-t-2xl transition-transform duration-200 ${visible() ? "translate-y-0" : "translate-y-full"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle / notch */}
          <div
            class="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={(e) => onDragStart(e.clientY)}
            onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
            onMouseMove={(e) => onDragMove(e.clientY)}
            onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
            onMouseUp={onDragEnd}
            onTouchEnd={onDragEnd}
            onMouseLeave={onDragEnd}
          >
            <div class="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div class="px-5 pb-6">
            {/* Tab context */}
            <div class="flex items-center gap-2.5 mb-4">
              {props.tab.favicon && (
                <img src={props.tab.favicon} alt="" class="w-5 h-5 rounded-full" />
              )}
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">{props.tab.title}</p>
              </div>
            </div>

            <textarea
              ref={(el) => { if (!isNarrow()) return; textareaRef = el; }}
              class="w-full h-40 bg-muted/40 text-sm text-foreground rounded-lg p-4 outline-none focus:bg-muted/60 transition-colors resize-none placeholder:text-muted-foreground"
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              placeholder="Add notes about this tab..."
            />
            <div class="flex gap-2 mt-4">
              <button
                class="flex-1 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg bg-muted/40 hover:bg-muted transition-colors"
                onClick={animateClose}
              >
                Cancel
              </button>
              <button
                class="flex-1 px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
