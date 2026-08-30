import { z } from 'zod'

import { sortDirectionSchema } from './common.schema'

export const listSearchSchema = z.object({
  q: z.string().optional(),

  page: z.coerce.number().int().positive().catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),

  sort: z.string().optional(),
  order: sortDirectionSchema.catch('desc').default('desc'),
})

export type ListSearch = z.infer<typeof listSearchSchema>

// Every field carries `.catch()`: junk in the URL degrades to "no filter"
// rather than throwing on a link somebody pasted into Slack.
export const operationsSearchSchema = z.object({
  q: z.string().optional(),
  status: z.string().catch('all').optional(),
  health: z.string().catch('all').optional(),
  sort: z.string().catch('updatedAt').optional(),
  order: sortDirectionSchema.catch('desc').optional(),
})

export const OPERATIONS_SEARCH_DEFAULTS = {
  status: 'all',
  health: 'all',
  sort: 'updatedAt',
  order: 'desc',
} as const

export function resolveOperationsSearch(search: OperationsSearch) {
  return {
    q: search.q ?? '',
    status: search.status ?? OPERATIONS_SEARCH_DEFAULTS.status,
    health: search.health ?? OPERATIONS_SEARCH_DEFAULTS.health,
    sort: search.sort ?? OPERATIONS_SEARCH_DEFAULTS.sort,
    order: search.order ?? OPERATIONS_SEARCH_DEFAULTS.order,
  }
}

export type OperationsSearch = z.infer<typeof operationsSearchSchema>

export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export type LoginSearch = z.infer<typeof loginSearchSchema>

export function stripDefaults<T extends Record<string, unknown>>(
  search: T,
  defaults: Partial<T>,
): Partial<T> {
  const result: Partial<T> = {}

  for (const [key, value] of Object.entries(search) as [keyof T, T[keyof T]][]) {
    if (value === undefined || value === '') continue
    if (defaults[key] !== undefined && value === defaults[key]) continue
    result[key] = value
  }

  return result
}
