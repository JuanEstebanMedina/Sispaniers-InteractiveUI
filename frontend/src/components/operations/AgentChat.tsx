import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api$, http } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { cn } from '@/lib/cn'
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
  /** Elegidos en el explorador, sin subir todavía: se suben al enviar. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const queryClient = useQueryClient()
  const refetchTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Cancela los refetch demorados si la persona sale del chat antes de que se
  // cumplan los 15 s: nadie está mirando la sección de Archivos para que valga
  // la pena la petición.
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

    // Lo que se eligió en el explorador se sube recién ahora, no al elegirlo:
    // si la subida falla, el mensaje no sale y los archivos quedan pendientes
    // para reintentar, en vez de haber subido algo a una operación sin que la
    // persona llegara a enviar nada.
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
      allDocs.map((document) => document.type),
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

  /**
   * Sólo guarda lo elegido. La subida real ocurre en `send()` — ver ahí por
   * qué: si se subiera aquí, un archivo elegido y nunca enviado ya habría
   * quedado guardado en la operación.
   */
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

  /**
   * Sube cada archivo a la OPERACIÓN, no al mensaje: el backend lo extrae ahí,
   * y esa extracción es la que llega al modelo. Dejarlo en el mensaje le daría
   * al agente un nombre de archivo y nada que leer.
   */
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

    // La operación tiene documentos que hace un momento no tenía, y la sección
    // de Archivos los lee de esta misma caché.
    void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) })

    // Y una segunda vuelta a los 15 s: el mensaje que acompaña al archivo
    // dispara al agente, y si éste procesa el documento o lo cita en un
    // componente, ese cambio llega después de la respuesta del chat. Sin este
    // refetch, la sección de Archivos se queda con la primera foto y nunca se
    // entera de lo que pasó mientras el agente trabajaba.
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(operationId) })
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

/**
 * `POST /operations/:id/chat` only accepts `message: string` — there is no
 * channel for attachments, so a document is cited by type and id inside the
 * text. The agent already holds the operation and resolves the id from there.
 */
function withDocs(body: string, docs: LogisticsDocument[]): string {
  if (docs.length === 0) return body

  const cited = docs.map((document) => `${document.type} (${document.id})`).join(', ')
  const question = body || 'Resume estos documentos.'

  return `${question}\n\nDocumentos de esta operación a los que me refiero: ${cited}`
}
