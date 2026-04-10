import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { For } from 'solid-js';
import { Loader, type LoaderVariant, type LoaderSize } from './loader';

const meta: Meta<typeof Loader> = {
  title: 'Components/Loader',
  component: Loader,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'circular', 'classic', 'pulse', 'pulse-dot', 'dots', 'typing',
        'wave', 'bars', 'terminal', 'text-blink', 'text-shimmer', 'loading-dots',
      ],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    text: { control: 'text' },
  },
  args: {
    variant: 'circular',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Classic: Story = { args: { variant: 'classic' } };
export const Pulse: Story = { args: { variant: 'pulse' } };
export const PulseDot: Story = { args: { variant: 'pulse-dot' } };
export const Dots: Story = { args: { variant: 'dots' } };
export const Typing: Story = { args: { variant: 'typing' } };
export const Wave: Story = { args: { variant: 'wave' } };
export const Bars: Story = { args: { variant: 'bars' } };
export const Terminal: Story = { args: { variant: 'terminal' } };
export const TextBlink: Story = { args: { variant: 'text-blink', text: 'Thinking' } };
export const TextShimmer: Story = { args: { variant: 'text-shimmer', text: 'Analyzing' } };
export const LoadingDots: Story = { args: { variant: 'loading-dots', text: 'Processing' } };

const allVariants: LoaderVariant[] = [
  'circular', 'classic', 'pulse', 'pulse-dot', 'dots', 'typing',
  'wave', 'bars', 'terminal', 'text-blink', 'text-shimmer', 'loading-dots',
];

const allSizes: LoaderSize[] = ['sm', 'md', 'lg'];

export const AllVariantsGrid: Story = {
  render: () => (
    <div class="space-y-6">
      <For each={allVariants}>
        {(variant) => (
          <div class="flex items-center gap-6">
            <span class="w-28 text-sm text-muted-foreground font-mono">{variant}</span>
            <For each={allSizes}>
              {(size) => (
                <div class="flex items-center justify-center w-24 h-10">
                  <Loader
                    variant={variant}
                    size={size}
                    text={['text-blink', 'text-shimmer', 'loading-dots'].includes(variant) ? 'Loading' : undefined}
                  />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div class="flex items-end gap-6">
      <div class="text-center space-y-2">
        <Loader variant="circular" size="sm" />
        <p class="text-xs text-muted-foreground">Small</p>
      </div>
      <div class="text-center space-y-2">
        <Loader variant="circular" size="md" />
        <p class="text-xs text-muted-foreground">Medium</p>
      </div>
      <div class="text-center space-y-2">
        <Loader variant="circular" size="lg" />
        <p class="text-xs text-muted-foreground">Large</p>
      </div>
    </div>
  ),
};
