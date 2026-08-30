import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { queryKeys } from '@/api/endpoints'
import { Skeleton } from '@/components/ui/Skeleton'
import { useOperationEvents } from '@/hooks'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import type { Operation } from '@/schemas'
import {
  DEFAULT_SECTIONS,
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  isOpen,
  useRailStore,
} from '@/stores/railStore'
import { AgentChat } from './AgentChat'
import { OperationFiles } from './OperationFiles'
import { RailItem } from './RailItem'
import { RailSection } from './RailSection'

/**
 * The right-hand panel: talking to the agent on top, every other operation
 * below.
 *
 * It is a column, never an overlay — it shares the row with the content and
 * pushes it, the way the sidebar does. A panel that floats on top hides the
 * very thing you opened it beside, which defeats keeping the other operations
 * in view while you work on this one.
 *
 * It sits on the RIGHT because on the left it competed with the menu: two
 * navigation columns side by side make you choose which one to read. With the
 * content between them, the menu answers "where can I go" and this answers
 * "what else is happening".
 *
 * The ones waiting on a person come FIRST. If the agent is blocked waiting for
 * someone, that cannot end up below the scroll.
 */

interface OperationsRailProps {
  operations: Operation[]
  activeTrackId: string | undefined
  loading?: boolean
  open: boolean
}

export function OperationsRail({
  operations,
  activeTrackId,
  loading,
  open,
}: OperationsRailProps) {
  const { t } = useTranslation('domain')
  const queryClient = useQueryClient()
  const width = useRailStore((state) => state.width)
  const setWidth = useRailStore((state) => state.setWidth)
  const [resizing, setResizing] = useState(false)
  const sections = useRailStore((state) => state.sections)
  const toggleSection = useRailStore((state) => state.toggleSection)

  const onOperationEvent = useCallback(
    (eventName: 'component-created' | 'component-updated') => {
      toast.info(
        eventName === 'component-created'
          ? t('operation.events.componentCreated')
          : t('operation.events.componentUpdated'),
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.components(activeTrackId ?? '', 4),
      })
    },
    [t, queryClient, activeTrackId],
  )
  useOperationEvents(activeTrackId ?? '', onOperationEvent)

  // La operación abierta ya está en la lista que el riel recibe, así que esto
  // es una lectura de lo que tiene en la mano — no una consulta más.
  const active = useMemo(
    () => operations.find((operation) => operation.trackId === activeTrackId),
    [operations, activeTrackId],
  )
  const documents = active?.documents ?? []

  const sorted = useMemo(() => {
    const waiting = (operation: Operation) => (operation.health === 'critical' ? 0 : 1)
    // Copy before sorting: `operations` comes from the React Query cache and
    // sorting it in place corrupts what every other consumer sees.
    return [...operations].sort(
      (a, b) => waiting(a) - waiting(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )
  }, [operations])

  const alerts = operations.filter(
    (operation) => operation.trackId !== activeTrackId && operation.health === 'critical',
  ).length

  if (!open) return null

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col bg-canvas',
        // `relative` anchors the resize handle sitting on the leading edge.
        'relative',
        // A hard edge, not a hairline: this is where the generated canvas ends
        // and the app's own chrome begins, and the two must not read as one
        // surface.
        'border-l-2 border-line-strong shadow-[-8px_0_24px_-12px_rgb(0_0_0/0.18)]',
        resizing && 'select-none',
      )}
      style={{ width }}
      aria-label={t('operation.rail.panel')}
    >
      <ResizeHandle
        width={width}
        onResize={setWidth}
        onResizingChange={setResizing}
        label={t('operation.rail.resize')}
      />

      <RailSection
        title={t('operation.chat.title')}
        open={isOpen(sections, 'chat', DEFAULT_SECTIONS.chat)}
        onToggle={() => toggleSection('chat')}
        weight={2}
      >
        <AgentChat operationId={activeTrackId ?? ''} className="min-h-0 flex-1" />
      </RailSection>

      <RailSection
        title={t('operation.files.title')}
        open={isOpen(sections, 'files', DEFAULT_SECTIONS.files)}
        onToggle={() => toggleSection('files')}
        badge={documents.length}
        weight={2}
      >
        <OperationFiles operation={active} documents={documents} className="min-h-0 flex-1" />
      </RailSection>

      <RailSection
        title={t('operation.rail.title')}
        open={isOpen(sections, 'operations', DEFAULT_SECTIONS.operations)}
        onToggle={() => toggleSection('operations')}
        badge={alerts}
        weight={1}
      >
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {loading && operations.length === 0
            ? Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="rounded-md p-3">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="mt-2 h-2.5 w-1/3" />
                </li>
              ))
            : sorted.map((operation) => (
                <li key={operation.trackId}>
                  <RailItem operation={operation} active={operation.trackId === activeTrackId} />
                </li>
              ))}
        </ul>
      </RailSection>

    </aside>
  )
}

/**
 * Drag strip on the panel's leading edge.
 *
 * Two elements wide visually but with a fat invisible hit area: a 2px target is
 * unhittable. It reports drag start and end so the panel can suppress text
 * selection for the duration — without that, dragging highlights the chat.
 */
function ResizeHandle({
  width,
  onResize,
  onResizingChange,
  label,
}: {
  width: number
  onResize: (width: number) => void
  onResizingChange: (resizing: boolean) => void
  label: string
}) {
  const [origin, setOrigin] = useState<{ x: number; width: number } | null>(null)

  const stop = useCallback(() => {
    setOrigin(null)
    onResizingChange(false)
  }, [onResizingChange])

  useEffect(() => {
    if (!origin) return
    // The panel is on the right, so dragging LEFT makes it wider: the delta is
    // subtracted, not added.
    const onMove = (event: PointerEvent) =>
      onResize(origin.width - (event.clientX - origin.x))
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [origin, onResize, stop])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={RAIL_MIN_WIDTH}
      aria-valuemax={RAIL_MAX_WIDTH}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault()
        setOrigin({ x: event.clientX, width })
        onResizingChange(true)
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 48 : 16
        if (event.key === 'ArrowLeft') onResize(width + step)
        else if (event.key === 'ArrowRight') onResize(width - step)
        else return
        event.preventDefault()
      }}
      className={cn(
        'absolute inset-y-0 -left-1 z-raised w-2 cursor-col-resize touch-none',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2',
        'after:bg-brand after:opacity-0 after:transition-opacity',
        'hover:after:opacity-100 focus-visible:after:opacity-100 focus-visible:outline-none',
      )}
    />
  )
}
