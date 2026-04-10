import { createSignal, onMount, onCleanup, Show } from "solid-js";
import type { Page } from "@/lib/types";
import Dialog from "./Dialog";

interface NotesEditorProps {
  tab: Page;
  onSave: (pageId: string, notes: string) => void;
  onClose: () => void;
}

export default function NotesEditor(props: NotesEditorProps) {
  const [notes, setNotes] = createSignal(props.tab.notes || "");
  const [visible, setVisible] = createSignal(false);
  const narrow = window.innerWidth < 500;
  let textareaRef: HTMLTextAreaElement | undefined;
  let sheetRef: HTMLDivElement | undefined;
  let startY = 0;
  let currentY = 0;
  let dragging = false;

  onMount(() => {
    requestAnimationFrame(() => {
      setVisible(true);
      setTimeout(() => {
        textareaRef?.focus();
        if (textareaRef) {
          textareaRef.selectionStart = textareaRef.value.length;
        }
      }, 50);
    });
  });

  // Escape key for bottom sheet (Dialog handles its own)
  onMount(() => {
    if (!narrow) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateClose();
    };
    document.addEventListener("keydown", handleKey);
    onCleanup(() => document.removeEventListener("keydown", handleKey));
  });

  const handleSave = () => {
    props.onSave(props.tab.id, notes());
    if (narrow) {
      animateClose();
    } else {
      props.onClose();
    }
  };

  const animateClose = () => {
    setVisible(false);
    setTimeout(() => props.onClose(), 200);
  };

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

  const textareaClass = "w-full h-40 bg-muted/40 text-sm text-foreground rounded-lg p-4 outline-none focus:bg-muted/60 transition-colors resize-none placeholder:text-muted-foreground";

  // Wide: use Dialog component
  if (!narrow) {
    return (
      <Dialog open={true} onClose={props.onClose}>
        <h3 class="text-base font-semibold text-foreground mb-1">Notes</h3>
        <p class="text-sm text-muted-foreground mb-4 truncate">{props.tab.title}</p>
        <textarea
          ref={textareaRef}
          class={`${textareaClass} h-48`}
          value={notes()}
          onInput={(e) => setNotes(e.currentTarget.value)}
          placeholder="Add notes about this tab..."
        />
        <div class="flex justify-end gap-2 mt-4">
          <button
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={props.onClose}
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
      </Dialog>
    );
  }

  // Narrow: bottom sheet
  return (
    <div
      class={`fixed inset-0 z-50 transition-colors duration-200 ${visible() ? "bg-black/60" : "bg-black/0"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) animateClose();
      }}
    >
      <div class="absolute inset-x-0 bottom-0" onMouseDown={(e) => e.stopPropagation()}>
        <div
          ref={sheetRef}
          class={`w-full bg-card rounded-t-2xl transition-transform duration-200 ${visible() ? "translate-y-0" : "translate-y-full"}`}
        >
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
            <div class="flex items-center gap-2.5 mb-4">
              {props.tab.favicon && (
                <img src={props.tab.favicon} alt="" class="w-5 h-5 rounded-full" />
              )}
              <p class="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                {props.tab.title}
              </p>
            </div>

            <textarea
              ref={textareaRef}
              class={textareaClass}
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
