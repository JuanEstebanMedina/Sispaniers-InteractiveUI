import { GripVertical, Pencil } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { type GridItem, colsForWidth, moveItem, pack } from '@/lib/grid'

const GAP_PX = 12

export interface Widget extends GridItem {
  title: string
  body: ReactNode
  fromAgent?: boolean
}

interface WidgetGridProps {
  widgets: Widget[]
  /**
   * Width, in px, that something else is taking from the row — the side panel.
   * The grid sizes itself as if that space were still its own and overflows
   * instead, so opening the panel scrolls the canvas rather than reflowing it
   * into a different column count.
   */
  reserve?: number
  /** Fires when the user renames a widget, so the caller can persist it. */
  onTitleChange?: (id: string, title: string) => void
  /**
   * Fires with the widget the user just moved and its new index in the
   * sequence. Coordinates are not sent on purpose: the sequence is what the
   * backend stores, and the grid packs the coordinates back out of it.
   */
  onMove?: (id: string, position: number) => void
  /**
   * Fires with the column count the grid settled on. The caller needs it
   * because the backend packs the layout for a specific width, and the two
   * must agree or the widgets land on different cells.
   */
  onColsChange?: (cols: number) => void
  className?: string
}

interface DragState {
  id: string
  pointerId: number
  startX: number
  startY: number
  dx: number
  dy: number
}

export function WidgetGrid({
  widgets,
  onTitleChange,
  onMove,
  onColsChange,
  reserve = 0,
  className,
}: WidgetGridProps) {
  const { t } = useTranslation('domain')
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [order, setOrder] = useState<string[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  /** Titles the user overrode, by widget id. The agent's own title is the fallback. */
  const [renamed, setRenamed] = useState<Record<string, string>>({})

  const rename = useCallback(
    (id: string, value: string) => {
      const next = value.trim()
      setEditing(null)
      if (!next) return
      setRenamed((current) => ({ ...current, [id]: next }))
      onTitleChange?.(id, next)
    },
    [onTitleChange],
  )

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  const layoutWidth = width > 0 ? width + reserve : 0
  const cols = layoutWidth > 0 ? colsForWidth(layoutWidth, GAP_PX) : 4
  const cell = layoutWidth > 0 ? (layoutWidth - GAP_PX * (cols - 1)) / cols : 0

  const announceCols = useRef(onColsChange)
  useEffect(() => {
    announceCols.current = onColsChange
  })
  useEffect(() => {
    announceCols.current?.(cols)
  }, [cols])

  // Widgets the user has never touched — anything the agent just added — keep
  // their incoming order and land at the end.
  const requested = useMemo(() => {
    if (order.length === 0) return widgets
    const rank = new Map(order.map((id, index) => [id, index]))
    return [...widgets].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [widgets, order])

  const settled = useMemo(() => pack(requested, cols), [requested, cols])

  const target = useMemo(() => {
    if (!drag || cell === 0) return null
    const origin = settled.find((candidate) => candidate.id === drag.id)
    if (!origin) return null
    const step = cell + GAP_PX
    return {
      col: origin.col + Math.round(drag.dx / step),
      row: origin.row + Math.round(drag.dy / step),
    }
  }, [drag, settled, cell])

  const dragId = drag?.id ?? null
  const targetCol = target?.col ?? null
  const targetRow = target?.row ?? null

  const preview = useMemo(
    () =>
      dragId !== null && targetCol !== null && targetRow !== null
        ? moveItem(settled, dragId, targetCol, targetRow, cols)
        : settled,
    [dragId, targetCol, targetRow, settled, cols],
  )

  const landing = dragId ? preview.find((item) => item.id === dragId) : undefined
  const origins = useMemo(() => new Map(settled.map((item) => [item.id, item])), [settled])

  const remember = useCallback(
    (layout: GridItem[], movedId: string) => {
      const sequence = layout.map((item) => item.id)
      // A drop or an arrow key that changes nothing — against the edge of the
      // grid, or back onto the widget's own cell — is not a move. Persisting it
      // would rewrite every sibling's order for no reason.
      if (sequence.every((id, index) => id === settled[index]?.id)) return

      setOrder(sequence)
      const position = sequence.indexOf(movedId)
      if (position !== -1) onMove?.(movedId, position)
    },
    [settled, onMove],
  )

  const commit = useCallback(() => {
    if (drag) remember(preview, drag.id)
    setDrag(null)
  }, [drag, preview, remember])

  useEffect(() => {
    if (!drag) return
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return
      setDrag((current) =>
        current
          ? { ...current, dx: event.clientX - current.startX, dy: event.clientY - current.startY }
          : current,
      )
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', commit)
    window.addEventListener('pointercancel', commit)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', commit)
      window.removeEventListener('pointercancel', commit)
    }
  }, [drag, commit])

  const nudge = useCallback(
    (id: string, deltaCol: number, deltaRow: number) => {
      const item = settled.find((candidate) => candidate.id === id)
      if (!item) return
      remember(moveItem(settled, id, item.col + deltaCol, item.row + deltaRow, cols), id)
    },
    [settled, cols, remember],
  )

  const byId = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets])

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: cell > 0 ? `${cell}px` : undefined,
          gap: GAP_PX,
          width: layoutWidth > 0 ? layoutWidth : '100%',
        }}
      >
      {landing && (
        <div
          aria-hidden
          className="pointer-events-none rounded-xl border-2 border-dashed border-brand/50 bg-brand/5"
          style={{
            gridColumn: `${landing.col + 1} / span ${landing.w}`,
            gridRow: `${landing.row + 1} / span ${landing.h}`,
          }}
        />
      )}

      {preview.map((item) => {
        const widget = byId.get(item.id)
        if (!widget) return null
        const dragging = drag?.id === item.id
        // The dragged widget stays anchored to the cell it started in and is
        // moved only by the pointer delta. Placing it at its previewed cell as
        // well would add the two displacements together and fling it off the
        // cursor — the drop outline is what shows where it is heading.
        const at = dragging ? (origins.get(item.id) ?? item) : item
        const title = renamed[item.id] ?? widget.title

        return (
          <article
            key={item.id}
            className={cn(
              'group/widget flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface',
              dragging
                ? 'z-raised border-brand/40 shadow-xl'
                : 'border-line/40 shadow-md transition-shadow duration-fast hover:shadow-lg',
            )}
            style={{
              gridColumn: `${at.col + 1} / span ${at.w}`,
              gridRow: `${at.row + 1} / span ${at.h}`,
              transform: dragging
                ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.02)`
                : undefined,
              willChange: dragging ? 'transform' : undefined,
            }}
          >
            <header
              className={cn(
                'flex shrink-0 touch-none select-none items-center gap-1.5 px-3 py-2',
                'border-b border-line/40',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
                widget.fromAgent && 'text-agent',
              )}
              onPointerDown={(event) => {
                event.preventDefault()
                setDrag({
                  id: item.id,
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  dx: 0,
                  dy: 0,
                })
              }}
            >
              <button
                type="button"
                aria-label={t('operation.generated.moveWidget', { title })}
                className={cn(
                  '-ml-1 shrink-0 rounded-xs p-0.5 text-fg-subtle',
                  'hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
                onKeyDown={(event) => {
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  }
                  const delta = moves[event.key]
                  if (!delta) return
                  event.preventDefault()
                  nudge(item.id, delta[0], delta[1])
                }}
              >
                <GripVertical className="size-3.5" aria-hidden />
              </button>

              {editing === item.id ? (
                <input
                  autoFocus
                  defaultValue={title}
                  aria-label={t('operation.generated.widgetName')}
                  className={cn(
                    'min-w-0 flex-1 select-text rounded-xs bg-surface-sunken px-1 py-0.5',
                    'text-xs font-medium text-fg outline-2 outline-ring',
                  )}
                  // The header starts a drag on pointerdown and preventDefault()s
                  // it, which would stop the input from ever taking focus.
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    // Unmounting the input cancels outright: blurring it instead
                    // would run onBlur and save the very edit being discarded.
                    if (event.key === 'Escape') setEditing(null)
                  }}
                  onBlur={(event) => rename(item.id, event.currentTarget.value)}
                />
              ) : (
                <>
                  <h3 className="min-w-0 flex-1 truncate text-xs font-medium">{title}</h3>

                  <button
                    type="button"
                    title={t('operation.generated.renameWidget')}
                    aria-label={t('operation.generated.renameWidget')}
                    className={cn(
                      '-mr-1 shrink-0 rounded-xs p-1 text-fg-subtle opacity-0 transition-opacity',
                      'hover:bg-surface-hover hover:text-fg',
                      'group-hover/widget:opacity-100 focus-visible:opacity-100',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                    )}
                    // Without this the header would start a drag instead of
                    // letting the click through to the button.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setEditing(item.id)}
                  >
                    <Pencil className="size-3" aria-hidden />
                  </button>
                </>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-3">{widget.body}</div>
          </article>
        )
        })}
      </div>
    </div>
  )
}
