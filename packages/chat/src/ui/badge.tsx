import { type JSX, splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const badgeVariants = cva('inline-flex items-center rounded-full text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      count: 'bg-muted text-muted-foreground min-w-5 h-5 justify-center px-1.5',
      citation: 'bg-citation text-white px-1.5 py-0.5 cursor-pointer',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['variant', 'class', 'children']);
  return <span class={cn(badgeVariants({ variant: local.variant }), local.class)} {...rest}>{local.children}</span>;
}
