import { splitProps } from 'solid-js';
import { cn } from '../utils/cn';

export interface PromptSuggestionProps { text: string; highlight?: string; onClick?: () => void; class?: string; }

export function PromptSuggestion(props: PromptSuggestionProps) {
  const [local] = splitProps(props, ['text', 'highlight', 'onClick', 'class']);
  function renderText() {
    if (!local.highlight) return local.text;
    const idx = local.text.toLowerCase().indexOf(local.highlight.toLowerCase());
    if (idx === -1) return local.text;
    const before = local.text.slice(0, idx);
    const match = local.text.slice(idx, idx + local.highlight.length);
    const after = local.text.slice(idx + local.highlight.length);
    return <>{before}<span class="text-foreground font-medium">{match}</span>{after}</>;
  }
  return (
    <button onClick={local.onClick} class={cn('rounded-full bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer whitespace-nowrap', local.class)}>
      {renderText()}
    </button>
  );
}
