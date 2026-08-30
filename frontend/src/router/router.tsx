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
import type { Role } from '@/auth/roles'
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

function requireRole(context: RouterContext, minimum: Role) {
  if (!context.auth.isAtLeast(minimum)) {
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
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const companiesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/companies',
  beforeLoad: ({ context }) => requireRole(context, 'superadmin'),
  component: lazyRouteComponent(() => import('@/pages/CompaniesPage')),
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  beforeLoad: ({ context }) => requireRole(context, 'admin'),
  component: lazyRouteComponent(() => import('@/pages/PlaceholderPage')),
})

const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/users',
  beforeLoad: ({ context }) => requireRole(context, 'admin'),
  component: lazyRouteComponent(() => import('@/pages/UsersPage')),
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
    companiesRoute,
    settingsRoute,
    usersRoute,
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
