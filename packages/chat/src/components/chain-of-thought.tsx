import { type JSX, createSignal } from 'solid-js';
import { cn } from '../utils/cn';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';

export function ChainOfThought(props: { children: JSX.Element; class?: string }) {
  return <div class={cn('space-y-1', props.class)}>{props.children}</div>;
}

export function ChainOfThoughtStep(props: { children: JSX.Element; defaultOpen?: boolean }) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  return <Collapsible open={open()} onOpenChange={setOpen}>{props.children}</Collapsible>;
}

export function ChainOfThoughtTrigger(props: { children: JSX.Element; class?: string }) {
  return (
    <CollapsibleTrigger class={cn('flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group w-full', props.class)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform group-data-[expanded]:rotate-90"><polyline points="9 18 15 12 9 6"/></svg>
      {props.children}
    </CollapsibleTrigger>
  );
}

export function ChainOfThoughtItemContent(props: { children: JSX.Element; class?: string }) {
  return <CollapsibleContent class={cn('pl-5 pt-1 text-sm text-muted-foreground', props.class)}>{props.children}</CollapsibleContent>;
}
