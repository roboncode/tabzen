import type { Tab } from "@/lib/types";

interface TabRowProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function TabRow(props: TabRowProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  return (
    <div
      class="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/50 cursor-pointer rounded-md transition-colors"
      onClick={() => props.onOpen(props.tab)}
    >
      {props.tab.favicon ? (
        <img src={props.tab.favicon} alt="" class="w-4 h-4 rounded-sm flex-shrink-0" />
      ) : (
        <div class="w-4 h-4 bg-slate-700 rounded-sm flex-shrink-0" />
      )}
      <div class="flex-1 min-w-0">
        <div class="text-sm text-slate-200 truncate">{props.tab.title}</div>
        <div class="text-xs text-slate-500 truncate">{domain()}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        {props.tab.viewCount > 0 && (
          <span class="text-[10px] text-blue-400">👁 {props.tab.viewCount}</span>
        )}
        <button
          class={`text-[10px] ${props.tab.notes ? "text-slate-400" : "text-slate-600"} hover:text-slate-300`}
          onClick={(e) => {
            e.stopPropagation();
            props.onEditNotes(props.tab);
          }}
        >
          📝
        </button>
      </div>
    </div>
  );
}
