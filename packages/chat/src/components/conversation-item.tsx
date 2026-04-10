import { splitProps } from 'solid-js';
import { cn } from '../utils/cn';
import type { ConversationSummary } from '@tab-zen/shared';

export interface ConversationItemProps { conversation: ConversationSummary; isActive: boolean; onSelect: (id: string) => void; class?: string; }

export function ConversationItem(props: ConversationItemProps) {
  const [local] = splitProps(props, ['conversation', 'isActive', 'onSelect', 'class']);
  return (
    <button onClick={() => local.onSelect(local.conversation.id)}
      class={cn('w-full text-left rounded-lg px-2.5 py-2 transition-colors', local.isActive ? 'bg-muted' : 'hover:bg-muted/50', local.class)}>
      <div class={cn('text-[13px] truncate', local.isActive ? 'text-foreground font-medium' : 'text-muted-foreground')}>{local.conversation.title}</div>
      <div class="text-[11px] text-muted-foreground/60 truncate mt-0.5">{local.conversation.messageCount} messages</div>
    </button>
  );
}
