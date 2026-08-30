import { create } from 'zustand'

export interface ChatReference {
  id: string
  title: string
}

interface ChatReferenceStore {
  operationId: string | null
  references: ChatReference[]
  reference: (operationId: string, reference: ChatReference) => void
  unreference: (componentId: string) => void
  clear: () => void
}

/**
 * Widgets the next chat message points the agent at. Mirrors `chatAttachStore`:
 * the rail follows whichever operation is active, so switching boards drops the
 * pending references instead of carrying them across.
 */
export const useChatReferenceStore = create<ChatReferenceStore>()((set) => ({
  operationId: null,
  references: [],

  reference: (operationId, reference) =>
    set((state) => {
      const references = state.operationId === operationId ? state.references : []
      if (references.some((existing) => existing.id === reference.id)) {
        return { operationId, references }
      }
      return { operationId, references: [...references, reference] }
    }),

  unreference: (componentId) =>
    set((state) => ({
      references: state.references.filter((reference) => reference.id !== componentId),
    })),

  clear: () => set({ references: [] }),
}))
