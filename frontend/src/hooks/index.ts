import { useCallback, useEffect, useRef, useState } from 'react'

import { t } from '@/i18n'
import { toast } from '@/lib/toast'

export * from './useCompanyDirectory'
export * from './useDebounce'
export * from './useMediaQuery'
export * from './useSse'

export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial)

  return {
    isOpen,
    open: useCallback(() => setIsOpen(true), []),
    close: useCallback(() => setIsOpen(false), []),
    toggle: useCallback(() => setIsOpen((value) => !value), []),
    setIsOpen,
  }
}

export function useCopyToClipboard(resetAfter = 2000) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const copy = useCallback(
    async (text: string, message?: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }

        setCopied(true)
        toast.success(message ?? t('actions.copied'))

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), resetAfter)
        return true
      } catch {
        toast.error(t('errors:kinds.unknown'))
        return false
      }
    },
    [resetAfter],
  )

  return { copy, copied }
}

export function useHotkey(
  key: string,
  handler: () => void,
  options: { meta?: boolean; shift?: boolean; alt?: boolean; enabled?: boolean } = {},
) {
  const { meta = false, shift = false, alt = false, enabled = true } = options
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTyping && !meta) return

      const metaPressed = event.metaKey || event.ctrlKey

      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        metaPressed === meta &&
        event.shiftKey === shift &&
        event.altKey === alt
      ) {
        event.preventDefault()
        handlerRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, meta, shift, alt, enabled])
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = next instanceof Function ? next(previous) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update] as const
}
