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
  render: () => (
    <div class="w-64 rounded-lg bg-card p-4">
      <p class="text-sm text-foreground">Above</p>
      <div class="my-3">
        <Separator orientation="horizontal" />
      </div>
      <p class="text-sm text-foreground">Below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div class="flex h-8 items-center gap-3 rounded-lg bg-card p-4">
      <span class="text-sm text-foreground">Left</span>
      <Separator orientation="vertical" />
      <span class="text-sm text-foreground">Right</span>
    </div>
  ),
};
