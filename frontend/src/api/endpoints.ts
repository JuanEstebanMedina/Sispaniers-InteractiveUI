export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    register: '/auth/register',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },

  users: {
    list: '/users',
    detail: (id: string) => `/users/${id}`,
    create: '/users',
    update: (id: string) => `/users/${id}`,
    remove: (id: string) => `/users/${id}`,
    updateRole: (id: string) => `/users/${id}/role`,
  },

  operations: {
    /**
     * El ÚNICO listado. Es POST porque texto libre + estado + salud + rango de
     * fechas + orden no caben en una query string legible. Un body vacío lista
     * todo, que es lo que hacía el `GET /operations` que se eliminó.
     */
    search: '/operations/search',
    detail: (id: string) => `/operations/${id}`,
    components: (id: string) => `/operations/${id}/components`,
    layout: (id: string) => `/operations/${id}/layout`,
    componentContent: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}`,
  },

  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },

  ai: {
    ask: '/ai/ask',
    stream: '/ai/stream',
    suggestions: '/ai/suggestions',
  },

  health: '/health',
} as const

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters?: unknown) => ['users', 'list', filters ?? {}] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  operations: {
    all: ['operations'] as const,
    list: (filters?: unknown) => ['operations', 'list', filters ?? {}] as const,
    detail: (id: string) => ['operations', 'detail', id] as const,
    components: (id: string, cols: number) => ['operations', 'components', id, cols] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
} as const
