import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Markdown } from './markdown';

const meta: Meta<typeof Markdown> = {
  title: 'Components/Markdown',
  component: Markdown,
  argTypes: {
    content: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  args: {
    content: 'This is a simple paragraph of text rendered through the Markdown component.',
    class: 'prose text-foreground',
  },
};

export const Headings: Story = {
  args: {
    content: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4

Some text below the headings.`,
    class: 'prose text-foreground',
  },
};

export const CodeBlocks: Story = {
  args: {
    content: `Here is some inline \`code\` in a paragraph.

\`\`\`typescript
const x: number = 42;
console.log(x);
\`\`\`

And another block:

\`\`\`python
print("hello world")
\`\`\``,
    class: 'prose text-foreground',
  },
};

export const Lists: Story = {
  args: {
    content: `### Unordered List
- First item
- Second item
  - Nested item
  - Another nested
- Third item

### Ordered List
1. Step one
2. Step two
3. Step three`,
    class: 'prose text-foreground',
  },
};

export const GFMTable: Story = {
  args: {
    content: `### Comparison Table

| Feature | SolidJS | React | Svelte |
|---------|---------|-------|--------|
| Reactivity | Fine-grained | Virtual DOM | Compiler |
| Bundle Size | ~7KB | ~40KB | ~2KB |
| Performance | Excellent | Good | Excellent |
| Learning Curve | Moderate | Moderate | Easy |`,
    class: 'prose text-foreground',
  },
};

export const RichContent: Story = {
  args: {
    content: `# Project Overview

This is a **comprehensive** guide to building modern web applications.

## Key Technologies

- **SolidJS** -- Reactive UI framework
- **TypeScript** -- Type-safe JavaScript
- **Tailwind CSS** -- Utility-first styling

## Getting Started

\`\`\`bash
pnpm create solid
cd my-app
pnpm install
pnpm dev
\`\`\`

> **Note:** Make sure you have Node.js 18+ installed.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI | SolidJS | Components |
| State | Signals | Reactivity |
| Styling | Tailwind | Design |

For more info, visit [solidjs.com](https://solidjs.com).`,
    class: 'prose text-foreground max-w-2xl',
  },
};
