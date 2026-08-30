import { AtSign, FileText, SendHorizonal, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { LogisticsDocument } from '@/schemas'
import type { ChatReference } from '@/stores/chatReferenceStore'

interface ChatComposerProps {
  draft: string
  onDraftChange: (draft: string) => void
  onSend: () => void
  docs: LogisticsDocument[]
  onDetach: (documentId: string) => void
  references: ChatReference[]
  onUnreference: (componentId: string) => void
  disabled?: boolean
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  docs,
  onDetach,
  references,
  onUnreference,
  disabled = false,
}: ChatComposerProps) {
  const { t } = useTranslation('domain')
  const draftRef = useRef<HTMLTextAreaElement>(null)

  // Grows with the content up to the CSS max-height, then scrolls. `rows`
  // cannot do this: it fixes the height and a long message hides under the fold.
  useEffect(() => {
    const field = draftRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [draft])

  return (
    <div className="shrink-0 border-t border-line">
      {references.length > 0 && (
        <ul
          className="flex flex-wrap gap-1 px-card pt-2"
          aria-label={t('operation.chat.referencing')}
        >
          {references.map((reference) => (
            <ReferencedWidget
              key={reference.id}
              reference={reference}
              onUnreference={onUnreference}
            />
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <ul className="space-y-1 px-card pt-2">
          {docs.map((document) => (
            <AttachedDoc key={document.id} document={document} onDetach={onDetach} />
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 px-card py-3">
        <textarea
          ref={draftRef}
          rows={1}
          value={draft}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder={t('operation.chat.placeholder')}
          aria-label={t('operation.chat.placeholder')}
          className={cn(
            'max-h-40 min-h-control-sm flex-1 resize-none overflow-y-auto rounded-md border border-line',
            'bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          )}
          // Enter sends, Shift+Enter breaks the line: this is a chat, not a
          // document, and reaching for the button on every message is friction.
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            onSend()
          }}
        />

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || (!draft.trim() && docs.length === 0 && references.length === 0)}
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
  )
}

function ReferencedWidget({
  reference,
  onUnreference,
}: {
  reference: ChatReference
  onUnreference: (componentId: string) => void
}) {
  const { t } = useTranslation('domain')

  return (
    <li className="flex max-w-full items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-2xs">
      <AtSign className="size-3 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 truncate text-fg-muted">{reference.title}</span>
      <button
        type="button"
        onClick={() => onUnreference(reference.id)}
        aria-label={t('operation.chat.removeReference', { title: reference.title })}
        className="shrink-0 rounded-xs text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <X className="size-3" aria-hidden />
      </button>
    </li>
  )
}

function AttachedDoc({
  document,
  onDetach,
}: {
  document: LogisticsDocument
  onDetach: (documentId: string) => void
}) {
  const { t } = useTranslation('domain')
  const label = t(`operation.files.types.${document.type}`, { defaultValue: document.type })

  return (
    <li className="flex items-center gap-2 rounded-md bg-brand-subtle px-2 py-1.5 text-xs">
      <FileText className="size-3.5 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-fg-muted">{label}</span>
      <button
        type="button"
        onClick={() => onDetach(document.id)}
        aria-label={t('operation.chat.removeFile', { name: label })}
        className="shrink-0 rounded-xs text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}
