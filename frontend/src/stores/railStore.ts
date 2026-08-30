import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RailStore {
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

/**
 * Whether the side panel is showing.
 *
 * A store rather than layout state because the toggle lives in the detail
 * header and the panel lives in the route layout — two sibling route
 * components with no way to pass a prop between them.
 *
 * Persisted: someone who closed the panel does not want to close it again on
 * every reload.
 */
export const useRailStore = create<RailStore>()(
  persist(
    (set) => ({
      open: true,
      toggle: () => set((state) => ({ open: !state.open })),
      setOpen: (open) => set({ open }),
    }),
    { name: 'sp.rail' },
  ),
)
