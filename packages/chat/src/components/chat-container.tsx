import { type JSX, splitProps, createContext, useContext } from 'solid-js';
import { cn } from '../utils/cn';
import { useStickToBottom } from '../primitives/use-stick-to-bottom';

interface ChatContainerContextValue {
  isAtBottom: () => boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

const ChatContainerContext = createContext<ChatContainerContextValue>();

export function useChatContainer() {
  const ctx = useContext(ChatContainerContext);
  if (!ctx) throw new Error('useChatContainer must be used within ChatContainer');
  return ctx;
}

export interface ChatContainerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

export function ChatContainer(props: ChatContainerProps) {
  const [local, rest] = splitProps(props, ['children', 'class']);
  const { ref, isAtBottom, scrollToBottom } = useStickToBottom();
  return (
    <ChatContainerContext.Provider value={{ isAtBottom, scrollToBottom }}>
      <div ref={ref} class={cn('flex flex-1 flex-col overflow-y-auto', local.class)} {...rest}>
        {local.children}
      </div>
    </ChatContainerContext.Provider>
  );
}
