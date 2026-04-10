import { type JSX, splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Markdown } from './markdown';

// --- Message ---

export interface MessageProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

function Message(props: MessageProps) {
  const [local, rest] = splitProps(props, ['children', 'class']);
  return (
    <div class={cn('flex gap-3', local.class)} {...rest}>
      {local.children}
    </div>
  );
}

// --- MessageAvatar ---

export interface MessageAvatarProps {
  src: string;
  alt: string;
  fallback?: string;
  class?: string;
}

function MessageAvatar(props: MessageAvatarProps) {
  return (
    <div class={cn('h-8 w-8 shrink-0 overflow-hidden rounded-full', props.class)}>
      <Show
        when={props.src}
        fallback={
          <Show when={props.fallback}>
            <div class="flex h-full w-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
              {props.fallback}
            </div>
          </Show>
        }
      >
        <img src={props.src} alt={props.alt} class="h-full w-full object-cover" />
      </Show>
    </div>
  );
}

// --- MessageContent ---

export interface MessageContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element | string;
  markdown?: boolean;
}

function MessageContent(props: MessageContentProps) {
  const [local, rest] = splitProps(props, ['children', 'markdown', 'class']);
  const classNames = () =>
    cn(
      'rounded-lg p-2 text-foreground bg-secondary prose dark:prose-invert prose-sm max-w-none break-words whitespace-normal',
      local.class
    );

  return (
    <Show
      when={local.markdown}
      fallback={
        <div class={classNames()} {...rest}>
          {local.children}
        </div>
      }
    >
      <Markdown content={local.children as string} class={classNames()} />
    </Show>
  );
}

// --- MessageActions ---

export interface MessageActionsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element;
}

function MessageActions(props: MessageActionsProps) {
  const [local, rest] = splitProps(props, ['children', 'class']);
  return (
    <div
      class={cn('text-muted-foreground flex items-center gap-2', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

// --- MessageAction ---

export interface MessageActionProps {
  tooltip: string;
  children: JSX.Element;
  side?: 'top' | 'bottom' | 'left' | 'right';
  class?: string;
}

function MessageAction(props: MessageActionProps) {
  // Simple wrapper - tooltip integration depends on the app's tooltip primitive
  return <>{props.children}</>;
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction };
