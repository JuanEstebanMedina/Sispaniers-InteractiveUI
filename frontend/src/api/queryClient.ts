import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { toast } from '@/lib/toast'
import { ApiError, normalizeError } from './errors'

function shouldNotify(error: ApiError): boolean {
  if (error.kind === 'unauthorized') return false
  if (error.kind === 'canceled') return false
  if (error.kind === 'validation' && error.hasFieldErrors) return false
  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,

      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,

      retry: (failureCount, error) => {
        const apiError = normalizeError(error)
        if (apiError.kind === 'network') return failureCount < 1
        return false
      },

      placeholderData: (previous: unknown) => previous,
    },
    mutations: {
      retry: false,
    },
  },

  queryCache: new QueryCache({
    onError: (error, query) => {
      const apiError = normalizeError(error)

      if (query.state.data !== undefined && apiError.kind === 'network') return

      if (shouldNotify(apiError)) toast.apiError(apiError)
    },
  }),

  mutationCache: new MutationCache({
    onError: (error) => {
      const apiError = normalizeError(error)
      if (shouldNotify(apiError)) toast.apiError(apiError)
    },
  }),
})
