import { Inbox } from "lucide-solid";

export default function EmptyState() {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="text-slate-600 mb-4">
        <Inbox size={48} />
      </div>
      <h2 class="text-lg font-semibold text-slate-200 mb-2">No tabs saved yet</h2>
      <p class="text-sm text-slate-400 max-w-xs">
        Click "Capture All Tabs" to save your open tabs, or right-click any tab
        to save it individually.
      </p>
    </div>
  );
}
