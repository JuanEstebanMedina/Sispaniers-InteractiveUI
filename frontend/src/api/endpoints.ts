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
    list: '/operations',
    detail: (id: string) => `/operations/${id}`,
    layout: (id: string) => `/operations/${id}/layout`,
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
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
} as const
