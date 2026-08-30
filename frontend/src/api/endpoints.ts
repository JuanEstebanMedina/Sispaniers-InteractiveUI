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
    /** Idempotent by name: 200 if it already exists, 201 if it was created. */
    create: '/companies',
    /** Also how a company is disabled/re-enabled — `{ active: false/true }`. There's no remove. */
    update: (id: string) => `/companies/${id}`,
  },

  users: {
    list: '/users',
    create: '/users',
    update: (id: string) => `/users/${id}`,
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
    /**
     * Mover y renombrar un widget, de a uno. NO hay un PATCH del layout entero:
     * la posición es un índice en la secuencia, y las coordenadas salen de ahí.
     */
    componentPlacement: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}/placement`,
    componentContent: (id: string, componentId: string) =>
      `/operations/${id}/components/${componentId}`,
    /**
     * URL firmada y de vida corta (5 min) para ver un adjunto. No se pide al
     * listar los archivos: se pide al abrir uno, porque caduca.
     */
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
    /**
     * La clave ES el cuerpo de la petición. Con eso, dos pantallas que piden
     * exactamente lo mismo comparten una sola consulta: el punto del menú pide
     * `{}` y la grilla sin filtros también manda `{}`, así que React Query las
     * funde en UNA petición en vez de dos idénticas.
     */
    list: (body?: unknown) => ['operations', 'list', body ?? {}] as const,
    detail: (id: string) => ['operations', 'detail', id] as const,
    components: (id: string, cols: number) => ['operations', 'components', id, cols] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
  },
} as const
