import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import type { LogisticsDocument } from '@/schemas'
import { useChatAttachStore } from '@/stores/chatAttachStore'
import { useChatStore } from '@/stores/chatStore'
import { ChatComposer } from './ChatComposer'
import { ChatHistory } from './ChatHistory'

interface AgentChatProps {
  operationId: string
  className?: string
}

const EMPTY_MESSAGES: never[] = []

/**
 * Hablar con el agente para lo que la UI generada no tiene widget — «avisa al
 * cliente», «frena esto hasta que revise».
 *
 * El agente responde con un componente Y con un `reply` corto para leer.
 */
export function AgentChat({ operationId, className }: AgentChatProps) {
  const { t } = useTranslation('domain')
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messages = useChatStore((state) => state.messagesByOperation[operationId] ?? EMPTY_MESSAGES)
  const appendMessage = useChatStore((state) => state.append)
  const docs = useChatAttachStore((state) => state.documents)
  const detachDoc = useChatAttachStore((state) => state.detach)
  const clearDocs = useChatAttachStore((state) => state.clear)

  function append(author: 'agent' | 'human', body: string, cited: string[] = []) {
    appendMessage(operationId, { author, body, docs: cited })
  }

  async function send() {
    const body = draft.trim()
    if (isSending || (!body && docs.length === 0)) return

    append('human', body, docs.map((document) => document.type))
    setDraft('')
    clearDocs()
    setIsSending(true)

    try {
      const { reply } = await http.post<{ reply: string }>(endpoints.ai.chat(operationId), {
        message: withDocs(body, docs),
      })
      append('agent', reply)
    } catch {
      toast.error(t('operation.chat.sendError'))
    } finally {
      setIsSending(false)
    }
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
        disabled={isSending}
      />
    </section>
  )
}

/**
 * `POST /operations/:id/chat` sólo acepta `message: string` — no tiene canal
 * para adjuntos, así que el documento se cita por tipo e id dentro del texto.
 * El agente ya tiene la operación en su contexto y con el id lo encuentra.
 */
function withDocs(body: string, docs: LogisticsDocument[]): string {
  if (docs.length === 0) return body

  const cited = docs.map((document) => `${document.type} (${document.id})`).join(', ')
  const question = body || 'Resume estos documentos.'

  return `${question}\n\nDocumentos de esta operación a los que me refiero: ${cited}`
}
