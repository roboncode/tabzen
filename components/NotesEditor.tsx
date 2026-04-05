import { createSignal, onMount } from "solid-js";
import type { Tab } from "@/lib/types";

interface NotesEditorProps {
  tab: Tab;
  onSave: (tabId: string, notes: string) => void;
  onClose: () => void;
}

export default function NotesEditor(props: NotesEditorProps) {
  const [notes, setNotes] = createSignal(props.tab.notes || "");
  let textareaRef: HTMLTextAreaElement | undefined;

  onMount(() => {
    textareaRef?.focus();
    // Place cursor at end of existing text
    if (textareaRef) {
      textareaRef.selectionStart = textareaRef.value.length;
    }
  });

  const handleSave = () => {
    props.onSave(props.tab.id, notes());
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={props.onClose}>
      <div class="bg-card rounded-xl p-6 w-[480px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 class="text-base font-semibold text-foreground mb-1">Notes</h3>
        <p class="text-sm text-muted-foreground mb-4 truncate">{props.tab.title}</p>
        <textarea
          ref={textareaRef}
          class="w-full h-48 bg-muted/40 text-sm text-foreground rounded-lg p-4 outline-none focus:bg-muted/60 transition-colors resize-y placeholder:text-muted-foreground"
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
      </div>
    </div>
  );
}
