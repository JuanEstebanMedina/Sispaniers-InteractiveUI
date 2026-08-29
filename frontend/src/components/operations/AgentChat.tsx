import { SendHorizonal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

interface ChatMessage {
  id: string
  author: 'agent' | 'human'
  body: string
}

interface AgentChatProps {
  className?: string
}

/**
 * Talking to the agent directly, for the manual asks the generated UI has no
 * widget for — "send the client an email", "hold this until I check".
 *
 * Messages live in component state only: there is no endpoint behind this yet.
 * It deliberately does NOT fake an agent reply — an invented answer in a
 * supervision console is worse than an obvious silence.
 */
export function AgentChat({ className }: AgentChatProps) {
  const { t } = useTranslation('domain')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function send() {
    const body = draft.trim()
    if (!body) return
    setMessages((current) => [
      ...current,
      { id: `msg-${current.length}`, author: 'human', body },
    ])
    setDraft('')
  }

  return (
    <section className={cn('flex min-h-0 flex-col', className)} aria-label={t('operation.chat.title')}>
      <header className="shrink-0 px-card pb-2 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('operation.chat.title')}
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-card pb-2">
        {messages.length === 0 ? (
          <p className="text-xs text-fg-subtle">{t('operation.chat.empty')}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'w-fit max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs',
                message.author === 'human'
                  ? 'ml-auto bg-brand-subtle text-fg'
                  : 'bg-surface-sunken text-fg-muted',
              )}
            >
              {message.body}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 items-end gap-1.5 px-card pb-3">
        <textarea
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={t('operation.chat.placeholder')}
          aria-label={t('operation.chat.placeholder')}
          className={cn(
            'max-h-24 min-h-control-sm flex-1 resize-none rounded-md border border-line',
            'bg-surface-sunken px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle',
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
    </section>
  )
}
