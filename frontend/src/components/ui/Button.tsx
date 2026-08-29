import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium whitespace-nowrap select-none',
    'rounded-md border border-transparent',
    'transition-[background-color,border-color,color,box-shadow,opacity]',
    'duration-fast ease-out-quart',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:shrink-0 [&_svg]:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-fg hover:bg-brand-hover active:bg-brand-active shadow-xs',
        secondary:
          'bg-surface-hover text-fg border-line hover:bg-surface-active hover:border-line-strong',
        outline: 'bg-transparent text-fg border-line hover:bg-surface-hover hover:border-line-strong',
        ghost: 'bg-transparent text-fg-muted hover:bg-surface-hover hover:text-fg',
        danger: 'bg-danger text-white hover:bg-danger-hover shadow-xs',
        soft: 'bg-brand-subtle text-brand hover:bg-brand-muted',
        link: 'bg-transparent text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        xs: 'h-control-xs px-2 text-xs [&_svg]:size-3.5',
        sm: 'h-control-sm px-3 text-sm [&_svg]:size-4',
        md: 'h-control-md px-4 text-base [&_svg]:size-4',
        lg: 'h-control-lg px-6 text-md [&_svg]:size-5',
        'icon-sm': 'h-control-sm w-control-sm p-0 [&_svg]:size-4',
        icon: 'h-control-md w-control-md p-0 [&_svg]:size-4',
        'icon-lg': 'h-control-lg w-control-lg p-0 [&_svg]:size-5',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, loading, icon, iconRight, children, disabled, ...props },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      type={props.type ?? 'button'}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
})
