import { Paperclip, SendHorizonal, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'

interface ChatMessage {
  id: string
  author: 'agent' | 'human'
  body: string
  files: { name: string; size: number }[]
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
  const [attached, setAttached] = useState<File[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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

  // An attachment on its own is a valid message: dropping in a Bill of Lading
  // with no covering note is the common case.
  function send() {
    const body = draft.trim()
    if (!body && attached.length === 0) return
    setMessages((current) => [
      ...current,
      {
        id: `msg-${current.length}`,
        author: 'human',
        body,
        files: attached.map((file) => ({ name: file.name, size: file.size })),
      },
    ])
    setDraft('')
    setAttached([])
  }

  function attach(picked: FileList | null) {
    if (!picked?.length) return
    setAttached((current) => [...current, ...Array.from(picked)])
    // Reset the input so picking the same file twice in a row still fires
    // onChange — the value would otherwise be unchanged and the event skipped.
    if (fileRef.current) fileRef.current.value = ''
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

              {message.files.map((file) => (
                <span
                  key={file.name}
                  className="mt-1 flex items-center gap-1.5 text-2xs text-fg-muted"
                >
                  <Paperclip className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-fg-subtle">{formatBytes(file.size)}</span>
                </span>
              ))}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-line">
        {attached.length > 0 && (
          <ul className="space-y-1 px-card pt-2">
            {attached.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-2xs"
              >
                <Paperclip className="size-3 shrink-0 text-fg-subtle" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-fg-muted">{file.name}</span>
                <span className="shrink-0 text-fg-subtle">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttached((current) => current.filter((_, i) => i !== index))}
                  aria-label={t('operation.chat.removeFile', { name: file.name })}
                  className="shrink-0 rounded-xs text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2 px-card py-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => attach(event.currentTarget.files)}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t('operation.chat.attach')}
            title={t('operation.chat.attach')}
            className={cn(
              'flex size-control-sm shrink-0 items-center justify-center rounded-md',
              'border border-line text-fg-muted transition-colors',
              'hover:bg-surface-hover hover:text-fg',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <Paperclip className="size-3.5" aria-hidden />
          </button>

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
            disabled={!draft.trim() && attached.length === 0}
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
