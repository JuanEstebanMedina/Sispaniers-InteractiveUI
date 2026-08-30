import type { ReactNode } from 'react'

import { Field } from './Field'
import { Input, type InputProps } from './Input'

/**
 * The shape every form in the app repeats: a labelled field wrapping an input
 * bound to a TanStack Form field.
 *
 * It takes the `field` from the render prop rather than the form itself. Typing
 * a generic over the whole form means fighting TanStack's inference at every
 * call site; taking the field keeps this component plain and still collapses
 * twelve lines to one.
 */
interface FieldInputProps extends Omit<InputProps, 'value' | 'onChange' | 'onBlur'> {
  field: {
    state: { value: string; meta: { errors: unknown[] } }
    handleChange: (value: string) => void
    handleBlur: () => void
  }
  label?: ReactNode
  description?: ReactNode
  hint?: ReactNode
  required?: boolean
}

export function FieldInput({
  field,
  label,
  description,
  hint,
  required,
  ...input
}: FieldInputProps) {
  return (
    <Field
      label={label}
      description={description}
      hint={hint}
      required={required}
      error={firstError(field.state.meta.errors)}
    >
      <Input
        {...input}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    </Field>
  )
}

/**
 * Validation errors arrive as strings from the server and as objects from zod,
 * so the message has to be dug out either way. Anything else is stringified
 * rather than dropped: a message nobody can read still beats a field that
 * refuses to submit for no visible reason.
 */
export function firstError(errors: unknown[]): string | undefined {
  const error = errors[0]
  if (!error) return undefined
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}
