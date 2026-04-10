import { splitProps, Switch, Match } from 'solid-js';
import { cn } from '../utils/cn';

type LoaderVariant = 'bars' | 'text-shimmer' | 'loading-dots' | 'pulse-dot';
type LoaderSize = 'sm' | 'md' | 'lg';

export interface LoaderProps { variant: LoaderVariant; size?: LoaderSize; text?: string; class?: string; }

const dotSizes = { sm: 'h-1 w-1', md: 'h-1.5 w-1.5', lg: 'h-2 w-2' };
const barSizes = { sm: 'h-3 w-0.5', md: 'h-4 w-1', lg: 'h-5 w-1' };
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export function Loader(props: LoaderProps) {
  const [local] = splitProps(props, ['variant', 'size', 'text', 'class']);
  const size = () => local.size ?? 'md';
  return (
    <div class={cn('inline-flex items-center gap-1', local.class)} data-variant={local.variant}>
      <Switch>
        <Match when={local.variant === 'bars'}>
          <div class="flex items-end gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div class={cn('rounded-full bg-muted-foreground animate-pulse', barSizes[size()])} style={{ 'animation-delay': `${i * 150}ms` }} />
            ))}
          </div>
        </Match>
        <Match when={local.variant === 'text-shimmer'}>
          <span class={cn('bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer', textSizes[size()])}>
            {local.text ?? 'Thinking...'}
          </span>
        </Match>
        <Match when={local.variant === 'loading-dots'}>
          <div class="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div class={cn('rounded-full bg-muted-foreground animate-bounce', dotSizes[size()])} style={{ 'animation-delay': `${i * 200}ms` }} />
            ))}
          </div>
        </Match>
        <Match when={local.variant === 'pulse-dot'}>
          <div class="relative flex items-center justify-center">
            <div class={cn('rounded-full bg-muted-foreground animate-ping absolute', dotSizes[size()])} />
            <div class={cn('rounded-full bg-muted-foreground', dotSizes[size()])} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}
