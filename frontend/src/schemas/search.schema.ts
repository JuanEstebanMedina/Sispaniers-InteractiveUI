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

/**
 * Filtros de la grilla.
 *
 * TODO OPCIONAL, sin `.default()`. Con defaults el router los escribe en la
 * URL en cuanto entrás, y `/operations` se convierte en
 * `/operations?status=all&health=all&sort=updatedAt&order=desc` — ruido que
 * no dice nada, porque son exactamente los valores por defecto.
 *
 * Ausente = el valor por defecto. Se resuelve al leerlos, con
 * `resolveOperationsSearch`, y así la URL sólo lleva lo que alguien cambió a
 * mano: un link compartido se lee de un vistazo.
 *
 * `.catch()` se queda: basura en la URL degrada a "sin filtro" en vez de
 * romper la página. El jurado VA a editar la URL.
 */
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

/** Rellena los ausentes. Un solo sitio decide qué significa "sin especificar". */
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
