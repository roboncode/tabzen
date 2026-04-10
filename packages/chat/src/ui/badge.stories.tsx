import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  argTypes: {
    variant: { control: 'select', options: ['default', 'count', 'citation'] },
  },
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Default badge' },
};

export const Count: Story = {
  args: { variant: 'count', children: '12' },
};

export const Citation: Story = {
  args: { variant: 'citation', children: '1' },
};

export const AllVariants: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="count">5</Badge>
      <Badge variant="citation">1</Badge>
      <Badge variant="citation">2</Badge>
      <Badge variant="citation">3</Badge>
    </div>
  ),
};
