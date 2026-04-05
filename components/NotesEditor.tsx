import { createSignal } from "solid-js";
import type { Tab } from "@/lib/types";

interface NotesEditorProps {
  tab: Tab;
  onSave: (tabId: string, notes: string) => void;
  onClose: () => void;
}

export default function NotesEditor(props: NotesEditorProps) {
  const [notes, setNotes] = createSignal(props.tab.notes || "");

  const handleSave = () => {
    props.onSave(props.tab.id, notes());
    props.onClose();
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={props.onClose}>
      <div class="bg-slate-800 rounded-lg p-4 w-80 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 class="text-sm font-semibold text-slate-100 mb-1">Notes</h3>
        <p class="text-xs text-slate-400 mb-3 truncate">{props.tab.title}</p>
        <textarea
          class="w-full h-32 bg-slate-900 text-sm text-slate-200 rounded-md p-3 border border-slate-700 outline-none focus:border-blue-500 resize-none"
          value={notes()}
          onInput={(e) => setNotes(e.currentTarget.value)}
          placeholder="Add notes about this tab..."
        />
        <div class="flex justify-end gap-2 mt-3">
          <button
            class="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
