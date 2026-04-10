import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { HoverCard } from '../ui/hover-card';
import { Badge } from '../ui/badge';

export interface SourceTriggerProps { label: string; index?: number; class?: string; }
export function SourceTrigger(props: SourceTriggerProps) {
  return (
    <Badge variant="citation" class={cn('text-[11px]', props.class)}>
      <Show when={props.index !== undefined} fallback={props.label}>
        <span class="font-semibold">{props.index}</span>
      </Show>
    </Badge>
  );
}

export interface SourceContentProps { title: string; description?: string; url?: string; timestamp?: string; }
export interface SourceProps { trigger: SourceTriggerProps; content: SourceContentProps; onClick?: () => void; class?: string; }

export function Source(props: SourceProps) {
  const [local] = splitProps(props, ['trigger', 'content', 'onClick', 'class']);
  return (
    <HoverCard trigger={<span onClick={local.onClick} class="cursor-pointer"><SourceTrigger {...local.trigger} /></span>} class={local.class}>
      <div class="space-y-1.5">
        <p class="text-sm font-medium text-foreground">{local.content.title}</p>
        <Show when={local.content.description}><p class="text-xs text-muted-foreground line-clamp-3">{local.content.description}</p></Show>
        <Show when={local.content.timestamp}><p class="text-xs text-muted-foreground">@ {local.content.timestamp}</p></Show>
        <Show when={local.content.url}><p class="text-xs text-citation truncate">{local.content.url}</p></Show>
      </div>
    </HoverCard>
  );
}

export function SourceList(props: { children: JSX.Element; class?: string }) {
  return <div class={cn('flex flex-wrap gap-1.5 mt-3', props.class)}>{props.children}</div>;
}
