import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { env } from '@/config/env'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'

type PersistedTheme = { mode: ThemeMode; density: Density }

interface ThemeStore {
  mode: ThemeMode
  density: Density
  resolved: ResolvedTheme

  setMode: (mode: ThemeMode) => void
  setDensity: (density: Density) => void
  toggleTheme: () => void
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function applyToDocument(resolved: ResolvedTheme, density: Density) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.density = density

  root.style.colorScheme = resolved

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    meta.content = getComputedStyle(root).getPropertyValue('--sem-canvas').trim()
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: env.VITE_THEME,
      density: 'comfortable',
      resolved: resolve(env.VITE_THEME),

      setMode(mode) {
        const resolved = resolve(mode)
        set({ mode, resolved })
        applyToDocument(resolved, get().density)
      },

      setDensity(density) {
        set({ density })
        applyToDocument(get().resolved, density)
      },

      toggleTheme() {
        get().setMode(get().resolved === 'dark' ? 'light' : 'dark')
      },
    }),
    {
      name: 'yn.theme',

      version: 2,
      migrate: (persisted) => {
        const state = persisted as Partial<PersistedTheme> | undefined
        if (!state) return undefined
        return {
          mode: state.mode ?? env.VITE_THEME,
          density: state.density ?? 'comfortable',
        }
      },

      // `resolved` is deliberately not persisted: it is recomputed on startup,
      // so an OS theme change while the app was closed is picked up.
      partialize: (state) => ({ mode: state.mode, density: state.density }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const resolved = resolve(state.mode)
        state.resolved = resolved
        applyToDocument(resolved, state.density)
      },
    },
  ),
)

export function initTheme(): void {
  const { mode, density } = useThemeStore.getState()
  const resolved = resolve(mode)
  useThemeStore.setState({ resolved })
  applyToDocument(resolved, density)

  if (typeof window !== 'undefined') {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        const state = useThemeStore.getState()
        if (state.mode !== 'system') return
        const next = resolve('system')
        useThemeStore.setState({ resolved: next })
        applyToDocument(next, state.density)
      })
  }
}
