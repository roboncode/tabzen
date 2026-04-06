import { createSignal, For, Show } from "solid-js";
import { ChevronDown, ChevronRight, Globe } from "lucide-solid";
import type { DomainInfo } from "@/lib/domains";

interface AppSidebarProps {
  domains: DomainInfo[];
  activeDomain: string | null;
  activeCreator: string | null;
  onSelectDomain: (domain: string | null) => void;
  onSelectCreator: (domain: string, creator: string | null) => void;
  totalCount: number;
}

export default function AppSidebar(props: AppSidebarProps) {
  const [expandedDomains, setExpandedDomains] = createSignal<Set<string>>(new Set());

  const toggleExpand = (domain: string) => {
    const next = new Set(expandedDomains());
    if (next.has(domain)) {
      next.delete(domain);
    } else {
      next.add(domain);
    }
    setExpandedDomains(next);
  };

  return (
    <div class="h-full bg-muted/20 overflow-y-auto scrollbar-hide">
      <div class="p-3">
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-2">
          Domains
        </p>

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

        {/* Domain list */}
        <div class="mt-1 space-y-0.5">
          <For each={props.domains}>
            {(domainInfo) => {
              const isActive = () => props.activeDomain === domainInfo.domain;
              const isExpanded = () => expandedDomains().has(domainInfo.domain);
              const hasSocialCreators = () => domainInfo.isSocial && domainInfo.creators.length > 0;

              return (
                <div>
                  <button
                    class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive() && !props.activeCreator
                        ? "bg-muted/50 text-foreground"
                        : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                    }`}
                    onClick={() => {
                      if (hasSocialCreators()) {
                        toggleExpand(domainInfo.domain);
                      }
                      props.onSelectDomain(domainInfo.domain);
                      props.onSelectCreator(domainInfo.domain, null);
                    }}
                  >
                    <Show when={hasSocialCreators()} fallback={<div class="w-3" />}>
                      <span class="w-3 flex items-center justify-center text-muted-foreground/50 flex-shrink-0">
                        {isExpanded() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                    </Show>
                      {(() => {
                        const src = domainInfo.favicon && !domainInfo.favicon.startsWith("chrome://")
                          ? domainInfo.favicon
                          : `https://www.google.com/s2/favicons?domain=${domainInfo.domain}&sz=32`;
                        return <img src={src} alt="" class="w-4 h-4 rounded flex-shrink-0" />;
                      })()}
                      <span class="flex-1 text-left truncate">{domainInfo.domain}</span>
                      <span class="text-xs text-muted-foreground/60">{domainInfo.count}</span>
                  </button>

                  {/* Creators (expanded) */}
                  <Show when={hasSocialCreators() && isExpanded()}>
                    <div class="ml-5 mt-0.5 space-y-0.5">
                      <For each={domainInfo.creators}>
                        {(creator) => {
                          const isCreatorActive = () =>
                            props.activeDomain === domainInfo.domain &&
                            props.activeCreator === creator.name;

                          return (
                            <button
                              class={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                                isCreatorActive()
                                  ? "bg-muted/50 text-foreground"
                                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                              }`}
                              onClick={() => {
                                props.onSelectDomain(domainInfo.domain);
                                props.onSelectCreator(domainInfo.domain, creator.name);
                              }}
                            >
                              {creator.avatar ? (
                                <img src={creator.avatar} alt="" class="w-4 h-4 rounded-full flex-shrink-0" />
                              ) : (
                                <div class="w-4 h-4 rounded-full bg-muted/50 flex-shrink-0" />
                              )}
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
            }}
          </For>
        </div>
      </div>
    </div>
  );
}
