import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const RAIL_MIN_WIDTH = 240
export const RAIL_MAX_WIDTH = 560
export const RAIL_DEFAULT_WIDTH = 288

interface RailStore {
  open: boolean
  width: number
  /**
   * Which panel sections are expanded, by id. A map and not a flag per section
   * so adding one later costs nothing here.
   */
  sections: Record<string, boolean>
  toggle: () => void
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
  toggleSection: (id: string) => void
  /** Como `toggleSection` pero sólo abre: llamarlo sobre la abierta no la cierra. */
  openSection: (id: string) => void
}

/**
 * Each section names its own default, because "all open" is not a sensible
 * starting point once there are more than two: the panel opens showing a slice
 * of everything and enough of nothing.
 */
export const isOpen = (
  sections: Record<string, boolean>,
  id: string,
  fallback = false,
) => sections[id] ?? fallback

/** The one section that earns the panel's height before anyone touches it. */
export const DEFAULT_SECTIONS: Record<string, boolean> = { chat: true, files: false }

/** Every known section closed except `id`. The accordion's one move. */
function onlyOpen(sections: Record<string, boolean>, id: string): Record<string, boolean> {
  const known = { ...DEFAULT_SECTIONS, ...sections }
  const closed = Object.fromEntries(Object.keys(known).map((key) => [key, false]))
  return { ...closed, [id]: true }
}

const clamp = (width: number) => Math.min(Math.max(width, RAIL_MIN_WIDTH), RAIL_MAX_WIDTH)

/**
 * Whether the side panel is showing, and how wide the user dragged it.
 *
 * A store rather than layout state because the toggle lives in the detail
 * header, the panel in the route layout, and the grid needs the width to know
 * how much space to size itself past — three components with no props between
 * them.
 *
 * Persisted: someone who closed the panel or sized it to taste does not want
 * to redo either on every reload.
 */
export const useRailStore = create<RailStore>()(
  persist(
    (set) => ({
      open: true,
      width: RAIL_DEFAULT_WIDTH,
      sections: {},
      toggle: () => set((state) => ({ open: !state.open })),
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: clamp(width) }),
      // Accordion: opening one closes the rest. Sections split the panel's
      // height, so two open at once give each a slice too short to work in —
      // and the chat, which needs the most room, suffers worst.
      toggleSection: (id) =>
        set((state) => {
          if (isOpen(state.sections, id, DEFAULT_SECTIONS[id])) {
            return { sections: { ...state.sections, [id]: false } }
          }
          return { sections: onlyOpen(state.sections, id) }
        }),

      openSection: (id) =>
        set((state) =>
          isOpen(state.sections, id, DEFAULT_SECTIONS[id])
            ? state
            : { sections: onlyOpen(state.sections, id) },
        ),
    }),
    {
      name: 'sp.rail',
      // Clamped on the way back in too: a stored width survives a change to the
      // bounds, and an out-of-range one would render a panel nobody can fix.
      merge: (persisted, current) => {
        const saved = persisted as Partial<RailStore> | undefined
        return {
          ...current,
          ...saved,
          width: clamp(saved?.width ?? RAIL_DEFAULT_WIDTH),
        }
      },
    },
  ),
)
