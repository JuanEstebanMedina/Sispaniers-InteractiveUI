import { FileText, SendHorizonal, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { LogisticsDocument } from '@/schemas'

interface ChatComposerProps {
  draft: string
  onDraftChange: (draft: string) => void
  onSend: () => void
  docs: LogisticsDocument[]
  onDetach: (documentId: string) => void
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  docs,
  onDetach,
}: ChatComposerProps) {
  const { t } = useTranslation('domain')
  const draftRef = useRef<HTMLTextAreaElement>(null)

  // Crece con el contenido hasta el max-height y ahí ya scrollea. `rows` no
  // sirve: fija la altura y un mensaje largo se esconde bajo el borde.
  useEffect(() => {
    const field = draftRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }, [draft])

  return (
    <div className="shrink-0 border-t border-line">
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
          // Enter envía, Shift+Enter salta de línea: esto es un chat, no un
          // documento, y buscar el botón en cada mensaje estorba.
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            onSend()
          }}
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() && docs.length === 0}
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
