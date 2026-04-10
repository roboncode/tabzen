import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Message, MessageAvatar, MessageContent, MessageActions } from './message';
import { Button } from '../ui/button';

const meta: Meta = {
  title: 'Components/Message',
};

export default meta;
type Story = StoryObj;

export const UserMessage: Story = {
  render: () => (
    <Message>
      <MessageAvatar src="" fallback="U" alt="User" />
      <MessageContent>Hello, can you help me with something?</MessageContent>
    </Message>
  ),
};

export const AssistantMessage: Story = {
  render: () => (
    <Message>
      <MessageAvatar src="" fallback="AI" alt="Assistant" />
      <MessageContent>
        Of course! I'd be happy to help. What would you like to know?
      </MessageContent>
    </Message>
  ),
};

export const MarkdownMessage: Story = {
  render: () => (
    <Message>
      <MessageAvatar src="" fallback="AI" alt="Assistant" />
      <MessageContent markdown>
        {`Here's a **bold** statement with some \`inline code\` and a list:

- First item
- Second item
- Third item

And a code block:

\`\`\`typescript
const greeting = "Hello, world!";
console.log(greeting);
\`\`\``}
      </MessageContent>
    </Message>
  ),
};

export const WithActions: Story = {
  render: () => (
    <div class="space-y-2">
      <Message>
        <MessageAvatar src="" fallback="AI" alt="Assistant" />
        <div class="space-y-2">
          <MessageContent>Here is a response with actions below it.</MessageContent>
          <MessageActions>
            <Button variant="ghost" size="icon-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
            </Button>
          </MessageActions>
        </div>
      </Message>
    </div>
  ),
};

export const Conversation: Story = {
  render: () => (
    <div class="space-y-4 max-w-2xl">
      <Message>
        <MessageAvatar src="" fallback="U" alt="User" />
        <MessageContent>What is TypeScript?</MessageContent>
      </Message>
      <Message>
        <MessageAvatar src="" fallback="AI" alt="Assistant" />
        <MessageContent markdown>
          {`**TypeScript** is a strongly typed programming language that builds on JavaScript. It adds optional static type checking and other features like interfaces, enums, and generics.

Key benefits:
- Catches errors at compile time
- Better IDE support and autocompletion
- Makes large codebases more maintainable`}
        </MessageContent>
      </Message>
    </div>
  ),
};
