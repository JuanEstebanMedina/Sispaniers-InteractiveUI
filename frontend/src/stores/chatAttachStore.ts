import { create } from 'zustand'

import type { LogisticsDocument } from '@/schemas'

/**
 * Documentos que la sección de Archivos manda al chat. Un store y no props
 * porque son dos secciones hermanas del riel y este no tiene por qué hacer de
 * cartero entre ellas.
 */

interface ChatAttachStore {
  /** De qué operación son los adjuntos actuales. */
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
      // Cambiar de operación vacía la selección: sería contexto de otra carga.
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
