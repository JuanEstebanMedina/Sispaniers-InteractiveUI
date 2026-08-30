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
      const { reply } = await http.post<{ reply: string }>(endpoints.ai.chat(operationId), {
        message: withDocs(body, docs),
      })
      append('agent', reply)
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
