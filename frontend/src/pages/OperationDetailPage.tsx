import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { normalizeError } from '@/api/errors'
import { SectionBoundary } from '@/components/feedback/ErrorBoundary'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ComponentDataProvider } from '@/components/generated/ComponentData'
import type { Widget } from '@/components/generated/WidgetGrid'
import { WidgetGrid } from '@/components/generated/WidgetGrid'
import { toWidgets } from '@/components/generated/toWidgets'
import { GeneratedSurface } from '@/components/operations/GeneratedSurface'
import { OperationDetailHeader } from '@/components/operations/OperationDetailHeader'
import { ConfirmModal } from '@/components/ui/Modal'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { useOperationEvents } from '@/hooks'
import type { ComponentPendingEvent, OperationEventName } from '@/hooks/useOperationEvents'
import { WIDGET_SIZES } from '@/lib/grid'
import { toast } from '@/lib/toast'
import {
  type ComponentsResponse,
  componentsResponseSchema,
  companyConceptsResponseSchema,
  operationListSchema,
  operationResponseSchema,
  type GeneratedComponent,
  type Operation,
} from '@/schemas'
import { needsAttention } from '@/lib/operation'
import { useChatReferenceStore } from '@/stores/chatReferenceStore'
import { useRailStore } from '@/stores/railStore'

const DEFAULT_COLS = 4

function conceptIdsFrom(nodes: Array<{ props: Record<string, unknown>; children?: unknown[] }>): string[] {
  return nodes.flatMap((node) => {
    const dataKey = node.props.dataKey
    const id = typeof dataKey === 'string' && dataKey.startsWith('concept:') ? dataKey.slice(8) : ''
    const children = Array.isArray(node.children)
      ? conceptIdsFrom(node.children as Array<{ props: Record<string, unknown>; children?: unknown[] }>)
      : []
    return id ? [id, ...children] : children
  })
}

const PENDING_TIMEOUT_MS = 45_000

export default function OperationDetailPage() {
  const { t } = useTranslation('domain')
  const { trackId } = useParams({ from: '/app/operations/$trackId' })
  const queryClient = useQueryClient()

  const detail = useQuery({
    queryKey: queryKeys.operations.detail(trackId),
    queryFn: () => api$.get(endpoints.operations.detail(trackId), operationResponseSchema),
  })

  const [cols, setCols] = useState(DEFAULT_COLS)

  const components = useQuery({
    queryKey: queryKeys.operations.components(trackId, cols),
    queryFn: () =>
      api$.get(
        `${endpoints.operations.components(trackId)}?cols=${cols}`,
        componentsResponseSchema,
      ),
  })

  const inFlight = useRef<Promise<unknown>>(Promise.resolve())

  const savePlacement = useMutation({
    mutationFn: ({ id, ...body }: { id: string; position?: number; title?: string }) => {
      const sent = inFlight.current.then(() =>
        api.patch(endpoints.operations.componentPlacement(trackId, id), body),
      )
      inFlight.current = sent.catch(() => undefined)
      return sent
    },
  })

  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const removeComponent = useMutation({
    mutationFn: (id: string) => {
      const sent = inFlight.current.then(() =>
        api.delete(endpoints.operations.componentRemove(trackId, id)),
      )
      inFlight.current = sent.catch(() => undefined)
      return sent
    },
    onSuccess: (_result, id) => {
      setPendingDelete(null)
      queryClient.setQueriesData<ComponentsResponse>(
        { queryKey: queryKeys.operations.componentsAll(trackId) },
        (cached) =>
          cached && {
            components: cached.components.filter((component) => component.id !== id),
            layout: cached.layout.filter((entry) => entry.id !== id),
          },
      )
      void queryClient.invalidateQueries({
        queryKey: queryKeys.operations.componentsAll(trackId),
      })
    },
    onError: (error) => {
      setPendingDelete(null)
      toast.error(t('operation.generated.deleteError'), {
        description: normalizeError(error).message,
      })
    },
  })

  const others = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () => api$.post(endpoints.operations.search, operationListSchema, {}),
  })
  const waiting = (others.data?.operations ?? []).filter(
    (operation) => operation.trackId !== trackId && needsAttention(operation),
  ).length

  const railOpen = useRailStore((state) => state.open)
  const railWidth = useRailStore((state) => state.width)
  const setRailOpen = useRailStore((state) => state.setOpen)
  const openSection = useRailStore((state) => state.openSection)
  const addReference = useChatReferenceStore((state) => state.reference)

  const operation = detail.data
  const generated = components.data
  const conceptIds = useMemo(
    () => [...new Set((generated?.components ?? []).flatMap((component) => conceptIdsFrom(component.content)))],
    [generated],
  )
  const companyConcepts = useQuery({
    queryKey: queryKeys.operations.companyConcepts(trackId, conceptIds),
    queryFn: () =>
      api$.get(
        endpoints.operations.companyConcepts(trackId, conceptIds),
        companyConceptsResponseSchema,
      ),
    enabled: conceptIds.length > 0,
  })
  const datasets = useMemo(
    () =>
      Object.fromEntries(
        (companyConcepts.data?.concepts ?? []).map((concept) => [`concept:${concept.id}`, concept.values]),
      ),
    [companyConcepts.data],
  )

  const [pending, setPending] = useState<ComponentPendingEvent[]>([])

  const onOperationEvent = useCallback(
    (event: OperationEventName, payload: unknown) => {
      if (event === 'component-pending') {
        const pendingEvent = payload as ComponentPendingEvent | null
        if (!pendingEvent) return
        setPending((current) => [...current, pendingEvent])
        return
      }

      if (event === 'component-pending-cleared') {
        // The AI answered in plain text this turn — no component is coming,
        // so nothing will ever replace the oldest placeholder. Drop it now
        // instead of leaving it on screen until its timeout.
        setPending((current) => current.slice(1))
        return
      }

      if (event === 'component-created' || event === 'component-updated') {
        setPending((current) => current.slice(1))
        const component = payload as GeneratedComponent | null
        if (!component) return
        queryClient.setQueriesData<ComponentsResponse>(
          { queryKey: queryKeys.operations.componentsAll(trackId) },
          (cached) => {
            if (!cached) return cached
            const exists = cached.components.some(({ id }) => id === component.id)
            return {
              components: exists
                ? cached.components.map((current) => (current.id === component.id ? component : current))
                : [...cached.components, component],
              layout: cached.layout.some(({ id }) => id === component.id)
                ? cached.layout
                : [
                    ...cached.layout,
                    { id: component.id, col: 0, row: 0, ...WIDGET_SIZES[component.size] },
                  ],
            }
          },
        )
        // A move renumbers every sibling and a resize changes grid footprints.
        // The event only carries one component, so fetch packed layout again.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.operations.componentsAll(trackId),
        })
        return
      }

      const nextOperation = payload as Operation | null
      if (nextOperation) {
        queryClient.setQueryData(queryKeys.operations.detail(trackId), nextOperation)
        // Not queryKeys.operations.list() — that key carries an empty {} body,
        // which only matches list queries with no filters. listAll is the bare
        // ['operations','list'] prefix, so every filtered/sorted grid still
        // gets the update instead of needing a reload to see it.
        void queryClient.invalidateQueries({ queryKey: queryKeys.operations.listAll })
      }
    },
    [queryClient, trackId],
  )
  const stream = useOperationEvents(trackId, onOperationEvent)

  useEffect(() => {
    if (pending.length === 0) return
    const timers = pending.map(({ tempId }) =>
      setTimeout(() => {
        setPending((current) => current.filter((item) => item.tempId !== tempId))
      }, PENDING_TIMEOUT_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [pending])

  const pendingWidgets = useMemo<Widget[]>(
    () =>
      pending.map(({ tempId, estimatedSize }) => ({
        id: `pending-${tempId}`,
        ...WIDGET_SIZES[estimatedSize],
        col: 0,
        row: 0,
        title: t('operation.generated.pendingTitle'),
        fromAgent: true,
        body: <SkeletonText lines={2} />,
      })),
    [pending, t],
  )

  const dropComponent = removeComponent.mutate

  const widgets = useMemo(() => {
    const base = generated ? toWidgets(generated.components, generated.layout, dropComponent) : []
    return [...base, ...pendingWidgets]
  }, [generated, pendingWidgets, dropComponent])

  const persist = savePlacement.mutate
  const persistable = (generated?.components.length ?? 0) > 0

  const handleMove = useCallback(
    (id: string, position: number) => {
      if (persistable) persist({ id, position })
    },
    [persist, persistable],
  )

  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      if (persistable) persist({ id, title })
    },
    [persist, persistable],
  )

  const handleDeleteRequest = useMemo(
    () => (persistable ? setPendingDelete : undefined),
    [persistable],
  )

  // Pointing at a widget is only half the gesture: the other half is the chat
  // the reference lands in, so it comes into view with it.
  const handleReferenceRequest = useCallback(
    (id: string) => {
      const widget = widgets.find((item) => item.id === id)
      if (!widget) return
      addReference(trackId, { id, title: widget.title })
      setRailOpen(true)
      openSection('chat')
    },
    [widgets, addReference, trackId, setRailOpen, openSection],
  )

  const pendingTitle = widgets.find((widget) => widget.id === pendingDelete)?.title ?? ''

  return (
    <div className="flex h-dvh flex-col gap-3 px-2 py-4 sm:px-4">
      {detail.isSuccess && (
        <OperationDetailHeader operation={detail.data} waiting={waiting} stream={stream} />
      )}

      {detail.isPending && (
        <div className="grid grid-cols-4 gap-3">
          <Skeleton className="col-span-4 h-64 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
          <Skeleton className="col-span-2 h-32 rounded-xl" />
        </div>
      )}

      {detail.isError && <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />}

      {detail.isSuccess && components.isError && (
        <ErrorState error={components.error} onRetry={() => void components.refetch()} />
      )}

      {detail.isSuccess && !components.isError && (
        <GeneratedSurface className="flex-1">
          <SectionBoundary name="generated-ui">
            <ComponentDataProvider operation={operation} datasets={datasets}>
              <WidgetGrid
                widgets={widgets}
                onMove={handleMove}
                onTitleChange={handleTitleChange}
                onColsChange={setCols}
                onDeleteRequest={handleDeleteRequest}
                onReferenceRequest={handleReferenceRequest}
                reserve={railOpen ? railWidth : 0}
              />
            </ComponentDataProvider>
          </SectionBoundary>
        </GeneratedSurface>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeComponent.mutate(pendingDelete)
        }}
        title={t('operation.generated.deleteTitle')}
        message={t('operation.generated.deleteMessage', { title: pendingTitle })}
        confirmLabel={t('operation.generated.deleteConfirm')}
        loading={removeComponent.isPending}
      />
    </div>
  )
}
