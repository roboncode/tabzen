import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
  title: 'UI/Separator',
  component: Separator,
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  decorators: [
    (Story) => (
      <div class="w-64">
        <p class="text-sm text-foreground">Above</p>
        <div class="my-3">{Story()}</div>
        <p class="text-sm text-foreground">Below</p>
      </div>
    ),
  ],
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div class="flex h-8 items-center gap-3">
        <span class="text-sm text-foreground">Left</span>
        {Story()}
        <span class="text-sm text-foreground">Right</span>
      </div>
    ),
  ],
};
