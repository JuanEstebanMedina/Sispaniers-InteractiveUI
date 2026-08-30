import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { z } from 'zod'

import { tokenStore } from '@/auth/tokenStore'
import { env, isDev } from '@/config/env'
import { currentLocale } from '@/i18n'
import { parseResponse } from '@/schemas/common.schema'
import { ApiError, normalizeError } from './errors'

interface RequestConfig extends InternalAxiosRequestConfig {
  _retryCount?: number
  _refreshed?: boolean
  skipRetry?: boolean
  skipAuth?: boolean
}

export interface ApiRequestConfig extends AxiosRequestConfig {
  skipRetry?: boolean
  skipAuth?: boolean
}

const MAX_RETRIES = 2
// POST and PATCH are excluded on purpose: retrying a non-idempotent write can
// duplicate it. Relax only once the backend accepts an Idempotency-Key.
const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put', 'delete'])

export const api: AxiosInstance = axios.create({
  baseURL: env.VITE_API_URL,
  timeout: env.VITE_API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const request = config as RequestConfig

  if (!request.skipAuth) {
    const token = tokenStore.getAccessToken()
    if (token) request.headers.Authorization = `Bearer ${token}`
  }

  request.headers['X-Request-Id'] =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  request.headers['Accept-Language'] = currentLocale()

  return request
})

type RefreshHandler = (refreshToken: string) => Promise<{
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
}>

let refreshHandler: RefreshHandler | null = null
let onSessionExpired: (() => void) | null = null

export function configureAuth(options: { refresh?: RefreshHandler; onExpired?: () => void }): void {
  if (options.refresh) refreshHandler = options.refresh
  if (options.onExpired) onSessionExpired = options.onExpired
}

let refreshInFlight: Promise<string> | null = null

function refreshSession(): Promise<string> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const tokens = tokenStore.get()

    if (!tokens?.refreshToken || !refreshHandler) {
      throw new ApiError({ kind: 'unauthorized' })
    }

    const next = await refreshHandler(tokens.refreshToken)
    tokenStore.set({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken ?? tokens.refreshToken,
      expiresAt: next.expiresAt ?? null,
    })
    return next.accessToken
  })()

  // Released on failure too: otherwise one failed refresh blocks every future
  // attempt for the rest of the session.
  void refreshInFlight.finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function backoffDelay(attempt: number): number {
  const base = 300 * 2 ** attempt
  const jitter = base * 0.3 * (Math.random() * 2 - 1)
  return Math.round(base + jitter)
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RequestConfig | undefined
    const apiError = normalizeError(error)

    if (!config) throw apiError

    if (apiError.kind === 'unauthorized' && !config._refreshed && !config.skipAuth) {
      config._refreshed = true
      try {
        const token = await refreshSession()
        config.headers.Authorization = `Bearer ${token}`
        return await api.request(config)
      } catch {
        tokenStore.clear()
        onSessionExpired?.()
        throw apiError
      }
    }

    const method = (config.method ?? 'get').toLowerCase()
    const attempt = config._retryCount ?? 0

    const canRetry =
      !config.skipRetry &&
      apiError.isRetryable &&
      attempt < MAX_RETRIES &&
      RETRYABLE_METHODS.has(method)

    if (canRetry) {
      config._retryCount = attempt + 1

      const retryAfter = Number(error.response?.headers?.['retry-after'])
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : backoffDelay(attempt)

      if (isDev) {
        console.warn(
          `[api] retry ${config._retryCount}/${MAX_RETRIES} of ${method.toUpperCase()} ${config.url} in ${delay}ms (${apiError.kind})`,
        )
      }

      await sleep(delay)
      return await api.request(config)
    }

    throw apiError
  },
)

export async function request<T>(config: ApiRequestConfig): Promise<T> {
  const response = await api.request<T>(config)
  return response.data
}

export const http = {
  get: <T>(url: string, config?: ApiRequestConfig) => request<T>({ ...config, method: 'GET', url }),

  post: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),

  put: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),

  patch: <T>(url: string, data?: unknown, config?: ApiRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T>(url: string, config?: ApiRequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),
}

export const api$ = {
  get: async <S extends z.ZodTypeAny>(url: string, schema: S, config?: ApiRequestConfig) =>
    parseResponse(schema, await http.get<unknown>(url, config), `GET ${url}`),

  post: async <S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    data?: unknown,
    config?: ApiRequestConfig,
  ) => parseResponse(schema, await http.post<unknown>(url, data, config), `POST ${url}`),

  put: async <S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    data?: unknown,
    config?: ApiRequestConfig,
  ) => parseResponse(schema, await http.put<unknown>(url, data, config), `PUT ${url}`),

  patch: async <S extends z.ZodTypeAny>(
    url: string,
    schema: S,
    data?: unknown,
    config?: ApiRequestConfig,
  ) => parseResponse(schema, await http.patch<unknown>(url, data, config), `PATCH ${url}`),
}

export async function upload<T>(
  url: string,
  file: File | Blob,
  options: {
    field?: string
    extra?: Record<string, string>
    onProgress?: (percent: number) => void
  } = {},
): Promise<T> {
  const form = new FormData()
  form.append(options.field ?? 'file', file)
  for (const [key, value] of Object.entries(options.extra ?? {})) form.append(key, value)

  return request<T>({
    method: 'POST',
    url,
    data: form,
    // Unset so the browser writes it with the multipart boundary.
    headers: { 'Content-Type': undefined },
    timeout: 0,
    onUploadProgress: (event) => {
      if (!event.total || !options.onProgress) return
      options.onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
}

export function toQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}
