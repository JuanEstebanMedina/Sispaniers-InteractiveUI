import { AlertCircle } from 'lucide-react'
import { createContext, useContext, useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface FieldContextValue {
  id: string
  descriptionId: string
  errorId: string
  hasError: boolean
  required: boolean
  disabled: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

export function useFieldContext() {
  return useContext(FieldContext)
}

export function useFieldProps() {
  const field = useFieldContext()
  if (!field) return {}

  return {
    id: field.id,
    'aria-invalid': field.hasError || undefined,
    'aria-required': field.required || undefined,
    'aria-describedby':
      [field.hasError ? field.errorId : null, field.descriptionId].filter(Boolean).join(' ') ||
      undefined,
    disabled: field.disabled || undefined,
  } as const
}

interface FieldProps {
  label?: ReactNode
  description?: ReactNode
  error?: string | string[] | null
  required?: boolean
  disabled?: boolean
  children: ReactNode
  className?: string
  hint?: ReactNode
}

export function Field({
  label,
  description,
  error,
  required = false,
  disabled = false,
  children,
  className,
  hint,
}: FieldProps) {
  const baseId = useId()
  const message = Array.isArray(error) ? error[0] : error
  const hasError = Boolean(message)

  const context: FieldContextValue = {
    id: `${baseId}-control`,
    descriptionId: `${baseId}-description`,
    errorId: `${baseId}-error`,
    hasError,
    required,
    disabled,
  }

  return (
    <FieldContext.Provider value={context}>
      <div className={cn('space-y-1', className)}>
        {label && (
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor={context.id}
              className={cn(
                'text-sm font-medium text-fg',
                disabled && 'text-fg-subtle',
              )}
            >
              {label}
              {required && (
                <span className="ml-0.5 text-danger" aria-hidden>
                  *
                </span>
              )}
            </label>
            {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
          </div>
        )}

        {children}

        {hasError ? (
          <p
            id={context.errorId}
            role="alert"
            className="flex items-start gap-1 text-xs text-danger"
          >
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            {message}
          </p>
        ) : (
          description && (
            <p id={context.descriptionId} className="text-xs text-fg-muted">
              {description}
            </p>
          )
        )}
      </div>
    </FieldContext.Provider>
  )
}
