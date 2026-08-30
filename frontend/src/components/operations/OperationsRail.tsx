import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/Skeleton'
import { useOperationEvents } from '@/hooks'
import type { OperationEventName } from '@/hooks/useOperationEvents'
import { cn } from '@/lib/cn'
import { needsAttention } from '@/lib/operation'
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
    (eventName: OperationEventName) => {
      if (eventName !== 'component-created' && eventName !== 'component-updated') return
      toast.info(
        eventName === 'component-created'
          ? t('operation.events.componentCreated')
          : t('operation.events.componentUpdated'),
      )
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'operations' &&
          query.queryKey[1] === 'components' &&
          query.queryKey[2] === (activeTrackId ?? ''),
      })
    },
    [t, queryClient, activeTrackId],
  )
  useOperationEvents(activeTrackId ?? '', onOperationEvent)
  const active = useMemo(
    () => operations.find((operation) => operation.trackId === activeTrackId),
    [operations, activeTrackId],
  )
  const documents = active?.documents ?? []

  const sorted = useMemo(() => {
    const waiting = (operation: Operation) => (needsAttention(operation) ? 0 : 1)
    return [...operations].sort(
      (a, b) => waiting(a) - waiting(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )
  }, [operations])

  const alerts = operations.filter(
    (operation) => operation.trackId !== activeTrackId && needsAttention(operation),
  ).length

  if (!open) return null

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col bg-canvas',
        'relative',
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
