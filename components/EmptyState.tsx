import { Inbox } from "lucide-solid";

export default function EmptyState() {
  return (
    <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div class="text-muted-foreground/40 mb-5">
        <Inbox size={52} />
      </div>
      <h2 class="text-base font-semibold text-foreground mb-2">No tabs saved yet</h2>
      <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">
        Click "Capture All Tabs" to save your open tabs, or right-click any tab
        to save it individually.
      </p>
    </div>
  );
}
