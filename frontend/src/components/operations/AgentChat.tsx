import { SendHorizonal, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'

interface ChatMessage {
  id: string
  author: 'agent' | 'human'
  body: string
}

interface AgentChatProps {
  operationId: string
  className?: string
}

/**
 * Talking to the agent directly, for the manual asks the generated UI has no
 * widget for — "send the client an email", "hold this until I check".
 *
 * The agent never replies with free text — it responds by generating or
 * updating a UI component (see `POST /operations/:id/chat`). So a successful
 * send appends a generic acknowledgment, not an invented answer.
 */
export function AgentChat({ operationId, className }: AgentChatProps) {
  const { t } = useTranslation('domain')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<HTMLTextAreaElement>(null)

  // Grow with the content up to the CSS max-height, then let it scroll.
  // `rows` alone cannot do this: it fixes the height, so a long message just
  // hides under the fold.
  useEffect(() => {
    const field = draftRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [draft])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function appendAgentMessage(body: string) {
    setMessages((current) => [...current, { id: `msg-${current.length}`, author: 'agent', body }])
  }

  async function send() {
    const body = draft.trim()
    if (!body) return
    setMessages((current) => [
      ...current,
      { id: `msg-${current.length}`, author: 'human', body },
    ])
    setDraft('')

    try {
      await http.post(endpoints.ai.chat(operationId), { message: body })
      appendAgentMessage(t('operation.chat.componentGenerated'))
    } catch {
      toast.error(t('operation.chat.sendError'))
    }
  }

  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label={t('operation.chat.title')}>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-card py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <span
              className="flex size-12 items-center justify-center rounded-full bg-brand-subtle"
              aria-hidden
            >
              <Sparkles className="size-5 text-brand" />
            </span>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-fg">{t('operation.chat.emptyTitle')}</p>
              <p className="max-w-60 text-pretty text-xs leading-relaxed text-fg-subtle">
                {t('operation.chat.empty')}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'w-fit max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs',
                message.author === 'human'
                  ? 'ml-auto bg-brand-subtle text-fg'
                  : 'bg-surface text-fg-muted',
              )}
            >
              {message.body}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-line">
        <div className="flex items-end gap-2 px-card py-3">
          <textarea
            ref={draftRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={t('operation.chat.placeholder')}
            aria-label={t('operation.chat.placeholder')}
            className={cn(
              'max-h-40 min-h-control-sm flex-1 resize-none overflow-y-auto rounded-md border border-line',
              'bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            )}
            // Enter sends, Shift+Enter breaks the line: this is a chat box, not a
            // document, and reaching for a button on every message is friction.
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) return
              event.preventDefault()
              send()
            }}
          />

          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            aria-label={t('operation.chat.send')}
            title={t('operation.chat.send')}
            className={cn(
              'flex size-control-sm shrink-0 items-center justify-center rounded-md',
              'bg-brand text-brand-fg transition-opacity',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <SendHorizonal className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  )
}
