import { type JSX, splitProps, createContext, useContext } from 'solid-js';
import { cn } from '../utils/cn';
import { Avatar } from '../ui/avatar';
import { Tooltip } from '../ui/tooltip';
import { Button } from '../ui/button';

type MessageRole = 'user' | 'assistant';
interface MessageContextValue { role: MessageRole; }
const MessageContext = createContext<MessageContextValue>();
function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('Message subcomponents must be used within Message');
  return ctx;
}

export interface MessageProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'role'> {
  role: MessageRole;
  children: JSX.Element;
}

export function Message(props: MessageProps) {
  const [local, rest] = splitProps(props, ['role', 'children', 'class']);
  return (
    <MessageContext.Provider value={{ role: local.role }}>
      <div class={cn('flex gap-3', local.role === 'user' ? 'justify-end' : 'justify-start', local.class)} {...rest}>
        {local.children}
      </div>
    </MessageContext.Provider>
  );
}

export interface MessageAvatarProps { src?: string; fallback: string; class?: string; }
export function MessageAvatar(props: MessageAvatarProps) {
  return <Avatar src={props.src} fallback={props.fallback} size="md" class={cn('mt-0.5', props.class)} />;
}

export interface MessageContentProps extends JSX.HTMLAttributes<HTMLDivElement> { children: JSX.Element; }
export function MessageContent(props: MessageContentProps) {
  const { role } = useMessage();
  const [local, rest] = splitProps(props, ['children', 'class']);
  return (
    <div class={cn('rounded-xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%]',
      role === 'user' ? 'bg-muted text-foreground rounded-br-sm' : 'flex-1 text-foreground',
      local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export interface MessageActionsProps { children: JSX.Element; class?: string; }
export function MessageActions(props: MessageActionsProps) {
  return <div class={cn('flex items-center gap-1 mt-1', props.class)}>{props.children}</div>;
}

export interface MessageActionProps { tooltip: string; children: JSX.Element; onClick?: () => void; }
export function MessageAction(props: MessageActionProps) {
  return (
    <Tooltip content={props.tooltip}>
      <Button variant="ghost" size="icon-sm" onClick={props.onClick}>{props.children}</Button>
    </Tooltip>
  );
}
