import { type JSX, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/tooltip';
import { Separator } from '../ui/separator';

export function Checkpoint(props: { children?: JSX.Element; class?: string }) {
  return (
    <div class={cn('flex items-center gap-3 py-2', props.class)}>
      <Separator class="flex-1" />
      <div class="flex items-center gap-1.5 text-muted-foreground">{props.children}</div>
      <Separator class="flex-1" />
    </div>
  );
}

export function CheckpointIcon(props: { class?: string }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={cn('text-muted-foreground', props.class)}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
}

export interface CheckpointTriggerProps { tooltip?: string; onClick?: () => void; children?: JSX.Element; class?: string; }
export function CheckpointTrigger(props: CheckpointTriggerProps) {
  const button = <Button variant="ghost" size="icon-sm" onClick={props.onClick} class={props.class}>{props.children ?? 'Restore'}</Button>;
  return <Show when={props.tooltip} fallback={button}><Tooltip content={props.tooltip!}>{button}</Tooltip></Show>;
}
