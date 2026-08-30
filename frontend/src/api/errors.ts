import axios from 'axios'
import { ZodError } from 'zod'

import { t } from '@/i18n'

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'canceled'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'rateLimit'
  | 'server'
  | 'parse'
  | 'unknown'

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly kind: ErrorKind
  readonly status: number | null
  readonly code: string | null
  readonly fieldErrors: FieldErrors
  readonly traceId: string | null
  readonly cause: unknown

  constructor(init: {
    kind: ErrorKind
    message?: string
    status?: number | null
    code?: string | null
    fieldErrors?: FieldErrors
    traceId?: string | null
    cause?: unknown
  }) {
    super(init.message ?? defaultMessage(init.kind))
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.traceId = init.traceId ?? null
    this.cause = init.cause
  }

  get isRetryable(): boolean {
    return ['network', 'timeout', 'server', 'rateLimit'].includes(this.kind)
  }

  get isExpected(): boolean {
    return ['validation', 'unauthorized', 'forbidden', 'notFound', 'conflict'].includes(this.kind)
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0
  }

  get title(): string {
    return t(`errors:titles.${this.kind}`)
  }
}

function defaultMessage(kind: ErrorKind): string {
  return t(`errors:kinds.${kind}`)
}

function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 409) return 'conflict'
  if (status === 422 || status === 400) return 'validation'
  if (status === 429) return 'rateLimit'
  if (status >= 500) return 'server'
  return 'unknown'
}

function extractFieldErrors(payload: unknown): FieldErrors {
  if (!payload || typeof payload !== 'object') return {}
  const body = payload as Record<string, unknown>
  const source = body.errors ?? body.fieldErrors ?? body.detail ?? body.violations

  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const result: FieldErrors = {}
    for (const [field, messages] of Object.entries(source as Record<string, unknown>)) {
      if (Array.isArray(messages)) result[field] = messages.map(String)
      else if (typeof messages === 'string') result[field] = [messages]
    }
    return result
  }

  if (Array.isArray(source)) {
    const result: FieldErrors = {}
    for (const item of source) {
      if (!item || typeof item !== 'object') continue
      const entry = item as Record<string, unknown>
      const loc = Array.isArray(entry.loc) ? entry.loc : null
      const field = String(entry.field ?? entry.param ?? loc?.[loc.length - 1] ?? '_')
      const message = String(entry.message ?? entry.msg ?? entry.detail ?? 'Invalid value')
      result[field] = [...(result[field] ?? []), message]
    }
    return result
  }

  return {}
}

function extractMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) return payload.trim()
  if (!payload || typeof payload !== 'object') return null

  const body = payload as Record<string, unknown>
  for (const key of ['message', 'error_description', 'error', 'detail', 'title']) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof ZodError) {
    return new ApiError({ kind: 'parse', cause: error })
  }

  if (axios.isCancel(error)) {
    return new ApiError({ kind: 'canceled', cause: error })
  }

  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', cause: error })
    }

    if (!error.response) {
      return new ApiError({ kind: 'network', cause: error })
    }

    const { status, data, headers } = error.response
    const kind = kindFromStatus(status)
    const fieldErrors = extractFieldErrors(data)
    const backendMessage = extractMessage(data)

    const message = kind === 'server' || !backendMessage ? defaultMessage(kind) : backendMessage

    const body = (data ?? {}) as Record<string, unknown>

    return new ApiError({
      kind,
      message,
      status,
      code: typeof body.code === 'string' ? body.code : null,
      fieldErrors,
      traceId:
        (headers?.['x-request-id'] as string | undefined) ??
        (headers?.['x-trace-id'] as string | undefined) ??
        (typeof body.traceId === 'string' ? body.traceId : null),
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ kind: 'unknown', message: error.message, cause: error })
  }

  return new ApiError({ kind: 'unknown', cause: error })
}

export function toUserMessage(error: unknown): string {
  const apiError = normalizeError(error)
  return apiError.traceId
    ? `${apiError.message} (${t('errors:reference', { traceId: apiError.traceId })})`
    : apiError.message
}
