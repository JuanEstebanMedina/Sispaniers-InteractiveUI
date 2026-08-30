import { z } from 'zod'

import { idSchema, isoDateSchema } from './common.schema'

/**
 * OPERACIÓN LOGÍSTICA — contrato real del backend + modelo de vista
 *
 * El backend responde el nivel superior en snake_case mientras que `bookings` y `documents` viajan en
 * camelCase, tal como salen del dominio. Este archivo hace dos cosas:
 *
 *   1. PARSEA el contrato tal cual llega (`operationResponseSchema`), sin maquillarlo.
 *   2. Lo TRANSFORMA a un modelo de vista plano (`Operation`), que es lo que
 *      consumen la tarjeta, el riel y el detalle.
 *
 * La transformación vive acá y no en los componentes a propósito: si mañana el
 * backend renombra un campo o mueve la ETA de sitio, se toca este archivo y
 * ninguno de los componentes que muestran operaciones.
 *
 * DOS EJES DE COLOR. `status` responde «¿en qué punto va?» y `health` «¿va
 * bien?». Una operación puede estar `in_transit` y `critical` a la vez: viaja,
 * pero llega tarde. Colapsarlos obliga a inventar estados como "en tránsito
 * con retraso" y la lista crece sin fondo.
 */

/* ---------------------------------------------------------------------------
 * CONTRATO DEL BACKEND
 * ------------------------------------------------------------------------ */

/**
 * Estados de contenedor. El status de la operación se DERIVA del contenedor
 * menos avanzado (ver `deriveOperationStatus` en el backend), así que sólo
 * puede ser uno de estos cinco.
 */
export const CONTAINER_STATES = [
  'booking_confirmed',
  'in_transit',
  'arrived_port',
  'customs',
  'delivered',
] as const

export type ContainerState = (typeof CONTAINER_STATES)[number]

export const BACKEND_HEALTH = ['ok', 'warning', 'error'] as const
export type BackendHealth = (typeof BACKEND_HEALTH)[number]

const scheduleChangeSchema = z.object({
  previousEta: isoDateSchema,
  newEta: isoDateSchema,
  reason: z.string(),
  occurredAt: isoDateSchema,
})

export type ScheduleChange = z.infer<typeof scheduleChangeSchema>

const containerSchema = z.object({
  id: idSchema,
  containerNumber: z.string(),
  // No es enum estricto: si el backend inventa un estado, la tarjeta lo pinta
  // en neutro en vez de quedarse en blanco.
  state: z.string(),
})

export type Container = z.infer<typeof containerSchema>

const bookingSchema = z.object({
  id: idSchema,
  carrier: z.string(),
  vessel: z.string(),
  originPort: z.string(),
  destinationPort: z.string(),
  schedule: z.object({
    etdOriginal: isoDateSchema,
    etaOriginal: isoDateSchema,
    etaCurrent: isoDateSchema,
    changes: z.array(scheduleChangeSchema).default([]),
  }),
  vesselPosition: z
    .object({ lat: z.number(), lng: z.number(), updatedAt: isoDateSchema })
    .optional(),
  containers: z.array(containerSchema).default([]),
})

export type Booking = z.infer<typeof bookingSchema>

/**
 * Formatos que declara el backend. `catch('other')` y no un enum estricto: un
 * formato nuevo debe salir con icono genérico, nunca tumbar la lista entera de
 * archivos de la operación.
 */
export const DOCUMENT_FORMATS = ['pdf', 'spreadsheet', 'document', 'image', 'other'] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

const documentSchema = z.object({
  id: idSchema,
  type: z.string(),
  format: z.enum(DOCUMENT_FORMATS).catch('other'),
  /** Ruta en el bucket. No es una URL: para verlo hay que pedir una firmada. */
  bucketKey: z.string().default(''),
  bookingId: z.string().optional(),
  sourceEmailId: z.string().optional(),
  /** Lo que el agente leyó del documento. Es el valor real del archivo acá. */
  extractedData: z.record(z.string(), z.unknown()).default({}),
  receivedAt: isoDateSchema,
})

export type LogisticsDocument = z.infer<typeof documentSchema>

/** `{ url, expires_in_seconds }` — la firma dura 5 minutos. */
export const documentPreviewSchema = z.object({
  url: z.string(),
  expires_in_seconds: z.number(),
})

/* ---------------------------------------------------------------------------
 * MODELO DE VISTA
 * ------------------------------------------------------------------------ */

export const OPERATION_HEALTH = ['on_track', 'at_risk', 'critical'] as const
export type OperationHealth = (typeof OPERATION_HEALTH)[number]

const HEALTH_FROM_BACKEND: Record<BackendHealth, OperationHealth> = {
  ok: 'on_track',
  warning: 'at_risk',
  error: 'critical',
}

export interface Operation {
  /** El id del backend. Es lo que va en la URL y lo que la gente copia. */
  trackId: string
  /** Una operación puede involucrar a varias empresas (exportador, importador,
   *  agente). La tarjeta muestra la primera. */
  companyIds: string[]
  /**
   * Nombre legible de la primera empresa, o su id crudo si `useCompanyDirectory`
   * (que resuelve contra `GET /api/companies`) todavía no cargó o no la
   * encuentra. Los componentes que lo muestran resuelven el nombre real ahí;
   * esto es sólo el valor de arranque antes de que esa consulta responda.
   */
  shipper: string
  status: string
  health: OperationHealth
  origin: string
  destination: string
  containers: number
  /** ETA vigente de la primera reserva. Null si todavía no hay reservas. */
  eta: string | null
  etd: string | null
  /** Lo más reciente que le pasó: la última ETA movida, o su creación. */
  updatedAt: string
  /** Lo último que cambió, en una línea. Null si nada se movió aún. */
  lastEvent: string | null
  bookings: Booking[]
  documents: LogisticsDocument[]
}

/** El cambio de ETA más reciente de toda la operación, si lo hubo. */
function latestScheduleChange(bookings: Booking[]): ScheduleChange | null {
  const changes = bookings.flatMap((booking) => booking.schedule.changes)
  if (changes.length === 0) return null

  return changes.reduce((latest, change) =>
    Date.parse(change.occurredAt) > Date.parse(latest.occurredAt) ? change : latest,
  )
}

export const operationResponseSchema = z
  .object({
    id: idSchema,
    company_ids: z.array(z.string()).default([]),
    status: z.string(),
    health: z.enum(BACKEND_HEALTH).catch('ok'),
    created_at: isoDateSchema,
    bookings: z.array(bookingSchema).default([]),
    // Los documentos se movieron dentro de `context`, que ahora además trae
    // los correos que originaron la operación.
    context: z
      .object({
        emails: z.array(z.unknown()).default([]),
        documents: z.array(documentSchema).default([]),
      })
      .default({ emails: [], documents: [] }),
  })
  .transform((flow): Operation => {
    const [first] = flow.bookings
    const change = latestScheduleChange(flow.bookings)

    return {
      trackId: flow.id,
      companyIds: flow.company_ids,
      shipper: flow.company_ids[0] ?? '—',
      status: flow.status,
      health: HEALTH_FROM_BACKEND[flow.health],
      origin: first?.originPort ?? '',
      destination: first?.destinationPort ?? '',
      containers: flow.bookings.reduce((total, booking) => total + booking.containers.length, 0),
      eta: first?.schedule.etaCurrent ?? null,
      etd: first?.schedule.etdOriginal ?? null,
      // `created_at` es lo único fechado que manda el backend, pero una
      // operación creada en julio cuya ETA se movió ayer se movió AYER. La
      // grilla ordena por esto: usar la creación mentiría sobre qué cambió
      // mientras no mirabas, que es la pregunta que responde la pantalla.
      updatedAt: change?.occurredAt ?? flow.created_at,
      lastEvent: change ? `ETA movida · ${change.reason}` : null,
      bookings: flow.bookings,
      documents: flow.context.documents,
    }
  })

/** `GET /api/operations` responde `{ operations: [...] }` — sin paginación. */
export const operationListSchema = z.object({
  operations: z.array(operationResponseSchema),
})
export type OperationList = z.infer<typeof operationListSchema>
