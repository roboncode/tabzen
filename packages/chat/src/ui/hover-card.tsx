import { HoverCard as KHoverCard } from '@kobalte/core/hover-card';
import { type JSX, splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface HoverCardProps { trigger: JSX.Element; children: JSX.Element; class?: string; }

export function HoverCard(props: HoverCardProps) {
  const [local] = splitProps(props, ['trigger', 'children', 'class']);
  return (
    <KHoverCard>
      <KHoverCard.Trigger as="span">{local.trigger}</KHoverCard.Trigger>
      <KHoverCard.Portal>
        <KHoverCard.Content class={cn('z-50 w-64 rounded-lg bg-card p-4 shadow-lg animate-in fade-in-0 zoom-in-95', local.class)}>
          <KHoverCard.Arrow />
          {local.children}
        </KHoverCard.Content>
      </KHoverCard.Portal>
    </KHoverCard>
  );
}
