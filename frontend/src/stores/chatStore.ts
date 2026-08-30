import { create } from 'zustand'

export interface ChatMessage {
  id: string
  author: 'agent' | 'human'
  body: string
  docs: string[]
  /** Titles of the widgets the message pointed the agent at. */
  refs: string[]
}

interface ChatStore {
  messagesByOperation: Record<string, ChatMessage[]>
  append: (operationId: string, message: Omit<ChatMessage, 'id'>) => void
}

export const useChatStore = create<ChatStore>()((set) => ({
  messagesByOperation: {},
  append: (operationId, message) =>
    set((state) => {
      const messages = state.messagesByOperation[operationId] ?? []
      const next = { id: `msg-${messages.length}`, ...message }
      return {
        messagesByOperation: {
          ...state.messagesByOperation,
          [operationId]: [...messages, next],
        },
      }
    }),
}))
