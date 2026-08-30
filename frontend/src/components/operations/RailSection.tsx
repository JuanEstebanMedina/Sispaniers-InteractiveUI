import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface RailSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  /** Shown beside the title, and the only signal left once it is collapsed. */
  badge?: number
  /**
   * A control next to the title — e.g. a direct-upload button — that acts
   * without expanding or collapsing the section. Rendered as a sibling of the
   * toggle button, never inside it: nesting an interactive control inside the
   * header's own button is invalid HTML and breaks its click target.
   */
  action?: ReactNode
  /**
   * Share of the leftover height this section takes while open, relative to its
   * open siblings. Two sections at 2 and 1 split the panel two thirds / one.
   */
  weight?: number
  children: ReactNode
}

/**
 * One collapsible band of the side panel.
 *
 * The panel is a stack of these, and they divide the height between them: open
 * one and the others give up room, collapse one and it shrinks to its header.
 * That is what lets a third section be added later without rebalancing the two
 * that already exist by hand.
 *
 * A collapsed section keeps its header on screen. It is the row you click to
 * get it back, and with a badge it still reports what changed while hidden.
 */
export function RailSection({
  title,
  open,
  onToggle,
  badge = 0,
  action,
  weight = 1,
  children,
}: RailSectionProps) {
  const bodyId = useId()

  return (
    <section
      className={cn('flex min-h-0 flex-col', open ? 'flex-1' : 'shrink-0')}
      style={open ? { flexGrow: weight } : undefined}
    >
      <header className="flex shrink-0 items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 px-card py-2.5 text-left',
            'transition-colors hover:bg-surface-hover',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          )}
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-fg-subtle transition-transform',
              !open && '-rotate-90',
            )}
            aria-hidden
          />

          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</h2>

          {badge > 0 && (
            <span
              className={cn(
                'flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5',
                'bg-accent text-2xs font-semibold tabular text-accent-fg',
              )}
            >
              {badge}
            </span>
          )}
        </button>

        {action}
      </header>

      {/* Hidden, not unmounted. The chat holds sent messages, a draft and a
          file selection; collapsing the section must not throw them away. */}
      <div id={bodyId} hidden={!open} className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </section>
  )
}
