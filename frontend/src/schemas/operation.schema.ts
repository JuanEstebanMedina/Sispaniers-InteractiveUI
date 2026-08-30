import { z } from 'zod'

import { idSchema, isoDateSchema } from './common.schema'

/**
 * OPERACIÓN LOGÍSTICA — contrato real del backend + modelo de vista
 *
 * El backend llama "flow" a lo que la UI llama "operación", y responde el
 * nivel superior en snake_case mientras que `bookings` y `documents` viajan en
 * camelCase, tal como salen del dominio. Este archivo hace dos cosas:
 *
 *   1. PARSEA el contrato tal cual llega (`flowSchema`), sin maquillarlo.
 *   2. Lo TRANSFORMA a un modelo de vista plano (`Operation`), que es lo que
 *      consumen la tarjeta, el riel y el detalle.
 *
 * La transformación vive acá y no en los componentes a propósito: si mañana el
 * backend renombra `client_id` o mueve la ETA de sitio, se toca este archivo y
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

const documentSchema = z.object({
  id: idSchema,
  type: z.string(),
  bookingId: z.string().optional(),
  sourceEmailId: z.string().optional(),
  extractedData: z.record(z.string(), z.unknown()).default({}),
  receivedAt: isoDateSchema,
})

export type LogisticsDocument = z.infer<typeof documentSchema>

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
  clientId: string
  /** Nombre legible derivado del id — ver `clientName`. */
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

/**
 * Nombre legible a partir del id del cliente.
 *
 *   `client-andes-textiles` → `Andes Textiles`
 *
 * ⚠️ ES UN PARCHE, no una solución. El backend expone `client_id` pero no hay
 * endpoint de clientes, y el dominio SÍ tiene `Client { name }`. En cuanto
 * exista `GET /api/clients` esta función se borra y se usa el nombre real: un
 * id troceado no es un nombre, y con un cliente cuyo id no siga la convención
 * se va a ver mal.
 */
export function clientName(clientId: string): string {
  return (
    clientId
      .replace(/^client[-_]/, '')
      .split(/[-_]/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || clientId
  )
}

/** El cambio de ETA más reciente de toda la operación, si lo hubo. */
function latestScheduleChange(bookings: Booking[]): ScheduleChange | null {
  const changes = bookings.flatMap((booking) => booking.schedule.changes)
  if (changes.length === 0) return null

  return changes.reduce((latest, change) =>
    Date.parse(change.occurredAt) > Date.parse(latest.occurredAt) ? change : latest,
  )
}

export const flowSchema = z
  .object({
    id: idSchema,
    client_id: z.string(),
    status: z.string(),
    health: z.enum(BACKEND_HEALTH).catch('ok'),
    created_at: isoDateSchema,
    bookings: z.array(bookingSchema).default([]),
    documents: z.array(documentSchema).default([]),
  })
  .transform((flow): Operation => {
    const [first] = flow.bookings
    const change = latestScheduleChange(flow.bookings)

    return {
      trackId: flow.id,
      clientId: flow.client_id,
      shipper: clientName(flow.client_id),
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
      documents: flow.documents,
    }
  })

/** `GET /api/flows` responde `{ flows: [...] }` — sin paginación. */
export const flowListSchema = z.object({ flows: z.array(flowSchema) })
export type FlowList = z.infer<typeof flowListSchema>
