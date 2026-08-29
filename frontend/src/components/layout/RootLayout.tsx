import { Outlet } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

import { ErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { env, isDev } from '@/config/env'

const RouterDevtools = isDev
  ? lazy(() =>
      import('@tanstack/router-devtools').then((module) => ({
        default: module.TanStackRouterDevtools,
      })),
    )
  : () => null

export function RootLayout() {
  return (
    <ErrorBoundary>
      <Outlet />

      {env.VITE_DEVTOOLS && isDev && (
        <Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}
