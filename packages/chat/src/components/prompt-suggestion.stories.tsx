import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PromptSuggestion } from './prompt-suggestion';

const meta: Meta<typeof PromptSuggestion> = {
  title: 'Components/PromptSuggestion',
  component: PromptSuggestion,
  argTypes: {
    variant: { control: 'select', options: ['outline', 'ghost', 'default'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon', 'icon-sm'] },
    highlight: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Tell me about TypeScript' },
};

export const WithHighlight: Story = {
  args: {
    children: 'Tell me about TypeScript generics',
    highlight: 'TypeScript',
  },
};

export const MultipleSuggestions: Story = {
  render: () => (
    <div class="flex flex-wrap gap-2">
      <PromptSuggestion>What is SolidJS?</PromptSuggestion>
      <PromptSuggestion>Explain reactive signals</PromptSuggestion>
      <PromptSuggestion>Compare SolidJS vs React</PromptSuggestion>
      <PromptSuggestion>Best practices for state management</PromptSuggestion>
    </div>
  ),
};

export const WithHighlightedSearch: Story = {
  render: () => (
    <div class="w-72 space-y-1">
      <PromptSuggestion highlight="solid">How does SolidJS handle reactivity?</PromptSuggestion>
      <PromptSuggestion highlight="solid">What makes SolidJS fast?</PromptSuggestion>
      <PromptSuggestion highlight="solid">SolidJS vs Svelte comparison</PromptSuggestion>
    </div>
  ),
};
