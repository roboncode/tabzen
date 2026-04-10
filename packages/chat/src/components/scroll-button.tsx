import { Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';
import { useChatContainer } from './chat-container';

export interface ScrollButtonProps { class?: string; }

export function ScrollButton(props: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useChatContainer();
  return (
    <Show when={!isAtBottom()}>
      <Button variant="outline" size="icon" onClick={() => scrollToBottom()}
        class={cn('absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10', props.class)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </Button>
    </Show>
  );
}
