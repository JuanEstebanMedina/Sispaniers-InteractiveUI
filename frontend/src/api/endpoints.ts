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

  companies: {
    list: '/companies',
    create: '/companies',
    update: (id: string) => `/companies/${id}`,
  },

  users: {
    list: '/users',
    create: '/users',
    update: (id: string) => `/users/${id}`,
  },

  operations: {
    search: '/operations/search',
    detail: (id: string) => `/operations/${id}`,
    components: (id: string) => `/operations/${id}/components`,
    companyConcepts: (id: string, conceptIds: string[]) =>
      `/operations/${id}/company-concepts?ids=${encodeURIComponent(conceptIds.join(','))}`,
    componentPlacement: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}/placement`,
    componentContent: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}`,
    componentRemove: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}`,
    documentPreview: (id: string, documentId: string) =>
      `/operations/${id}/documents/${documentId}/preview-url`,
  },

  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },

  ai: {
    chat: (operationId: string) => `/operations/${operationId}/chat`,
    events: (operationId: string) => `/operations/${operationId}/events`,
    operationEvents: '/operations/events',
    components: (operationId: string, cols: 2 | 4 | 8) =>
      `/operations/${operationId}/components?cols=${cols}`,
  },

  health: '/health',
} as const

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  companies: {
    all: ['companies'] as const,
    list: () => ['companies', 'list'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  operations: {
    all: ['operations'] as const,
    list: (body?: unknown) => ['operations', 'list', body ?? {}] as const,
    detail: (id: string) => ['operations', 'detail', id] as const,
    componentsAll: (id: string) => ['operations', 'components', id] as const,
    components: (id: string, cols: number) => ['operations', 'components', id, cols] as const,
    companyConcepts: (id: string, conceptIds: string[]) =>
      ['operations', 'company-concepts', id, conceptIds] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
} as const
