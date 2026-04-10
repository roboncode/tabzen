import { splitProps, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { useTextStream } from '../primitives/use-text-stream';
import { Markdown } from './markdown';
import { Loader } from './loader';

export interface ResponseStreamProps {
  source: string | AsyncIterable<string>;
  mode?: 'typewriter' | 'fade';
  speed?: number;
  class?: string;
  onComplete?: () => void;
}

export function ResponseStream(props: ResponseStreamProps) {
  const [local] = splitProps(props, ['source', 'mode', 'speed', 'class', 'onComplete']);
  const stream = useTextStream({ mode: local.mode ?? 'typewriter', speed: local.speed });
  stream.startStreaming(local.source);
  return (
    <div class={cn('relative', local.class)}>
      <Show when={stream.displayedText()} fallback={<Loader variant="loading-dots" size="sm" />}>
        <Markdown content={stream.displayedText()} />
      </Show>
      <Show when={!stream.isComplete()}>
        <span class="inline-block w-1.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />
      </Show>
    </div>
  );
}
