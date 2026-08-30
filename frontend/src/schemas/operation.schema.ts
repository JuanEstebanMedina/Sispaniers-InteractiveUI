import { z } from 'zod'

import { idSchema, isoDateSchema } from './common.schema'

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

// `state` is a loose string, not an enum: a state the backend invents paints
// neutral instead of blanking the card.
const containerSchema = z.object({
  id: idSchema,
  containerNumber: z.string(),
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

export const DOCUMENT_FORMATS = ['pdf', 'spreadsheet', 'document', 'image', 'other'] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

const documentSchema = z.object({
  id: idSchema,
  type: z.string(),
  /** El nombre con el que se subió. Ausente en documentos anteriores al campo. */
  filename: z.string().optional(),
  // A format nobody has seen yet gets the generic icon rather than taking the
  // whole document list down with it.
  format: z.enum(DOCUMENT_FORMATS).catch('other'),
  bucketKey: z.string().default(''),
  bookingId: z.string().optional(),
  sourceEmailId: z.string().optional(),
  extractedData: z.record(z.string(), z.unknown()).default({}),
  receivedAt: isoDateSchema,
})

export type LogisticsDocument = z.infer<typeof documentSchema>

/**
 * Lo que devuelve `POST /operations/:id/documents`.
 *
 * Usa el mismo `documentSchema` que los documentos dentro de una operación: es
 * la misma entidad y el backend la manda igual por los dos caminos.
 */
export const uploadDocumentResponseSchema = z.object({
  document: documentSchema,
  url: z.string(),
  expires_in_seconds: z.number(),
})

export const documentPreviewSchema = z.object({
  url: z.string(),
  expires_in_seconds: z.number(),
})

export const OPERATION_HEALTH = ['on_track', 'at_risk', 'critical'] as const
export type OperationHealth = (typeof OPERATION_HEALTH)[number]

const HEALTH_FROM_BACKEND: Record<BackendHealth, OperationHealth> = {
  ok: 'on_track',
  warning: 'at_risk',
  error: 'critical',
}

export interface Operation {
  trackId: string
  companyIds: string[]
  shipper: string
  status: string
  health: OperationHealth
  origin: string
  destination: string
  containers: number
  eta: string | null
  etd: string | null
  updatedAt: string
  lastEvent: string | null
  bookings: Booking[]
  documents: LogisticsDocument[]
}

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
      // `created_at` is the only date the backend sends, but an operation
      // created in July whose ETA moved yesterday moved YESTERDAY. The grid
      // sorts by this, and creation time would lie about what changed.
      updatedAt: change?.occurredAt ?? flow.created_at,
      lastEvent: change ? `ETA movida · ${change.reason}` : null,
      bookings: flow.bookings,
      documents: flow.context.documents,
    }
  })

export const operationListSchema = z.object({
  operations: z.array(operationResponseSchema),
})
export type OperationList = z.infer<typeof operationListSchema>
