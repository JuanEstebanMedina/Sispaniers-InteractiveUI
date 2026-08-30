import { env } from '@/config/env'

export interface Tokens {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
}

const STORAGE_KEY = 'yn.auth.tokens'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  }
}

function resolveStorage(): Storage {
  if (env.VITE_AUTH_STORAGE === 'memory') return createMemoryStorage()

  try {
    const storage = env.VITE_AUTH_STORAGE === 'sessionStorage' ? sessionStorage : localStorage
    const probe = '__yn_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    console.warn('[auth] Storage unavailable, falling back to memory. The session will not survive a refresh.')
    return createMemoryStorage()
  }
}

const storage = resolveStorage()

type Listener = (tokens: Tokens | null) => void
const listeners = new Set<Listener>()

export const tokenStore = {
  get(): Tokens | null {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Tokens
      return typeof parsed?.accessToken === 'string' ? parsed : null
    } catch {
      storage.removeItem(STORAGE_KEY)
      return null
    }
  },

  set(tokens: Tokens): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(tokens))
    listeners.forEach((listener) => listener(tokens))
  },

  clear(): void {
    storage.removeItem(STORAGE_KEY)
    listeners.forEach((listener) => listener(null))
  },

  getAccessToken(): string | null {
    return this.get()?.accessToken ?? null
  },

  isExpiring(marginMs = 60_000): boolean {
    const expiresAt = this.get()?.expiresAt
    if (!expiresAt) return false
    return Date.now() >= expiresAt - marginMs
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
}

if (typeof window !== 'undefined' && env.VITE_AUTH_STORAGE === 'localStorage') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    const tokens = event.newValue ? (JSON.parse(event.newValue) as Tokens) : null
    listeners.forEach((listener) => listener(tokens))
  })
}
