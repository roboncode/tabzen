import { splitProps, createResource, createSignal, Show } from 'solid-js';
import { cn } from '../utils/cn';
import { Button } from '../ui/button';

export interface CodeBlockProps { code: string; language?: string; header?: string; class?: string; }

export function CodeBlock(props: CodeBlockProps) {
  const [local] = splitProps(props, ['code', 'language', 'header', 'class']);
  const [copied, setCopied] = createSignal(false);

  const [highlighted] = createResource(
    () => ({ code: local.code, lang: local.language ?? 'text' }),
    async ({ code, lang }) => {
      try {
        const { codeToHtml } = await import('shiki');
        return await codeToHtml(code, { lang, theme: 'github-dark-default' });
      } catch {
        return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
      }
    }
  );

  async function copyToClipboard() {
    await navigator.clipboard.writeText(local.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div class={cn('rounded-lg overflow-hidden bg-[#0d1117] my-2', local.class)}>
      <div class="flex items-center justify-between px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground">
        <span>{local.header ?? local.language ?? 'code'}</span>
        <Button variant="ghost" size="icon-sm" onClick={copyToClipboard}>
          <Show when={copied()} fallback={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          </Show>
        </Button>
      </div>
      <div class="p-3 text-sm overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!text-xs"
        innerHTML={highlighted() ?? `<pre><code>${local.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`} />
    </div>
  );
}
