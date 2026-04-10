import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['default', 'ghost', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon', 'icon-sm'] },
    disabled: { control: 'boolean' },
  },
  args: {
    children: 'Click me',
    variant: 'default',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ghost' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Outline' },
};

export const Small: Story = {
  args: { size: 'sm', children: 'Small' },
};

export const Large: Story = {
  args: { size: 'lg', children: 'Large' },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
};

export const IconSmall: Story = {
  args: {
    size: 'icon-sm',
    children: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const AllVariants: Story = {
  render: () => (
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="default" size="sm">Small</Button>
      <Button variant="default" size="lg">Large</Button>
      <Button variant="default" size="icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </Button>
    </div>
  ),
};
