import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronDown, ChevronRight, Globe, MessagesSquare, FolderInput, Layers, AppWindow, Folder } from "lucide-solid";
import type { DomainInfo, TypeGroup, FolderInfo } from "@/lib/domains";
import Avatar from "./Avatar";

interface AppSidebarProps {
  domains: DomainInfo[];
  activeDomain: string | null;
  activeCreator: string | null;
  onSelectDomain: (domain: string | null) => void;
  onSelectCreator: (domain: string, creator: string | null) => void;
  totalCount: number;
  // Optional — wired in Task 8
  typeGroups?: TypeGroup[];
  groupBy?: "domain" | "type" | "folders";
  onSetGroupBy?: (mode: "domain" | "type" | "folders") => void;
  onMoveDomain?: (domain: string) => void;
  // Folder view
  folders?: FolderInfo[];
  activeFolder?: string | null;
  onSelectFolder?: (name: string | null) => void;
}

export default function AppSidebar(props: AppSidebarProps) {
  const navigate = useNavigate();

  // Default to "domain" when groupBy is not provided
  const mode = () => props.groupBy ?? "domain";

  const [expandedDomains, setExpandedDomains] = createSignal<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = createSignal<Set<string>>(new Set());
  const [expandedOther, setExpandedOther] = createSignal<Set<string>>(new Set());

  const toggleExpand = (domain: string) => {
    const next = new Set(expandedDomains());
    next.has(domain) ? next.delete(domain) : next.add(domain);
    setExpandedDomains(next);
  };
  const toggleType = (id: string) => {
    const next = new Set(expandedTypes());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedTypes(next);
  };
  const toggleOther = (id: string) => {
    const next = new Set(expandedOther());
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedOther(next);
  };

  const DomainRow = (p: { domainInfo: DomainInfo }) => {
    const isActive = () => props.activeDomain === p.domainInfo.domain;
    const isExpanded = () => expandedDomains().has(p.domainInfo.domain);
    const hasSocialCreators = () =>
      p.domainInfo.isSocial && p.domainInfo.creators.length > 0;
    const favSrc =
      p.domainInfo.favicon && !p.domainInfo.favicon.startsWith("chrome://")
        ? p.domainInfo.favicon
        : `https://www.google.com/s2/favicons?domain=${p.domainInfo.domain}&sz=32`;

    return (
      <div class={hasSocialCreators() && isExpanded() ? "mb-2 pb-1" : ""}>
        <div class="group/row flex items-center">
          <button
            class={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
              isActive() && !props.activeCreator
                ? "bg-muted/50 text-foreground"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
            onClick={() => {
              if (hasSocialCreators()) toggleExpand(p.domainInfo.domain);
              props.onSelectDomain(p.domainInfo.domain);
              props.onSelectCreator(p.domainInfo.domain, null);
            }}
          >
            <Show when={hasSocialCreators()} fallback={<div class="w-3" />}>
              <span class="w-3 flex items-center justify-center text-muted-foreground/50 flex-shrink-0">
                {isExpanded() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </Show>
            <img src={favSrc} alt="" class="w-4 h-4 rounded flex-shrink-0" />
            <span class="flex-1 text-left truncate">{p.domainInfo.domain}</span>
            <span class="text-xs text-muted-foreground/60">{p.domainInfo.count}</span>
          </button>
          <Show when={props.onMoveDomain}>
            <button
              class="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 text-muted-foreground/60 hover:text-foreground flex-shrink-0"
              title="Move to group"
              onClick={(e) => {
                e.stopPropagation();
                props.onMoveDomain!(p.domainInfo.domain);
              }}
            >
              <FolderInput size={13} />
            </button>
          </Show>
        </div>

        <Show when={hasSocialCreators() && isExpanded()}>
          <div class="ml-5 mt-0.5 space-y-0.5">
            <For each={p.domainInfo.creators}>
              {(creator) => {
                const isCreatorActive = () =>
                  props.activeDomain === p.domainInfo.domain &&
                  props.activeCreator === creator.name;
                return (
                  <button
                    class={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isCreatorActive()
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    onClick={() => {
                      props.onSelectDomain(p.domainInfo.domain);
                      props.onSelectCreator(p.domainInfo.domain, creator.name);
                    }}
                  >
                    <Avatar src={creator.avatar} size="sm" />
                    <span class="flex-1 text-left truncate">{creator.name}</span>
                    <span class="text-xs text-muted-foreground/60">{creator.count}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="h-full overflow-y-auto scrollbar-hide">
      {/* App name — matches detail page DocumentNav */}
      <div class="h-16 flex items-center px-5">
        <button onClick={() => props.onSelectDomain(null)} class="text-sm font-bold text-foreground hover:text-foreground/80 transition-colors">Tab Zen</button>
      </div>
      <div class="mx-5 border-b-3 border-muted-foreground/10" />

      <div class="flex flex-col gap-0.5 px-5 pt-6">
        {/* Ask the collection (knowledge-base chat) */}
        <button
          class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors mb-2"
          onClick={() => navigate("/chat")}
        >
          <MessagesSquare size={15} class="flex-shrink-0" />
          <span class="flex-1 text-left truncate">Ask Collection</span>
        </button>

        {/* Open Tabs */}
        <button
          class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors mb-2"
          onClick={() => navigate("/open-tabs")}
        >
          <AppWindow size={15} class="flex-shrink-0" />
          <span class="flex-1 text-left truncate">Open Tabs</span>
        </button>

        {/* All domains */}
        <button
          class={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
            !props.activeDomain
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          }`}
          onClick={() => props.onSelectDomain(null)}
        >
          <Globe size={15} class="flex-shrink-0" />
          <span class="flex-1 text-left truncate">All Domains</span>
          <span class="text-xs text-muted-foreground">{props.totalCount}</span>
        </button>

        {/* Group-by toggle */}
        <div class="flex items-center gap-1 mt-3 mb-1 px-1">
          <span class="text-xs text-muted-foreground/60 flex-1">Group by</span>
          <div class="flex gap-1 bg-muted/30 rounded-full p-0.5">
            <For each={["domain", "type", "folders"] as const}>
              {(m) => (
                <button
                  class={`px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors ${
                    mode() === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => props.onSetGroupBy?.(m)}
                >
                  {m === "domain" ? "Domain" : m === "type" ? "Type" : "Folders"}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Domain view */}
        <Show when={mode() === "domain"}>
          <div class="mt-1 space-y-0.5">
            <For each={props.domains}>{(d) => <DomainRow domainInfo={d} />}</For>
          </div>
        </Show>

        {/* Type view */}
        <Show when={mode() === "type"}>
          <div class="mt-1 space-y-1.5">
            <For each={props.typeGroups ?? []}>
              {(tg) => {
                const isOpen = () => !expandedTypes().has(tg.type.id); // open by default
                const otherOpen = () => expandedOther().has(tg.type.id);
                return (
                  <div>
                    <button
                      class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleType(tg.type.id)}
                    >
                      <span class="w-3 flex items-center justify-center text-muted-foreground/50 flex-shrink-0">
                        {isOpen() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <Layers size={14} class="flex-shrink-0 text-muted-foreground/60" />
                      <span class="flex-1 text-left truncate">{tg.type.label}</span>
                      <span class="text-xs text-muted-foreground/60">{tg.count}</span>
                    </button>
                    <Show when={isOpen()}>
                      <div class="ml-3 mt-0.5 space-y-0.5">
                        <For each={tg.domains}>{(d) => <DomainRow domainInfo={d} />}</For>
                        <Show when={tg.otherSites}>
                          <button
                            class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground transition-colors"
                            onClick={() => toggleOther(tg.type.id)}
                          >
                            <span class="w-3 flex items-center justify-center text-muted-foreground/40 flex-shrink-0">
                              {otherOpen() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <span class="flex-1 text-left truncate">
                              Other sites ({tg.otherSites!.domains.length})
                            </span>
                            <span class="text-xs text-muted-foreground/50">{tg.otherSites!.count}</span>
                          </button>
                          <Show when={otherOpen()}>
                            <div class="ml-3 space-y-0.5">
                              <For each={tg.otherSites!.domains}>{(d) => <DomainRow domainInfo={d} />}</For>
                            </div>
                          </Show>
                        </Show>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Folders view */}
        <Show when={mode() === "folders"}>
          <div class="mt-1 space-y-0.5">
            <For each={props.folders ?? []}>
              {(folder) => {
                const isActive = () => props.activeFolder === folder.name;
                return (
                  <button
                    class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive()
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    onClick={() => props.onSelectFolder?.(isActive() ? null : folder.name)}
                  >
                    <Folder size={14} class="flex-shrink-0 text-muted-foreground/60" />
                    <span class="flex-1 text-left truncate">{folder.name}</span>
                    <span class="text-xs text-muted-foreground/60">{folder.count}</span>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
