import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FeedbackBar } from './feedback-bar';

const meta: Meta<typeof FeedbackBar> = {
  title: 'Components/FeedbackBar',
  component: FeedbackBar,
  argTypes: {
    title: { control: 'text' },
  },
  args: {
    title: 'Was this response helpful?',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomTitle: Story = {
  args: { title: 'Rate this answer' },
};

export const WithIcon: Story = {
  render: () => (
    <FeedbackBar
      title="How did I do?"
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      }
    />
  ),
};
