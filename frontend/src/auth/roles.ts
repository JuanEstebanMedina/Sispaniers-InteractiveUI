export const ROLES = ['admin', 'manager', 'operator', 'analyst', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'operations:read',
  'operations:create',
  'operations:update',
  'operations:decide',

  'companies:read',
  'companies:create',
  'companies:update',

  'settings:read',
  'settings:update',

  'ai:use',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_LEVEL: Record<Role, number> = {
  viewer: 10,
  analyst: 20,
  operator: 30,
  manager: 40,
  admin: 50,
}

const VIEWER: Permission[] = ['operations:read']

const ANALYST: Permission[] = [...VIEWER, 'ai:use']

const OPERATOR: Permission[] = [...ANALYST, 'operations:create', 'operations:update']

const MANAGER: Permission[] = [
  ...OPERATOR,
  'operations:decide',
  'companies:read',
  'companies:create',
  'companies:update',
  'settings:read',
]

const ADMIN: Permission[] = [...PERMISSIONS]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: VIEWER,
  analyst: ANALYST,
  operator: OPERATOR,
  manager: MANAGER,
  admin: ADMIN,
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function permissionsFor(role: Role | null | undefined, extra: readonly Permission[] = []) {
  if (!role) return new Set<Permission>()
  return new Set<Permission>([...ROLE_PERMISSIONS[role], ...extra])
}

export function hasPermission(
  granted: ReadonlySet<Permission>,
  required: Permission | readonly Permission[],
): boolean {
  const list = Array.isArray(required) ? required : [required as Permission]
  return list.every((permission) => granted.has(permission))
}

export function hasAnyPermission(
  granted: ReadonlySet<Permission>,
  required: readonly Permission[],
): boolean {
  return required.some((permission) => granted.has(permission))
}

export function hasAtLeast(role: Role | null | undefined, minimum: Role): boolean {
  if (!role) return false
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum]
}

export const ROLE_TONE: Record<Role, 'brand' | 'accent' | 'success' | 'warning' | 'neutral'> = {
  admin: 'brand',
  manager: 'accent',
  operator: 'success',
  analyst: 'warning',
  viewer: 'neutral',
}
