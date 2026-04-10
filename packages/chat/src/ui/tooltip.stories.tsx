import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Tooltip } from './tooltip';
import { Button } from './button';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  args: {
    content: 'Tooltip text',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <Button variant="outline">Hover me</Button>,
  },
};

export const OnIconButton: Story = {
  args: {
    content: 'Add new item',
    children: (
      <Button variant="ghost" size="icon-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Button>
    ),
  },
};
