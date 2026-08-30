import { create } from 'zustand'

import { configureAuth } from '@/api/client'
import { normalizeError } from '@/api/errors'
import { queryClient } from '@/api/queryClient'
import { t } from '@/i18n'
import { toast } from '@/lib/toast'
import type { AuthStatus, LoginInput, User } from '@/schemas'
import { authApi } from './auth.api'
import { hasAtLeast, type Role } from './roles'
import { tokenStore } from './tokenStore'

interface AuthStore {
  status: AuthStatus
  user: User | null
  role: Role | null

  bootstrap: () => Promise<void>
  login: (input: LoginInput) => Promise<User>
  logout: () => Promise<void>
  forceLogout: (reason?: string) => void

  isAtLeast: (role: Role) => boolean
}

function identityOf(user: User | null) {
  return {
    user,
    role: user?.role ?? null,
  }
}

const EMPTY_IDENTITY = identityOf(null)

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'loading',
  ...EMPTY_IDENTITY,

  async bootstrap() {
    if (!tokenStore.getAccessToken()) {
      set({ status: 'unauthenticated', ...EMPTY_IDENTITY })
      return
    }

    try {
      const user = await authApi.me()
      set({ status: 'authenticated', ...identityOf(user) })
    } catch (error) {
      const apiError = normalizeError(error)
      if (!apiError.isExpected) console.error('[auth] bootstrap failed', apiError)

      tokenStore.clear()
      set({ status: 'unauthenticated', ...EMPTY_IDENTITY })
    }
  },

  async login(input) {
    const result = await authApi.login(input)

    tokenStore.set({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    })

    set({ status: 'authenticated', ...identityOf(result.user) })
    return result.user
  },

  async logout() {
    await authApi.logout()
    tokenStore.clear()
    set({ status: 'unauthenticated', ...EMPTY_IDENTITY })

    queryClient.clear()
  },

  forceLogout(reason) {
    tokenStore.clear()
    set({ status: 'unauthenticated', ...EMPTY_IDENTITY })
    queryClient.clear()
    toast.warning(reason ?? t('auth:session.expired'))
  },

  isAtLeast: (role) => hasAtLeast(get().role, role),
}))

configureAuth({
  refresh: authApi.refresh,
  onExpired: () => useAuthStore.getState().forceLogout(),
})

tokenStore.subscribe((tokens) => {
  const { status } = useAuthStore.getState()
  if (!tokens && status === 'authenticated') {
    useAuthStore.setState({ status: 'unauthenticated', ...EMPTY_IDENTITY })
    queryClient.clear()
  }
})

export function authSnapshot() {
  const state = useAuthStore.getState()
  return {
    status: state.status,
    user: state.user,
    role: state.role,
    isAtLeast: state.isAtLeast,
  }
}

export type AuthSnapshot = ReturnType<typeof authSnapshot>
