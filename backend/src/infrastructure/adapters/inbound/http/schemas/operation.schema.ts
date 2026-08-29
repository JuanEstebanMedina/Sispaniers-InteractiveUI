import { z } from "zod";
import { CONTAINER_STATES } from "../../../../../domain/logistics/operation.js";

const containerStateSchema = z.enum(CONTAINER_STATES);

const containerSchema = z.object({
  id: z.string(),
  containerNumber: z.string(),
  state: containerStateSchema,
});

const scheduleSchema = z.object({
  etdOriginal: z.date(),
  etaOriginal: z.date(),
  etaCurrent: z.date(),
  changes: z.array(
    z.object({
      previousEta: z.date(),
      newEta: z.date(),
      reason: z.string(),
      occurredAt: z.date(),
    }),
  ),
});

const bookingSchema = z.object({
  id: z.string(),
  status: containerStateSchema,
  carrier: z.string(),
  vessel: z.string(),
  originPort: z.string(),
  destinationPort: z.string(),
  schedule: scheduleSchema,
  vesselPosition: z.object({ lat: z.number(), lng: z.number(), updatedAt: z.date() }).optional(),
  containers: z.array(containerSchema),
});

const documentSchema = z.object({
  id: z.string(),
  type: z.string(),
  bookingId: z.string().optional(),
  sourceEmailId: z.string().optional(),
  extractedData: z.record(z.unknown()),
  receivedAt: z.date(),
});

export const listOperationsResponseSchema = z.object({
  operations: z.array(
    z.object({
      id: z.string(),
      clientId: z.string(),
      status: containerStateSchema,
      bookings: z.array(bookingSchema),
      documents: z.array(documentSchema),
      createdAt: z.date(),
    }),
  ),
});
