import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { http } from '@/api/client'
import { endpoints } from '@/api/endpoints'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import type { LogisticsDocument } from '@/schemas'
import { useChatAttachStore } from '@/stores/chatAttachStore'
import { ChatComposer } from './ChatComposer'
import { ChatHistory, type ChatMessage } from './ChatHistory'

interface AgentChatProps {
  operationId: string
  className?: string
}

/**
 * Hablar con el agente para lo que la UI generada no tiene widget — «avisa al
 * cliente», «frena esto hasta que revise».
 *
 * El agente responde con un componente Y con un `reply` corto para leer.
 */
export function AgentChat({ operationId, className }: AgentChatProps) {
  const { t } = useTranslation('domain')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const docs = useChatAttachStore((state) => state.documents)
  const detachDoc = useChatAttachStore((state) => state.detach)
  const clearDocs = useChatAttachStore((state) => state.clear)

  function append(author: ChatMessage['author'], body: string, cited: string[] = []) {
    setMessages((current) => [
      ...current,
      { id: `msg-${current.length}`, author, body, docs: cited },
    ])
  }

  async function send() {
    const body = draft.trim()
    if (!body && docs.length === 0) return

    append('human', body, docs.map((document) => document.type))
    setDraft('')
    clearDocs()

    try {
      const { reply, component_created: componentCreated } = await http.post<{
        reply: string
        component_created: boolean
      }>(endpoints.ai.chat(operationId), { message: withDocs(body, docs) })

      // No widget is coming for this turn — the reply is the whole answer.
      // A transient notice fits that better than a line that sits in the
      // history forever next to messages that did build something.
      if (componentCreated) {
        append('agent', reply)
      } else {
        toast.info(reply)
      }
    } catch {
      toast.error(t('operation.chat.sendError'))
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
