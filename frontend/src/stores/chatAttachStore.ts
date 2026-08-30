import { create } from 'zustand'

import type { LogisticsDocument } from '@/schemas'

interface ChatAttachStore {
  operationId: string | null
  documents: LogisticsDocument[]
  attach: (operationId: string, document: LogisticsDocument) => void
  detach: (documentId: string) => void
  clear: () => void
}

export const useChatAttachStore = create<ChatAttachStore>()((set) => ({
  operationId: null,
  documents: [],

  attach: (operationId, document) =>
    set((state) => {
      const documents = state.operationId === operationId ? state.documents : []
      if (documents.some((existing) => existing.id === document.id)) {
        return { operationId, documents }
      }
      return { operationId, documents: [...documents, document] }
    }),

  detach: (documentId) =>
    set((state) => ({
      documents: state.documents.filter((document) => document.id !== documentId),
    })),

  clear: () => set({ documents: [] }),
}))
