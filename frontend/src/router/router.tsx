import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'

import { queryClient } from '@/api/queryClient'
import { authSnapshot, type AuthSnapshot } from '@/auth/auth.store'
import type { Permission } from '@/auth/roles'
import { AppShell } from '@/components/layout/AppShell'
import { FullPageLoader } from '@/components/feedback/FullPageLoader'
import { RootLayout } from '@/components/layout/RootLayout'
import { isDev } from '@/config/env'
import { loginSearchSchema, operationsSearchSchema } from '@/schemas'
import { ForbiddenPage, NotFoundPage, RouteErrorPage } from '@/pages/ErrorPages'

export interface RouterContext {
  auth: AuthSnapshot
  queryClient: QueryClient
}

function requireAuth(context: RouterContext, href: string) {
  if (context.auth.status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: href } })
  }
}

function requirePermission(context: RouterContext, permission: Permission) {
  if (!context.auth.can(permission)) {
    throw redirect({ to: '/403' })
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.status === 'authenticated') {
      throw redirect({ to: search.redirect ?? '/' })
    }
  },
  component: lazyRouteComponent(() => import('@/pages/LoginPage')),
})

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/403',
  component: ForbiddenPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ context, location }) => requireAuth(context, location.href),
  component: AppShell,
})

const operationsLayoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/operations',
  beforeLoad: ({ context }) => requirePermission(context, 'operations:read'),
  component: lazyRouteComponent(() => import('@/components/layout/OperationsLayout')),
})

const operationsIndexRoute = createRoute({
  getParentRoute: () => operationsLayoutRoute,
  path: '/',
  validateSearch: operationsSearchSchema,
  component: lazyRouteComponent(() => import('@/pages/OperationsPage')),
})

const operationDetailRoute = createRoute({
  getParentRoute: () => operationsLayoutRoute,
  path: '$trackId',
  component: lazyRouteComponent(() => import('@/pages/OperationDetailPage')),
})

const indexRedirectRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/operations' })
  },
})

const assistantRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/assistant',
  beforeLoad: ({ context }) => requirePermission(context, 'ai:use'),
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/users',
  beforeLoad: ({ context }) => requirePermission(context, 'users:read'),
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  beforeLoad: ({ context }) => requirePermission(context, 'settings:read'),
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const componentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/components',
  component: lazyRouteComponent(() => import('@/pages/ComponentsPage')),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  forbiddenRoute,
  appRoute.addChildren([
    indexRedirectRoute,
    operationsLayoutRoute.addChildren([operationsIndexRoute, operationDetailRoute]),
    assistantRoute,
    usersRoute,
    settingsRoute,
    profileRoute,
    ...(isDev ? [componentsRoute] : []),
  ]),
])

export const router = createRouter({
  routeTree,

  context: {
    auth: authSnapshot(),
    queryClient,
  },

  defaultPendingComponent: () => <FullPageLoader />,
  defaultErrorComponent: RouteErrorPage,
  defaultNotFoundComponent: NotFoundPage,

  defaultPendingMs: 200,
  defaultPendingMinMs: 300,

  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
