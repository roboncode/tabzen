import { splitProps, Show, createMemo } from 'solid-js';
import { cn } from '../utils/cn';
import { HoverCard } from '../ui/hover-card';
import type { ContextInfo } from '@tab-zen/shared';

export interface ContextProps { info: ContextInfo; class?: string; }

export function Context(props: ContextProps) {
  const [local] = splitProps(props, ['info', 'class']);
  const percentage = createMemo(() => Math.round((local.info.usedTokens / local.info.maxTokens) * 100));
  const circumference = 2 * Math.PI * 10;
  const dashOffset = createMemo(() => circumference - (percentage() / 100) * circumference);
  const colorClass = createMemo(() => {
    if (percentage() > 90) return 'text-red-400';
    if (percentage() > 70) return 'text-yellow-400';
    return 'text-ring';
  });
  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
  function formatCost(n: number): string { return `$${n.toFixed(4)}`; }

  return (
    <HoverCard trigger={
      <button class={cn('flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors', local.class)}>
        <svg width="20" height="20" viewBox="0 0 24 24" class={colorClass()}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2" />
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray={String(circumference)} stroke-dashoffset={dashOffset()} stroke-linecap="round" transform="rotate(-90 12 12)" />
        </svg>
        <span>{percentage()}%</span>
      </button>
    } class="w-56">
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground font-medium">Context</span>
          <span class="text-muted-foreground">{formatTokens(local.info.usedTokens)} / {formatTokens(local.info.maxTokens)}</span>
        </div>
        <div class="h-1.5 rounded-full bg-muted overflow-hidden">
          <div class={cn('h-full rounded-full transition-all', colorClass().replace('text-', 'bg-'))} style={{ width: `${percentage()}%` }} />
        </div>
        <div class="space-y-1 text-xs text-muted-foreground">
          <Show when={local.info.inputTokens}><div class="flex justify-between"><span>Input</span><span>{formatTokens(local.info.inputTokens!)}</span></div></Show>
          <Show when={local.info.outputTokens}><div class="flex justify-between"><span>Output</span><span>{formatTokens(local.info.outputTokens!)}</span></div></Show>
          <Show when={local.info.reasoningTokens}><div class="flex justify-between"><span>Reasoning</span><span>{formatTokens(local.info.reasoningTokens!)}</span></div></Show>
          <Show when={local.info.cacheTokens}><div class="flex justify-between"><span>Cached</span><span>{formatTokens(local.info.cacheTokens!)}</span></div></Show>
        </div>
        <Show when={local.info.estimatedCost !== undefined}>
          <div class="flex justify-between text-xs border-t border-border pt-1.5 mt-1.5">
            <span class="text-muted-foreground">Estimated cost</span>
            <span class="text-foreground">{formatCost(local.info.estimatedCost!)}</span>
          </div>
        </Show>
      </div>
    </HoverCard>
  );
}
