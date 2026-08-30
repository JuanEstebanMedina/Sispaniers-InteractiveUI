import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api$ } from '@/api/client'
import { endpoints, queryKeys } from '@/api/endpoints'
import { companyListSchema } from '@/schemas'

/**
 * Company id → name, for screens that only have `Operation.companyIds` and
 * need something readable to show. Backed by `GET /api/companies`, which
 * every operation-listing screen ends up calling anyway — React Query dedupes
 * it into one request no matter how many components call this hook.
 */
export function useCompanyDirectory(): Record<string, string> {
  const companies = useQuery({
    queryKey: queryKeys.companies.list(),
    queryFn: () => api$.get(endpoints.companies.list, companyListSchema),
    staleTime: 5 * 60_000,
  })

  return useMemo(() => {
    const byId: Record<string, string> = {}
    for (const company of companies.data?.companies ?? []) {
      byId[company.id] = company.name
    }
    return byId
  }, [companies.data])
}
