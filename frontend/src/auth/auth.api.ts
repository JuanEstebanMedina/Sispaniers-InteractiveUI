import { api$, http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import {
  loginResponseSchema,
  tokenPairSchema,
  userSchema,
  type LoginInput,
  type User,
} from '@/schemas'

function expiryFrom(expiresIn: number | null | undefined): number | null {
  return expiresIn ? Date.now() + expiresIn * 1000 : null
}

export const authApi = {
  async login(input: LoginInput) {
    const parsed = await api$.post(endpoints.auth.login, loginResponseSchema, input, {
      skipAuth: true,
    })

    return { ...parsed, expiresAt: expiryFrom(parsed.expiresIn) }
  },

  me(): Promise<User> {
    return api$.get(endpoints.auth.me, userSchema)
  },

  async refresh(refreshToken: string) {
    const parsed = await api$.post(
      endpoints.auth.refresh,
      tokenPairSchema,
      { refreshToken },
      { skipAuth: true, skipRetry: true },
    )

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: expiryFrom(parsed.expiresIn),
    }
  },

  async logout(): Promise<void> {
    try {
      await http.post(endpoints.auth.logout, undefined, { skipRetry: true })
    } catch {
    }
  },
}
