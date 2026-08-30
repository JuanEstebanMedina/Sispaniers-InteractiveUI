import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, Search, X } from 'lucide-react'
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { useFieldProps } from './Field'

const controlVariants = cva(
  [
    'w-full rounded-md border bg-surface text-fg',
    'placeholder:text-fg-subtle',
    'transition-[border-color,box-shadow] duration-fast',
    'focus:outline-none focus-visible:outline-none',
    'focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand)]/15',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle',
    'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_var(--color-danger)]/15',
    'read-only:bg-surface-sunken read-only:text-fg-muted',
  ],
  {
    variants: {
      size: {
        sm: 'h-control-sm px-2 text-sm',
        md: 'h-control-md px-3 text-base',
        lg: 'h-control-lg px-4 text-md',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof controlVariants> {
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, leading, trailing, ...props },
  ref,
) {
  const fieldProps = useFieldProps()

  const input = (
    <input
      ref={ref}
      className={cn(
        controlVariants({ size }),
        leading && 'pl-9',
        trailing && 'pr-9',
        (props.type === 'number' || props.inputMode === 'decimal') && 'tabular',
        className,
      )}
      {...fieldProps}
      {...props}
    />
  )

  if (!leading && !trailing) return input

  return (
    <div className="relative">
      {leading && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle [&_svg]:size-4"
          aria-hidden
        >
          {leading}
        </span>
      )}
      {input}
      {trailing && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle [&_svg]:size-4">
          {trailing}
        </span>
      )}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
  maxRows?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoResize = false, maxRows = 12, onInput, rows = 4, ...props },
  ref,
) {
  const fieldProps = useFieldProps()

  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        controlVariants({ size: 'md' }),
        'h-auto min-h-control-lg resize-y py-3 leading-relaxed',
        autoResize && 'resize-none overflow-hidden',
        className,
      )}
      onInput={(event) => {
        if (autoResize) {
          const element = event.currentTarget
          element.style.height = 'auto'
          const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 20
          element.style.height = `${Math.min(element.scrollHeight, lineHeight * maxRows)}px`
        }
        onInput?.(event)
      }}
      {...fieldProps}
      {...props}
    />
  )
})

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof controlVariants> {
  options?: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size, options, placeholder, children, ...props },
  ref,
) {
  const fieldProps = useFieldProps()

  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlVariants({ size }), 'appearance-none pr-9', className)}
        {...fieldProps}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
    </div>
  )
})

interface SearchInputProps extends Omit<InputProps, 'leading' | 'trailing' | 'onChange'> {
  value?: string
  onValueChange?: (value: string) => void
}

export function SearchInput({
  value: controlledValue,
  onValueChange,
  placeholder,
  className,
  ...props
}: SearchInputProps) {
  const [internal, setInternal] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internal

  const update = (next: string) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  return (
    <Input
      type="search"
      role="searchbox"
      value={value}
      placeholder={placeholder ?? `${t('actions.search')}…`}
      leading={<Search />}
      className={cn('[&::-webkit-search-cancel-button]:hidden', className)}
      onChange={(event) => update(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') update('')
      }}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => update('')}
            className="pointer-events-auto rounded-xs p-0.5 text-fg-subtle transition-colors hover:text-fg"
            aria-label={t('actions.clearFilters')}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null
      }
      {...props}
    />
  )
}
