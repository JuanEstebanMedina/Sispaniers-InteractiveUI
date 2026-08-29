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

export const operationsSearchSchema = z.object({
  q: z.string().optional(),
  status: z.string().catch('all').default('all'),
  health: z.string().catch('all').default('all'),
  sort: z.string().catch('updatedAt').default('updatedAt'),
  order: sortDirectionSchema.catch('desc').default('desc'),
})

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
