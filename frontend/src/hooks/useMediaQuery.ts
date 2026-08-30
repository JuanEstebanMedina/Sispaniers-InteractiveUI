import { useSyncExternalStore } from 'react'

const BREAKPOINTS = {
  xs: '24rem',
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
  '3xl': '120rem',
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

const cache = new Map<string, MediaQueryList>()

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  let list = cache.get(query)
  if (!list) {
    list = window.matchMedia(query)
    cache.set(query, list)
  }
  return list
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = getMediaQueryList(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => getMediaQueryList(query)?.matches ?? false,
    () => false,
  )
}

export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]})`)
}

export function useIsMobile(): boolean {
  return !useBreakpoint('md')
}

export function useIsDesktop(): boolean {
  return useBreakpoint('lg')
}

export function useHasPointer(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)')
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
