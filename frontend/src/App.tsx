import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { useShallow } from 'zustand/react/shallow'
import { Toaster } from 'sonner'

import { queryClient } from '@/api/queryClient'
import { useAuthStore } from '@/auth/auth.store'
import { env } from '@/config/env'
import { router } from '@/router/router'
import { useThemeStore } from '@/stores/themeStore'

export function App() {
  const resolvedTheme = useThemeStore((state) => state.resolved)

  const auth = useAuthStore(
    useShallow((state) => ({
      status: state.status,
      user: state.user,
      role: state.role,
      can: state.can,
      canAny: state.canAny,
      isAtLeast: state.isAtLeast,
    })),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth, queryClient }} />

      <Toaster
        position="bottom-right"
        theme={resolvedTheme}
        closeButton
        richColors={false}
        toastOptions={{
          classNames: {
            toast: 'group border border-line bg-surface-raised text-fg shadow-lg rounded-md text-sm',
            title: 'text-fg font-medium',
            description: 'text-fg-muted text-xs',
            actionButton: 'bg-brand text-brand-fg rounded-sm text-xs px-2 h-6',
            closeButton: 'bg-surface border-line text-fg-muted',
            error: 'border-danger/30',
            success: 'border-success/30',
            warning: 'border-warning/30',
            info: 'border-info/30',
          },
        }}
      />

      {env.VITE_DEVTOOLS && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
