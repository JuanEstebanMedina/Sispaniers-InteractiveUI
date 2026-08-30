import { Check, Minus } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, indeterminate, disabled, ...props },
  ref,
) {
  const control = (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <input
        ref={(node) => {
          if (node) node.indeterminate = Boolean(indeterminate) && !node.checked
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="checkbox"
        disabled={disabled}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none',
          'rounded-xs border border-line-strong bg-surface',
          'transition-[background-color,border-color] duration-fast',
          'checked:border-brand checked:bg-brand',
          'indeterminate:border-brand indeterminate:bg-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <Check
        className="pointer-events-none absolute size-3 text-brand-fg opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
        aria-hidden
      />
      <Minus
        className="pointer-events-none absolute size-3 text-brand-fg opacity-0 peer-indeterminate:opacity-100"
        strokeWidth={3}
        aria-hidden
      />
    </span>
  )

  if (!label && !description) return control

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="mt-0.5">{control}</span>
      <span className="min-w-0">
        {label && <span className="block text-base text-fg">{label}</span>}
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
    </label>
  )
})

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  size?: 'sm' | 'md'
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, description, size = 'md', disabled, ...props },
  ref,
) {
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9'
  const thumb = size === 'sm' ? 'size-3 peer-checked:translate-x-3' : 'size-4 peer-checked:translate-x-4'

  const control = (
    <span className="relative inline-flex shrink-0 items-center">
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        disabled={disabled}
        className={cn(
          'peer cursor-pointer appearance-none rounded-full',
          'border border-line-strong bg-surface-active',
          'transition-colors duration-normal ease-out-quart',
          'checked:border-brand checked:bg-brand',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          track,
          className,
        )}
        {...props}
      />
      <span
        className={cn(
          'pointer-events-none absolute left-0.5 rounded-full bg-white shadow-xs',
          'transition-transform duration-normal ease-out-quart',
          thumb,
        )}
        aria-hidden
      />
    </span>
  )

  if (!label && !description) return control

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="min-w-0">
        {label && <span className="block text-base text-fg">{label}</span>}
        {description && <span className="block text-xs text-fg-muted">{description}</span>}
      </span>
      {control}
    </label>
  )
})
