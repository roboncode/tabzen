import { splitProps, createMemo, createUniqueId, For } from 'solid-js';
import { cn } from '../utils/cn';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export interface MarkdownProps {
  content: string;
  id?: string;
  class?: string;
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function MarkdownBlock(props: { content: string }) {
  const html = createMemo(() => {
    try {
      return marked.parse(props.content, { async: false }) as string;
    } catch {
      return props.content;
    }
  });

  return <div innerHTML={html()} />;
}

function Markdown(props: MarkdownProps) {
  const [local] = splitProps(props, ['content', 'id', 'class']);
  const blockId = () => local.id ?? createUniqueId();
  const blocks = createMemo(() => parseMarkdownIntoBlocks(local.content));

  return (
    <div class={cn('break-words whitespace-normal', local.class)}>
      <For each={blocks()}>
        {(block, index) => (
          <MarkdownBlock content={block} />
        )}
      </For>
    </div>
  );
}

export { Markdown };
