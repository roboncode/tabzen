import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TextShimmer } from './text-shimmer';

const meta: Meta<typeof TextShimmer> = {
  title: 'Components/TextShimmer',
  component: TextShimmer,
  argTypes: {
    duration: { control: { type: 'range', min: 1, max: 10, step: 0.5 } },
    spread: { control: { type: 'range', min: 5, max: 45, step: 5 } },
    as: { control: 'select', options: ['span', 'p', 'h1', 'h2', 'h3'] },
  },
  args: {
    children: 'Shimmering text effect',
    duration: 4,
    spread: 20,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FastShimmer: Story = {
  args: { children: 'Fast shimmer animation', duration: 1.5 },
};

export const SlowShimmer: Story = {
  args: { children: 'Slow shimmer animation', duration: 8 },
};

export const WideSpread: Story = {
  args: { children: 'Wide spread shimmer', spread: 40 },
};

export const NarrowSpread: Story = {
  args: { children: 'Narrow spread shimmer', spread: 5 },
};

export const AsHeading: Story = {
  args: { children: 'Shimmer Heading', as: 'h2', class: 'text-2xl' },
};
