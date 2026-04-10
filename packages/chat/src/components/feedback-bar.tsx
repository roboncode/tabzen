import { splitProps } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';

export interface FeedbackBarProps { title?: string; onHelpful?: () => void; onNotHelpful?: () => void; onClose?: () => void; class?: string; }

export function FeedbackBar(props: FeedbackBarProps) {
  const [local] = splitProps(props, ['title', 'onHelpful', 'onNotHelpful', 'onClose', 'class']);
  return (
    <div class={cn('flex items-center gap-2 text-xs text-muted-foreground', local.class)}>
      <span>{local.title ?? 'Was this helpful?'}</span>
      <Button variant="ghost" size="icon-sm" onClick={local.onHelpful}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2h0a3.13 3.13 0 013 3.88z"/></svg>
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={local.onNotHelpful}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22h0a3.13 3.13 0 01-3-3.88z"/></svg>
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={local.onClose}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </Button>
    </div>
  );
}
