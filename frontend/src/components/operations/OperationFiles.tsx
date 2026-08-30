import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Inbox,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { cn } from '@/lib/cn'
import { documentFilename } from '@/lib/document'
import { MAX_UPLOAD_BYTES, mimetypeOf, toBase64 } from '@/lib/file'
import { formatCalendarDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import { uploadDocumentResponseSchema } from '@/schemas'
import {
  documentPreviewSchema,
  type DocumentFormat,
  type LogisticsDocument,
  type Operation,
} from '@/schemas'
import { useChatAttachStore } from '@/stores/chatAttachStore'
import { useRailStore } from '@/stores/railStore'

const FORMAT_ICONS: Record<DocumentFormat, typeof File> = {
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  image: FileImage,
  other: File,
}

interface OperationFilesProps {
  operation: Operation | undefined
  documents: LogisticsDocument[]
  className?: string
}

export function OperationFiles({ operation, documents, className }: OperationFilesProps) {
  const { t } = useTranslation('domain')

  if (documents.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}>
        <span className="flex size-12 items-center justify-center rounded-full bg-surface" aria-hidden>
          <Inbox className="size-5 text-fg-subtle" />
        </span>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-fg">{t('operation.files.emptyTitle')}</p>
          <p className="max-w-60 text-pretty text-xs leading-relaxed text-fg-subtle">
            {t('operation.files.empty')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className={cn('min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2', className)}>
      {documents.map((document) => (
        <li key={document.id}>
          <FileRow operation={operation} document={document} />
        </li>
      ))}
    </ul>
  )
}

function FileRow({
  operation,
  document,
}: {
  operation: Operation | undefined
  document: LogisticsDocument
}) {
  const { t } = useTranslation('domain')
  const [opening, setOpening] = useState(false)
  const attach = useChatAttachStore((state) => state.attach)
  const attached = useChatAttachStore((state) =>
    state.documents.some((current) => current.id === document.id),
  )
  const openSection = useRailStore((state) => state.openSection)

  const Icon = FORMAT_ICONS[document.format]
  const kind = t(`operation.files.types.${document.type}`, { defaultValue: document.type })
  const filename = documentFilename(document)
  const label = filename

  async function open() {
    if (!operation) return

    const tab = window.open('', '_blank')
    setOpening(true)

    try {
      const preview = await api$.get(
        endpoints.operations.documentPreview(operation.trackId, document.id),
        documentPreviewSchema,
      )
      if (tab) tab.location.href = preview.url
      else window.location.href = preview.url
    } catch {
      tab?.close()
      toast.error(t('operation.files.openError'))
    } finally {
      setOpening(false)
    }
  }

  function ask() {
    if (!operation) return
    attach(operation.trackId, document)
    openSection('chat')
  }

  const { text, ...structured } = document.extractedData
  const facts = Object.entries(structured).slice(0, 4)
  const bodyText = typeof text === 'string' ? text.trim() : ''

  return (
    <article className="rounded-md px-2 py-2 transition-colors hover:bg-surface-hover">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg" title={label}>
            {label}
          </p>
          <p className="mt-0.5 truncate text-xs text-fg-subtle">
            {filename
              ? `${kind} · ${formatCalendarDate(document.receivedAt)}`
              : formatCalendarDate(document.receivedAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            onClick={ask}
            disabled={attached}
            label={
              attached ? t('operation.files.alreadyAttached') : t('operation.files.ask')
            }
            active={attached}
          >
            <Sparkles className="size-3.5" aria-hidden />
          </IconButton>

          <IconButton onClick={open} disabled={opening} label={t('operation.files.open')}>
            {opening ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ExternalLink className="size-3.5" aria-hidden />
            )}
          </IconButton>
        </div>
      </div>

      {facts.length > 0 && (
        <dl className="mt-1.5 flex flex-wrap gap-1 pl-6">
          {facts.map(([key, value]) => (
            <div
              key={key}
              className="flex items-baseline gap-1 rounded bg-surface px-1.5 py-0.5 text-xs"
            >
              <dt className="text-fg-subtle">{key}</dt>
              <dd className="max-w-40 truncate font-medium tabular text-fg-muted">
                {factValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {bodyText && (
        <p
          className="mt-1.5 pl-6 text-xs leading-relaxed text-fg-subtle"
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
          title={bodyText.slice(0, 2000)}
        >
          {bodyText}
        </p>
      )}
    </article>
  )
}

function factValue(value: unknown): string {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

function IconButton({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-7 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        active ? 'text-brand' : 'text-fg-subtle hover:bg-surface hover:text-fg',
        disabled && !active && 'cursor-not-allowed opacity-50',
        disabled && active && 'cursor-default',
      )}
    >
      {children}
    </button>
  )
}

export function DirectUploadButton({ operationId }: { operationId: string }) {
  const { t } = useTranslation('domain')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    },
    [],
  )

  async function upload(files: FileList) {
    setUploading(true)
    let uploadedAny = false
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(t('operation.chat.fileTooLarge', { name: file.name }))
          continue
        }
        await api$.post(endpoints.operations.documents(operationId), uploadDocumentResponseSchema, {
          filename: file.name,
          mimetype: mimetypeOf(file),
          data: await toBase64(file),
        })
        uploadedAny = true
      }
      // `operations.all`, no sólo `.detail`: esta misma sección de Archivos se
      // alimenta de `.list()` a través de `OperationsLayout` — invalidar sólo
      // `.detail` no la refresca.
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all })

      if (uploadedAny) {
        refetchTimerRef.current = setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all })
        }, 15_000)
      }
    } catch {
      toast.error(t('operation.chat.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          const { files } = event.currentTarget
          if (files?.length) void upload(files)
          event.currentTarget.value = ''
        }}
      />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          fileRef.current?.click()
        }}
        disabled={uploading}
        aria-label={t('operation.files.upload')}
        title={t('operation.files.upload')}
        className={cn(
          'flex size-control-xs shrink-0 items-center justify-center rounded-md',
          'text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-3.5" aria-hidden />
        )}
      </button>
    </>
  )
}
