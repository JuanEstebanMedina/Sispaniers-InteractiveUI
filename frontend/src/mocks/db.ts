import type { Role } from '@/auth/roles'

export interface MockUser {
  id: string
  email: string
  password: string
  name: string
  role: Role
  avatarUrl: string | null
  organizationId: string
  organizationName: string
  createdAt: string
  lastLoginAt: string | null
}

export const users: MockUser[] = [
  {
    id: 'usr_admin',
    email: 'admin@yuno.com',
    password: 'demo1234',
    name: 'Valentina Torres',
    role: 'admin',
    avatarUrl: null,
    organizationId: 'org_1',
    organizationName: 'Yuno × Nauta',
    createdAt: '2026-01-15T10:00:00Z',
    lastLoginAt: '2026-08-28T08:30:00Z',
  },
  {
    id: 'usr_manager',
    email: 'supervisor@yuno.com',
    password: 'demo1234',
    name: 'Andrés Felipe Restrepo Villa',
    role: 'manager',
    avatarUrl: null,
    organizationId: 'org_1',
    organizationName: 'Yuno × Nauta',
    createdAt: '2026-02-20T10:00:00Z',
    lastLoginAt: '2026-08-27T16:12:00Z',
  },
  {
    id: 'usr_operator',
    email: 'operator@nauta.com',
    password: 'demo1234',
    name: 'Camila Ríos',
    role: 'operator',
    avatarUrl: null,
    organizationId: 'org_1',
    organizationName: 'Yuno × Nauta',
    createdAt: '2026-03-05T10:00:00Z',
    lastLoginAt: '2026-08-28T07:45:00Z',
  },
  {
    id: 'usr_analyst',
    email: 'analyst@nauta.com',
    password: 'demo1234',
    name: 'Diego Marín',
    role: 'analyst',
    avatarUrl: null,
    organizationId: 'org_1',
    organizationName: 'Yuno × Nauta',
    createdAt: '2026-04-01T10:00:00Z',
    lastLoginAt: null,
  },
  {
    id: 'usr_viewer',
    email: 'guest@yuno.com',
    password: 'demo1234',
    name: 'Sofía Pérez',
    role: 'viewer',
    avatarUrl: null,
    organizationId: 'org_1',
    organizationName: 'Yuno × Nauta',
    createdAt: '2026-05-10T10:00:00Z',
    lastLoginAt: '2026-08-26T11:00:00Z',
  },
]

/* ---------------------------------------------------------------------------
 * Las operaciones simuladas se borraron: el dominio lo sirve el backend real
 * en `/api/flows`. Acá sólo quedan los usuarios, porque el backend todavía no
 * tiene autenticación. Cuando la tenga, este archivo desaparece entero.
 * ------------------------------------------------------------------------ */
