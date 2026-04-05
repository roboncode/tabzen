import type { Tab } from "@/lib/types";

interface TabCardProps {
  tab: Tab;
  onOpen: (tab: Tab) => void;
  onEditNotes: (tab: Tab) => void;
}

export default function TabCard(props: TabCardProps) {
  const domain = () => {
    try {
      return new URL(props.tab.url).hostname.replace("www.", "");
    } catch {
      return props.tab.url;
    }
  };

  const description = () =>
    props.tab.ogDescription || props.tab.metaDescription || null;

  return (
    <div
      class="bg-slate-800 rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-blue-500 transition-all"
      onClick={() => props.onOpen(props.tab)}
    >
      {props.tab.ogImage && (
        <div class="h-32 overflow-hidden bg-slate-700">
          <img
            src={props.tab.ogImage}
            alt=""
            class="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div class="p-3">
        <div class="flex items-center gap-2 mb-1.5">
          {props.tab.favicon && (
            <img src={props.tab.favicon} alt="" class="w-4 h-4 rounded-sm" />
          )}
          <span class="text-xs text-slate-400 truncate">{domain()}</span>
        </div>
        <h3 class="text-sm font-medium text-slate-100 leading-snug line-clamp-2">
          {props.tab.ogTitle || props.tab.title}
        </h3>
        {description() && (
          <p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {description()}
          </p>
        )}
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-2">
            {props.tab.viewCount > 0 && (
              <span class="text-[10px] text-blue-400">
                👁 {props.tab.viewCount}
              </span>
            )}
            <span class="text-[10px] text-slate-500">
              {props.tab.sourceLabel}
            </span>
          </div>
          <button
            class={`text-[10px] ${props.tab.notes ? "text-slate-400" : "text-slate-600"} hover:text-slate-300`}
            onClick={(e) => {
              e.stopPropagation();
              props.onEditNotes(props.tab);
            }}
            title={props.tab.notes ? "Edit notes" : "Add notes"}
          >
            📝
          </button>
        </div>
      </div>
    </div>
  );
}
