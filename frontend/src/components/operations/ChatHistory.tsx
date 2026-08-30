import { FileText, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { ChatMessage } from '@/stores/chatStore'

export function ChatHistory({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-card py-3">
      {messages.length === 0 ? <EmptyChat /> : messages.map((message) => (
        <Bubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  )
}

function EmptyChat() {
  const { t } = useTranslation('domain')

  return (
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
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation('domain')

  return (
    <div
      className={cn(
        'w-fit max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs',
        message.author === 'human' ? 'ml-auto bg-brand-subtle text-fg' : 'bg-surface text-fg-muted',
      )}
    >
      {message.body}

      {message.docs.map((type) => (
        <span key={type} className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {t(`operation.files.types.${type}`, { defaultValue: type })}
          </span>
        </span>
      ))}
    </div>
  )
}
