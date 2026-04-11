import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { createSignal } from 'solid-js';
import {
  ChatContainer, ChatContainerContent, ChatContainerScrollAnchor,
  Message, MessageAvatar, MessageContent, MessageActions,
  PromptInput, PromptInputTextarea, PromptInputActions,
  ConversationList, ModelSwitcher, PromptSuggestion,
  ScrollButton, Loader, Button, Separator,
  Context, ContextTrigger, ContextContent,
  ContextContentHeader, ContextContentBody, ContextContentFooter,
  ContextInputUsage, ContextOutputUsage,
} from '../index';
import type { ConversationSummary, ConversationGroup, ModelOption } from '@tab-zen/shared';
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, ArrowUp, Paperclip, Globe } from 'lucide-solid';

const meta: Meta = {
  title: 'Examples/Full Chat App',
};

export default meta;
type Story = StoryObj;

const scope = { type: 'document' as const };

const groups: ConversationGroup[] = [
  { id: 'today', name: 'Today', sortOrder: 0, createdAt: '2026-04-10' },
  { id: 'yesterday', name: 'Yesterday', sortOrder: 1, createdAt: '2026-04-09' },
  { id: 'week', name: 'Previous 7 Days', sortOrder: 2, createdAt: '2026-04-05' },
];

const conversations: ConversationSummary[] = [
  { id: '1', title: 'SolidJS reactivity vs React hooks', groupId: 'today', scope, messageCount: 8, lastMessageAt: '2026-04-10T15:30:00Z', updatedAt: '2026-04-10T15:30:00Z' },
  { id: '2', title: 'Tailwind v4 migration guide', groupId: 'today', scope, messageCount: 14, lastMessageAt: '2026-04-10T11:20:00Z', updatedAt: '2026-04-10T11:20:00Z' },
  { id: '3', title: 'Chrome extension content scripts', groupId: 'today', scope, messageCount: 6, lastMessageAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-10T09:00:00Z' },
  { id: '4', title: 'Vite HMR not working with web workers', groupId: 'yesterday', scope, messageCount: 11, lastMessageAt: '2026-04-09T17:45:00Z', updatedAt: '2026-04-09T17:45:00Z' },
  { id: '5', title: 'IndexedDB vs OPFS performance', groupId: 'yesterday', scope, messageCount: 9, lastMessageAt: '2026-04-09T14:00:00Z', updatedAt: '2026-04-09T14:00:00Z' },
  { id: '6', title: 'WebSocket reconnection strategies', groupId: 'week', scope, messageCount: 7, lastMessageAt: '2026-04-07T10:30:00Z', updatedAt: '2026-04-07T10:30:00Z' },
  { id: '7', title: 'TypeScript discriminated unions patterns', groupId: 'week', scope, messageCount: 16, lastMessageAt: '2026-04-06T16:20:00Z', updatedAt: '2026-04-06T16:20:00Z' },
  { id: '8', title: 'CSS container queries for responsive', groupId: 'week', scope, messageCount: 5, lastMessageAt: '2026-04-05T13:00:00Z', updatedAt: '2026-04-05T13:00:00Z' },
];

const models: ModelOption[] = [
  { id: 'claude-4', name: 'Claude 4 Opus', provider: 'Anthropic' },
  { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', provider: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
];

const assistantMarkdownResponse = `**SolidJS** takes a fundamentally different approach to reactivity compared to React hooks.

### Signals vs useState

In SolidJS, signals are **fine-grained reactive primitives** that track their own subscribers. When a signal updates, only the specific DOM nodes that read that signal are updated -- no virtual DOM diffing required.

\`\`\`typescript
// SolidJS - runs once, DOM updates surgically
const [count, setCount] = createSignal(0);
return <p>{count()}</p>; // only this text node re-renders

// React - entire component re-renders
const [count, setCount] = useState(0);
return <p>{count}</p>; // whole function re-executes
\`\`\`

### Key Differences

1. **No re-renders** -- SolidJS components run once; only reactive expressions update
2. **No dependency arrays** -- \`createEffect\` auto-tracks dependencies
3. **No stale closures** -- signals are getter functions, always current
4. **Derived values** are just functions, no \`useMemo\` needed

### When to choose SolidJS

- Performance-critical UIs with frequent updates
- Projects where you want predictable reactivity
- When you're tired of \`useCallback\` and dependency arrays`;

export const Default: Story = {
  render: () => {
    const [activeId, setActiveId] = createSignal('1');
    const [modelId, setModelId] = createSignal('claude-4');
    const [inputValue, setInputValue] = createSignal('');

    return (
      <div class="flex h-[680px] w-full max-w-5xl rounded-xl bg-background shadow-lg overflow-hidden">
        {/* Sidebar */}
        <div class="w-[270px] shrink-0">
          <ConversationList
            groups={groups}
            conversations={conversations}
            activeId={activeId()}
            onSelect={setActiveId}
            onNewChat={() => {}}
          />
        </div>

        {/* Main Chat Area */}
        <div class="flex flex-1 flex-col bg-background">
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-2.5 bg-background/80">
            <div class="flex items-center gap-3">
              <h2 class="text-sm font-semibold text-foreground">SolidJS reactivity vs React hooks</h2>
            </div>
            <div class="flex items-center gap-2">
              <ModelSwitcher models={models} currentModelId={modelId()} onModelChange={setModelId} />
              <Context usedTokens={12400} maxTokens={200000} inputTokens={8200} outputTokens={4200} estimatedCost={0.042}>
                <ContextTrigger />
                <ContextContent>
                  <ContextContentHeader />
                  <ContextContentBody>
                    <div class="space-y-1.5">
                      <ContextInputUsage />
                      <ContextOutputUsage />
                    </div>
                  </ContextContentBody>
                  <ContextContentFooter />
                </ContextContent>
              </Context>
            </div>
          </div>
          <Separator />

          {/* Messages */}
          <ChatContainer class="flex-1 p-4">
            <ChatContainerContent class="max-w-2xl mx-auto space-y-6 py-4">
              <Message>
                <MessageAvatar src="" fallback="U" alt="User" />
                <MessageContent>
                  Can you explain how SolidJS reactivity differs from React hooks? I keep hearing that SolidJS is faster but I don't understand why.
                </MessageContent>
              </Message>

              <Message>
                <MessageAvatar src="" fallback="AI" alt="Assistant" />
                <div class="flex-1 space-y-2">
                  <MessageContent markdown>
                    {assistantMarkdownResponse}
                  </MessageContent>
                  <MessageActions>
                    <Button variant="ghost" size="icon-sm"><Copy class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><ThumbsUp class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><ThumbsDown class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><RefreshCw class="size-3.5" /></Button>
                  </MessageActions>
                </div>
              </Message>

              <Message>
                <MessageAvatar src="" fallback="U" alt="User" />
                <MessageContent>
                  What about effects? How does createEffect compare to useEffect?
                </MessageContent>
              </Message>

              <Message>
                <MessageAvatar src="" fallback="AI" alt="Assistant" />
                <div class="flex-1 space-y-2">
                  <MessageContent markdown>
{`\`createEffect\` in SolidJS is synchronous by default and automatically tracks all reactive dependencies read inside it -- no dependency array needed.

\`\`\`typescript
// SolidJS -- auto-tracks count and name
createEffect(() => {
  console.log(count(), name());
});

// React -- must manually declare deps
useEffect(() => {
  console.log(count, name);
}, [count, name]); // easy to get wrong
\`\`\`

The biggest win: **no stale closure bugs**. Since \`count()\` is a function call, you always get the latest value. In React, closures capture the value at render time, which leads to subtle bugs with intervals, timeouts, and event handlers.`}
                  </MessageContent>
                  <MessageActions>
                    <Button variant="ghost" size="icon-sm"><Copy class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><ThumbsUp class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><ThumbsDown class="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm"><RefreshCw class="size-3.5" /></Button>
                  </MessageActions>
                </div>
              </Message>

              <ChatContainerScrollAnchor />
            </ChatContainerContent>

            {/* Scroll Button */}
            <div class="absolute bottom-32 left-1/2 -translate-x-1/2">
              <ScrollButton />
            </div>
          </ChatContainer>

          {/* Suggestions */}
          <div class="flex gap-2 px-4 pb-2 max-w-2xl mx-auto w-full flex-wrap">
            <PromptSuggestion onClick={() => setInputValue('How does SolidJS handle context?')}>
              How does SolidJS handle context?
            </PromptSuggestion>
            <PromptSuggestion onClick={() => setInputValue('Show me a SolidJS store example')}>
              Show me a store example
            </PromptSuggestion>
          </div>

          {/* Input */}
          <div class="px-4 pb-4 max-w-2xl mx-auto w-full">
            <PromptInput value={inputValue()} onValueChange={setInputValue} onSubmit={() => setInputValue('')}>
              <PromptInputTextarea placeholder="Ask a follow-up question..." />
              <PromptInputActions class="justify-between">
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm"><Paperclip class="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm"><Globe class="size-4" /></Button>
                </div>
                <Button variant="default" size="icon-sm" class="rounded-full">
                  <ArrowUp class="size-4" />
                </Button>
              </PromptInputActions>
            </PromptInput>
          </div>
        </div>
      </div>
    );
  },
};
