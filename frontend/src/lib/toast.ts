import { toast as sonner } from 'sonner'

import { ApiError, normalizeError } from '@/api/errors'
import { t } from '@/i18n'

const recent = new Map<string, number>()
const DEDUPE_WINDOW_MS = 3_000

function isDuplicate(key: string): boolean {
  const now = Date.now()

  for (const [entry, timestamp] of recent) {
    if (now - timestamp > DEDUPE_WINDOW_MS) recent.delete(entry)
  }

  if (recent.has(key)) return true
  recent.set(key, now)
  return false
}

interface ToastOptions {
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
  force?: boolean
}

function show(
  kind: 'success' | 'error' | 'warning' | 'info',
  message: string,
  options: ToastOptions = {},
) {
  if (!options.force && isDuplicate(`${kind}:${message}`)) return

  const { description, duration, action } = options

  return sonner[kind](message, {
    description,
    duration: duration ?? (kind === 'error' ? 6_000 : 3_500),
    action,
  })
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),

  apiError: (error: unknown, options?: ToastOptions & { onRetry?: () => void }) => {
    const apiError: ApiError = normalizeError(error)
    if (apiError.kind === 'canceled') return

    const action =
      options?.onRetry && apiError.isRetryable
        ? { label: t('actions.retry'), onClick: options.onRetry }
        : options?.action

    const description = apiError.traceId
      ? t('errors:reference', { traceId: apiError.traceId })
      : options?.description

    const kind = apiError.kind === 'validation' || apiError.kind === 'conflict' ? 'warning' : 'error'

    return show(kind, apiError.message, { ...options, description, action })
  },

  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error?: string },
  ) =>
    sonner.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (error: unknown) => messages.error ?? normalizeError(error).message,
    }),

  dismiss: (id?: string | number) => sonner.dismiss(id),
}
