import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { tokenStore } from '@/auth/tokenStore'
import { env } from '@/config/env'

type SseHandler = (event: string, data: string) => void
export type SseStatus = 'connecting' | 'live' | 'offline' | 'ended'

export function useSse(path: string, onEvent: SseHandler): SseStatus {
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [status, setStatus] = useState<SseStatus>('connecting')
  const [retry, setRetry] = useState(0)
  const token = useSyncExternalStore(tokenStore.subscribe, tokenStore.getAccessToken, () => null)

  useEffect(() => {
    if (!path || !token) return

    const controller = new AbortController()
    let retryTimer: number | undefined
    const url = `${env.VITE_API_URL.replace(/\/$/, '')}${path}`
    setStatus('connecting')

    void (async () => {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          setStatus('offline')
          return
        }
        setStatus('live')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read()
          if (done) {
            setStatus('ended')
            return
          }
          buffer += decoder.decode(value, { stream: true })

          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            const message = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const event = message.match(/^event: (.+)$/m)?.[1]
            const data = message.match(/^data: (.+)$/m)?.[1]
            if (event && data) handler.current(event, data)
            boundary = buffer.indexOf('\n\n')
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus('offline')
          retryTimer = window.setTimeout(() => setRetry((attempt) => attempt + 1), 3_000)
          console.warn('[sse] connection failed', error)
        }
      }
    })()

    return () => {
      controller.abort()
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [path, retry, token])

  return status
}
