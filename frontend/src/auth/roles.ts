export const ROLES = ['user', 'admin', 'superadmin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LEVEL: Record<Role, number> = { user: 10, admin: 20, superadmin: 30 }

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

export function hasAtLeast(role: Role | null | undefined, minimum: Role): boolean {
  if (!role) return false
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum]
}

export const ROLE_TONE: Record<Role, 'brand' | 'accent' | 'success' | 'warning' | 'neutral'> = {
  superadmin: 'brand',
  admin: 'accent',
  user: 'neutral',
}
