import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { Operation } from '@/schemas'

export type DataRow = Record<string, unknown>
export type Datasets = Record<string, DataRow[]>

interface GeneratedData {
  operation?: Operation
  datasets: Datasets
}

const DataCtx = createContext<GeneratedData>({ datasets: {} })

/**
 * Everything the generated parts can draw from.
 *
 * Two sources, resolved by name:
 *
 *   the operation   what the backend already knows — bookings, containers,
 *                   documents, schedule changes. Named slices of it are
 *                   available without the agent shipping a single row.
 *   datasets        rows the agent computed itself, for anything the operation
 *                   does not already hold.
 *
 * A part asks for a name and gets rows. It never learns which of the two
 * answered, so moving a series from one to the other changes nothing here.
 */
export function ComponentDataProvider({
  operation,
  datasets = {},
  children,
}: {
  operation?: Operation
  datasets?: Datasets
  children: ReactNode
}) {
  const value = useMemo(() => ({ operation, datasets }), [operation, datasets])
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

/**
 * The slices of an operation a node can name. Adding one is an entry here, and
 * the agent can use it the same day — no part changes.
 */
const SLICES: Record<string, (operation: Operation) => DataRow[]> = {
  containers: (operation) =>
    operation.bookings.flatMap((booking) =>
      booking.containers.map((container) => ({
        id: container.containerNumber,
        state: container.state,
        vessel: booking.vessel,
        carrier: booking.carrier,
      })),
    ),

  bookings: (operation) =>
    operation.bookings.map((booking) => ({
      id: booking.id,
      carrier: booking.carrier,
      vessel: booking.vessel,
      origin: booking.originPort,
      destination: booking.destinationPort,
      containers: booking.containers.length,
    })),

  documents: (operation) =>
    operation.documents.map((document) => ({
      id: document.id,
      name: document.type,
      type: document.type,
      received: document.receivedAt.slice(0, 10),
      value: 1,
    })),

  /** Container counts by state — what a breakdown or a category chart wants. */
  'containers-by-state': (operation) => {
    const counts = new Map<string, number>()
    for (const booking of operation.bookings) {
      for (const container of booking.containers) {
        counts.set(container.state, (counts.get(container.state) ?? 0) + 1)
      }
    }
    return [...counts].map(([name, value]) => ({ name, x: name, value, count: value }))
  },

  /**
   * Every ETA move the agent recorded, oldest first: the delay story.
   * `value` is days late versus the booking's original ETA as of that
   * change — a flat "1 per change" line says nothing about how bad the
   * slip actually got; this one climbs (or drops) with it.
   */
  'schedule-changes': (operation) =>
    operation.bookings
      .flatMap((booking) =>
        booking.schedule.changes.map((change) => {
          const daysLate = Math.round(
            (Date.parse(change.newEta) - Date.parse(booking.schedule.etaOriginal)) / 86_400_000,
          )
          return {
            x: change.occurredAt.slice(0, 10),
            at: change.occurredAt,
            text: change.reason,
            value: daysLate,
            booking: booking.id,
          }
        }),
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),

  /**
   * One row per booking that has a reported position — a booking nobody has
   * tracked yet is absent, not a row with empty coordinates.
   */
  'vessel-positions': (operation) =>
    operation.bookings.flatMap((booking) =>
      booking.vesselPosition
        ? [
            {
              bookingId: booking.id,
              vessel: booking.vessel,
              carrier: booking.carrier,
              lat: booking.vesselPosition.lat,
              lng: booking.vesselPosition.lng,
              updatedAt: booking.vesselPosition.updatedAt,
            },
          ]
        : [],
    ),
}

export function useOperation(): Operation | undefined {
  return useContext(DataCtx).operation
}

/**
 * Rows for a name: an explicit dataset first, then a slice of the operation.
 *
 * Datasets win so the agent can override a slice for one widget without
 * touching the others. A name that matches neither returns undefined, and the
 * charts already render their empty state for that — an invented key degrades
 * to "no data", never to a crash.
 */
export function useDataset(name: string | undefined): DataRow[] | undefined {
  const { operation, datasets } = useContext(DataCtx)

  return useMemo(() => {
    if (!name) return undefined
    if (datasets[name]) return datasets[name]
    const slice = SLICES[name]
    return operation && slice ? slice(operation) : undefined
  }, [name, datasets, operation])
}

/** Named slices the agent may reference. Handy for prompting and for docs. */
export const DATA_SLICE_NAMES = Object.keys(SLICES)
