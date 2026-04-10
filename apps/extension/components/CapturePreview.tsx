import { For } from "solid-js";
import type { CapturePreviewData } from "@/lib/types";

interface CapturePreviewProps {
  data: CapturePreviewData;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CapturePreview(props: CapturePreviewProps) {
  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-card rounded-xl p-5 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
        <h2 class="text-base font-semibold text-foreground mb-1">
          Capture Preview
        </h2>
        <p class="text-sm text-muted-foreground mb-4">
          {props.data.pages.length} new tabs in {props.data.groups.length} groups
        </p>
        <div class="space-y-3 mb-5">
          <For each={props.data.groups}>
            {(group) => {
              const groupPages = () =>
                props.data.pages.filter((t) => group.pageIds.includes(t.id));
              return (
                <div class="bg-muted/30 rounded-lg p-3">
                  <h3 class="text-sm font-medium text-foreground mb-2">
                    {group.groupName}
                    <span class="text-muted-foreground ml-2 text-xs">
                      ({groupPages().length})
                    </span>
                  </h3>
                  <ul class="space-y-1.5">
                    <For each={groupPages()}>
                      {(tab) => (
                        <li class="text-xs text-muted-foreground truncate flex items-center gap-2">
                          {tab.favicon && (
                            <img src={tab.favicon} alt="" class="w-3.5 h-3.5 rounded-sm" />
                          )}
                          {tab.title}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              );
            }}
          </For>
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            onClick={props.onConfirm}
          >
            Save {props.data.pages.length} Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
