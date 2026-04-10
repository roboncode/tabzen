import { type JSX, splitProps, createSignal } from 'solid-js';
import { cn } from '../utils/cn';
import { Textarea } from '../ui/textarea';

export interface PromptInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  maxHeight?: number;
  actions?: JSX.Element;
  class?: string;
}

export function PromptInput(props: PromptInputProps) {
  const [local] = splitProps(props, ['placeholder', 'onSubmit', 'isLoading', 'disabled', 'maxHeight', 'actions', 'class']);
  const [value, setValue] = createSignal('');

  function handleSubmit() {
    const text = value().trim();
    if (!text || local.isLoading || local.disabled) return;
    local.onSubmit(text);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  return (
    <div class={cn('rounded-xl bg-muted/40 p-3 flex flex-col gap-2', local.class)}>
      <Textarea value={value()} onInput={(e) => setValue(e.currentTarget.value)} onKeyDown={handleKeyDown}
        placeholder={local.placeholder} disabled={local.disabled || local.isLoading}
        maxHeight={local.maxHeight ?? 200} autoResize class="min-h-[20px]" />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">{local.actions}</div>
        <button onClick={handleSubmit} disabled={!value().trim() || local.isLoading || local.disabled}
          class={cn('h-7 w-7 rounded-md flex items-center justify-center transition-colors',
            value().trim() ? 'bg-ring text-background hover:bg-ring/90' : 'bg-muted text-muted-foreground cursor-not-allowed')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
