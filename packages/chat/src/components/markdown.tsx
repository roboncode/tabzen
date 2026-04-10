import { splitProps, createMemo } from 'solid-js';
import { cn } from '../utils/cn';
import { marked } from 'marked';

export interface MarkdownProps { content: string; class?: string; }

export function Markdown(props: MarkdownProps) {
  const [local] = splitProps(props, ['content', 'class']);
  const html = createMemo(() => {
    try {
      return marked.parse(local.content, { async: false }) as string;
    } catch {
      return local.content;
    }
  });
  return (
    <div class={cn('prose prose-invert prose-sm max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5', local.class)} innerHTML={html()} />
  );
}
