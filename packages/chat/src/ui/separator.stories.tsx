import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Separator } from './separator';

const meta: Meta = {
  title: 'UI/Separator',
};

export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => (
    <div class="w-64 rounded-lg bg-card p-4 border border-border">
      <p class="text-sm text-foreground mb-3">Above</p>
      <Separator />
      <p class="text-sm text-foreground mt-3">Below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div class="flex items-center gap-3 rounded-lg bg-card p-4 border border-border">
      <span class="text-sm text-foreground">Left</span>
      <div class="h-6">
        <Separator orientation="vertical" />
      </div>
      <span class="text-sm text-foreground">Right</span>
    </div>
  ),
};

export const VisualTest: Story = {
  render: () => (
    <div class="space-y-6 p-4">
      <div>
        <p class="text-xs text-muted-foreground mb-2">Horizontal separator:</p>
        <div class="w-64 bg-background p-4 rounded-lg">
          <p class="text-sm text-foreground">Content above</p>
          <div class="my-2">
            <Separator />
          </div>
          <p class="text-sm text-foreground">Content below</p>
        </div>
      </div>
      <div>
        <p class="text-xs text-muted-foreground mb-2">Vertical separator:</p>
        <div class="flex items-center gap-3 bg-background p-4 rounded-lg">
          <span class="text-sm text-foreground">Left</span>
          <div class="h-6">
            <Separator orientation="vertical" />
          </div>
          <span class="text-sm text-foreground">Right</span>
        </div>
      </div>
      <div>
        <p class="text-xs text-muted-foreground mb-2">Debug — separator with forced red bg to verify rendering:</p>
        <div class="w-64 bg-background p-4 rounded-lg">
          <p class="text-sm text-foreground">Above</p>
          <div class="my-2">
            <Separator class="!bg-red-500 !h-0.5" />
          </div>
          <p class="text-sm text-foreground">Below</p>
        </div>
      </div>
    </div>
  ),
};
