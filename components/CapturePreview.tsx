import { For } from "solid-js";
import type { CapturePreviewData } from "@/lib/types";

interface CapturePreviewProps {
  data: CapturePreviewData;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CapturePreview(props: CapturePreviewProps) {
  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-slate-800 rounded-lg p-4 w-96 max-w-[90vw] max-h-[80vh] overflow-auto">
        <h2 class="text-base font-semibold text-slate-100 mb-1">
          Capture Preview
        </h2>
        <p class="text-xs text-slate-400 mb-4">
          {props.data.tabs.length} new tabs in {props.data.groups.length} groups
        </p>
        <div class="space-y-3 mb-4">
          <For each={props.data.groups}>
            {(group) => {
              const groupTabs = () =>
                props.data.tabs.filter((t) => group.tabIds.includes(t.id));
              return (
                <div class="bg-slate-900 rounded-md p-3">
                  <h3 class="text-sm font-medium text-slate-200 mb-2">
                    {group.groupName}
                    <span class="text-slate-500 ml-2 text-xs">
                      ({groupTabs().length})
                    </span>
                  </h3>
                  <ul class="space-y-1">
                    <For each={groupTabs()}>
                      {(tab) => (
                        <li class="text-xs text-slate-400 truncate flex items-center gap-2">
                          {tab.favicon && (
                            <img src={tab.favicon} alt="" class="w-3 h-3 rounded-sm" />
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
            class="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
            onClick={props.onConfirm}
          >
            Save {props.data.tabs.length} Tabs
          </button>
        </div>
      </div>
    </div>
  );
}
