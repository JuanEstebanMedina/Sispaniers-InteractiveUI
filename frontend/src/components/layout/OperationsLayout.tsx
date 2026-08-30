import { useQuery } from '@tanstack/react-query'
import { Outlet, useParams } from '@tanstack/react-router'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { OperationsRail } from '@/components/operations/OperationsRail'
import { operationListSchema } from '@/schemas'
import { useRailStore } from '@/stores/railStore'

/**
 * Holds the rail so opening an operation keeps the others in view.
 *
 * Inside `OperationDetailPage` the rail would unmount on every click and lose
 * its scroll. As a layout route, the router only swaps the child.
 */
export default function OperationsLayout() {
  // `strict: false` because this layout also mounts on the index route, where
  // there is no trackId.
  const { trackId } = useParams({ strict: false }) as { trackId?: string }
  const hasDetail = Boolean(trackId)

  const railOpen = useRailStore((state) => state.open)

  const list = useQuery({
    queryKey: queryKeys.operations.list(),
    queryFn: () =>
      api$.post(endpoints.operations.search, operationListSchema, {}),
    // Only with a detail open. This layout still mounts on the grid, where the
    // rail is not rendered — without this the whole list downloads in parallel
    // with the search that actually feeds the grid, to show nothing.
    enabled: hasDetail,
    refetchOnWindowFocus: true,
  })

  const operations = list.data?.operations ?? []

  return (
    <div className="flex min-h-dvh">
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>

      {hasDetail && (
        <OperationsRail
          operations={operations}
          activeTrackId={trackId}
          loading={list.isPending}
          open={railOpen}
        />
      )}
    </div>
  )
}
