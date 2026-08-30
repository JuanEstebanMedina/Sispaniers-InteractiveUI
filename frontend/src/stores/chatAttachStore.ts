import { create } from 'zustand'

import type { LogisticsDocument } from '@/schemas'

/**
 * ARCHIVOS QUE VAN AL CHAT
 *
 * "Preguntarle a la IA por este archivo" empieza en la sección de Archivos y
 * termina en el cuadro del chat, dos secciones distintas del riel. Un store en
 * medio y no props porque el riel no tiene por qué ser el cartero entre sus
 * propias secciones: hoy son dos, mañana son cuatro.
 *
 * Guarda REFERENCIAS a documentos que el backend ya tiene, no `File`s subidos.
 * Son dos cosas distintas y el chat las pinta distinto: uno se sube, el otro ya
 * está ahí y sólo se nombra.
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
      // Cambiar de operación vacía la selección: adjuntar el BL de una carga y
      // preguntarlo dentro de otra sería darle al agente contexto que no es suyo.
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
