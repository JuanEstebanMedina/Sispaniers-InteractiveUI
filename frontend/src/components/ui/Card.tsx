import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

const cardVariants = cva('bg-surface border rounded-lg', {
  variants: {
    variant: {
      default: 'border-line',
      elevated: 'border-transparent shadow-md',
      sunken: 'bg-surface-sunken border-line-subtle',
      ghost: 'bg-transparent border-line',
    },
    interactive: {
      true: 'cursor-pointer transition-[border-color,box-shadow] duration-fast pointer-fine:hover:border-line-strong pointer-fine:hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, interactive, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, interactive }), className)} {...props} />
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        'px-gutter py-4 border-b border-line',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          {title && <h3 className="text-lg font-semibold leading-tight text-fg">{title}</h3>}
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
          {children}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  flush?: boolean
}

export function CardBody({ className, flush, ...props }: CardBodyProps) {
  return <div className={cn(!flush && 'p-gutter', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2',
        'px-gutter py-4 border-t border-line bg-surface-sunken/50 rounded-b-lg',
        className,
      )}
      {...props}
    />
  )
}
