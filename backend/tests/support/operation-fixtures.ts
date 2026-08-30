import { randomUUID } from "node:crypto";
import type { Company } from "../../src/domain/logistics/company.js";
import type { Operation } from "../../src/domain/logistics/operation.js";

export function aCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: randomUUID(),
    name: "Andes Textiles",
    contactEmails: ["logistics@andestextiles.co"],
    preferredNotificationChannel: "email",
    active: true,
    ...overrides,
  };
}

export function anOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: randomUUID(),
    bookings: [
      {
        id: randomUUID(),
        companyIds: [randomUUID()],
        carrier: "Maersk",
        vessel: "Ever Given",
        originPort: "CNSHA",
        destinationPort: "COCTG",
        schedule: {
          etdOriginal: new Date("2026-01-05T00:00:00.000Z"),
          etaOriginal: new Date("2026-02-10T00:00:00.000Z"),
          etaCurrent: new Date("2026-02-14T00:00:00.000Z"),
          changes: [
            {
              previousEta: new Date("2026-02-10T00:00:00.000Z"),
              newEta: new Date("2026-02-14T00:00:00.000Z"),
              reason: "port congestion",
              occurredAt: new Date("2026-01-20T09:30:00.000Z"),
            },
          ],
        },
        vesselPosition: {
          lat: 12.5,
          lng: -74.2,
          updatedAt: new Date("2026-01-25T12:00:00.000Z"),
        },
        containers: [{ id: randomUUID(), containerNumber: "MSKU1234567", state: "in_transit" }],
      },
    ],
    context: {
      emails: [
        {
          source: "make",
          messageId: "email-1",
          from: "bookings@maersk.com",
          subject: "Bill of Lading",
          receivedAt: new Date("2026-01-06T07:45:00.000Z"),
          bodyText: "Attached you will find the BL.",
        },
      ],
      documents: [
        {
          id: randomUUID(),
          type: "BillOfLading",
          format: "pdf",
          bucketKey: "operations/op-1/bl-001.pdf",
          bookingId: randomUUID(),
          sourceEmailId: "email-1",
          extractedData: { weightKg: 18500 },
          receivedAt: new Date("2026-01-06T08:00:00.000Z"),
        },
      ],
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function withAllContainersDelivered(operation: Operation): Operation {
  return {
    ...operation,
    bookings: operation.bookings.map((booking) => ({
      ...booking,
      containers: booking.containers.map((container) => ({
        ...container,
        state: "delivered" as const,
      })),
    })),
  };
}

export function withoutContainers(operation: Operation): Operation {
  return {
    ...operation,
    bookings: operation.bookings.map((booking) => ({ ...booking, containers: [] })),
  };
}
