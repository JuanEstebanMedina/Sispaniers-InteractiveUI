import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import { useAuthStore } from './auth.store'
import type { Permission, Role } from './roles'

export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      status: state.status,
      user: state.user,
      role: state.role,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      login: state.login,
      logout: state.logout,
    })),
  )
}

export function useUser() {
  return useAuthStore((state) => state.user)
}

export function useRole() {
  return useAuthStore((state) => state.role)
}

export function useAuthStatus() {
  return useAuthStore((state) => state.status)
}

export function useCan(permission: Permission | readonly Permission[]): boolean {
  return useAuthStore((state) => state.can(permission))
}

export function useCanAny(permissions: readonly Permission[]): boolean {
  return useAuthStore((state) => state.canAny(permissions))
}

export function useIsAtLeast(role: Role): boolean {
  return useAuthStore((state) => state.isAtLeast(role))
}

export function useRoleLabels() {
  const { t } = useTranslation('auth')

  return {
    label: (role: Role) => t(`roles.${role}`),
    description: (role: Role) => t(`roleDescriptions.${role}`),
  }
}
