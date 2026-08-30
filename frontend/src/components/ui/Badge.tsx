import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'font-medium whitespace-nowrap',
    'border rounded-full',
    'transition-colors duration-fast',
  ],
  {
    variants: {
      tone: {
        neutral: 'bg-surface-hover text-fg-muted border-line',
        brand: 'bg-brand-subtle text-brand border-brand/25',
        accent: 'bg-accent-subtle text-accent border-accent/25',
        success: 'bg-success-subtle text-success-fg border-success/25',
        warning: 'bg-warning-subtle text-warning-fg border-warning/25',
        danger: 'bg-danger-subtle text-danger-fg border-danger/25',
        info: 'bg-info-subtle text-info-fg border-info/25',
        outline: 'bg-transparent text-fg-muted border-line',
      },
      size: {
        sm: 'h-5 px-2 text-2xs',
        md: 'h-6 px-2 text-xs',
        lg: 'h-7 px-3 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
}

export function Badge({ className, tone, size, dot, pulse, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && (
        <span
          className={cn('size-1.5 rounded-full bg-current', pulse && 'animate-pulse')}
          aria-hidden
        />
      )}
      {icon}
      {children}
    </span>
  )
}
