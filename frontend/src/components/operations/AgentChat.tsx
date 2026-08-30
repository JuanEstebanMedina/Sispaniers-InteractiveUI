import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api$, http } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { cn } from '@/lib/cn'
import { documentFilename } from '@/lib/document'
import { MAX_UPLOAD_BYTES, mimetypeOf, toBase64 } from '@/lib/file'
import { toast } from '@/lib/toast'
import { uploadDocumentResponseSchema, type LogisticsDocument } from '@/schemas'
import { useChatAttachStore } from '@/stores/chatAttachStore'
import { useChatReferenceStore } from '@/stores/chatReferenceStore'
import { useChatStore } from '@/stores/chatStore'
import { ChatComposer } from './ChatComposer'
import { ChatHistory } from './ChatHistory'

interface AgentChatProps {
  operationId: string
  className?: string
}

const EMPTY_MESSAGES: never[] = []
const EMPTY_REFERENCES: never[] = []

export function AgentChat({ operationId, className }: AgentChatProps) {
  const { t } = useTranslation('domain')
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const queryClient = useQueryClient()
  const refetchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(
    () => () => {
      for (const timer of refetchTimersRef.current) clearTimeout(timer)
    },
    [],
  )
  const messages = useChatStore((state) => state.messagesByOperation[operationId] ?? EMPTY_MESSAGES)
  const appendMessage = useChatStore((state) => state.append)
  const references = useChatReferenceStore((state) =>
    state.operationId === operationId ? state.references : EMPTY_REFERENCES,
  )
  const unreference = useChatReferenceStore((state) => state.unreference)
  const clearReferences = useChatReferenceStore((state) => state.clear)
  const docs = useChatAttachStore((state) => state.documents)
  const attachDoc = useChatAttachStore((state) => state.attach)
  const detachDoc = useChatAttachStore((state) => state.detach)
  const clearDocs = useChatAttachStore((state) => state.clear)

  function append(
    author: 'agent' | 'human',
    body: string,
    cited: string[] = [],
    pointedAt: string[] = [],
  ) {
    appendMessage(operationId, { author, body, docs: cited, refs: pointedAt })
  }

  async function send() {
    const body = draft.trim()
    if (
      isSending ||
      (!body && docs.length === 0 && references.length === 0 && pendingFiles.length === 0)
    ) {
      return
    }

    setIsSending(true)

    let uploaded: LogisticsDocument[] = []
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        uploaded = await uploadFiles(pendingFiles)
      } catch {
        toast.error(t('operation.chat.uploadError'))
        setUploading(false)
        setIsSending(false)
        return
      }
      setUploading(false)
    }

    const allDocs = [...docs, ...uploaded]
    const componentIds = references.map((reference) => reference.id)
    append(
      'human',
      body,
      allDocs.map((document) => documentFilename(document)),
      references.map((reference) => reference.title),
    )
    setDraft('')
    clearDocs()
    clearReferences()
    setPendingFiles([])

    try {
      const { reply } = await http.post<{ reply: string; component_created: boolean }>(
        endpoints.ai.chat(operationId),
        {
          message: withDocs(body, allDocs),
          ...(componentIds.length > 0 && { componentIds }),
        },
      )
      append('agent', reply)
    } catch {
      toast.error(t('operation.chat.sendError'))
    } finally {
      setIsSending(false)
    }
  }

  function pickFiles(files: FileList) {
    const accepted: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(t('operation.chat.fileTooLarge', { name: file.name }))
        continue
      }
      accepted.push(file)
    }
    if (accepted.length > 0) setPendingFiles((current) => [...current, ...accepted])
  }

  function removePendingFile(index: number) {
    setPendingFiles((current) => current.filter((_, i) => i !== index))
  }

  async function uploadFiles(files: File[]): Promise<LogisticsDocument[]> {
    const results: LogisticsDocument[] = []

    for (const file of files) {
      const { document } = await api$.post(
        endpoints.operations.documents(operationId),
        uploadDocumentResponseSchema,
        { filename: file.name, mimetype: mimetypeOf(file), data: await toBase64(file) },
      )
      attachDoc(operationId, document)
      results.push(document)
    }

    // `operations.all`, no sólo `.detail(operationId)`: la sección de Archivos
    // no lee de `.detail` — la alimenta `OperationsLayout` desde `.list()`, que
    // es una caché distinta. Invalidar sólo `.detail` deja a Archivos sin
    // enterarse de que hay un documento nuevo.
    void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all })

    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all })
    }, 15_000)
    refetchTimersRef.current.push(timer)

    return results
  }

  return (
    <section
      className={cn('flex min-h-0 flex-col', className)}
      aria-label={t('operation.chat.title')}
    >
      <ChatHistory messages={messages} />
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={send}
        docs={docs}
        onDetach={detachDoc}
        onPickFiles={pickFiles}
        pendingFiles={pendingFiles}
        onRemovePendingFile={removePendingFile}
        uploading={uploading}
        references={references}
        onUnreference={unreference}
        disabled={isSending}
      />
    </section>
  )
}

function withDocs(body: string, docs: LogisticsDocument[]): string {
  if (docs.length === 0) return body

  const cited = docs
    .map((document) => `${documentFilename(document)} (${document.type}, ${document.id})`)
    .join(', ')
  const question = body || 'Resume estos documentos.'

  return `${question}\n\nDocumentos de esta operación a los que me refiero: ${cited}`
}
