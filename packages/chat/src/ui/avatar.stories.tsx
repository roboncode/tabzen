import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    src: { control: 'text' },
    alt: { control: 'text' },
    fallback: { control: 'text' },
  },
  args: {
    fallback: 'JD',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFallback: Story = {};

export const WithImage: Story = {
  args: {
    src: 'https://api.dicebear.com/7.x/initials/svg?seed=JD',
    alt: 'John Doe',
    fallback: 'JD',
  },
};

export const Small: Story = {
  args: { size: 'sm', fallback: 'S' },
};

export const Large: Story = {
  args: { size: 'lg', fallback: 'LG' },
};

export const AllSizes: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <Avatar size="sm" fallback="SM" />
      <Avatar size="md" fallback="MD" />
      <Avatar size="lg" fallback="LG" />
    </div>
  ),
};
