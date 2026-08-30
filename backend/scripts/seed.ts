import { readFileSync } from "node:fs";
import { z } from "zod";
import { CONTAINER_STATES } from "../src/domain/enums/container-state.js";
import { DOCUMENT_FORMATS } from "../src/domain/enums/document-format.js";
import type { Company } from "../src/domain/logistics/company.js";
import type { Document } from "../src/domain/logistics/document.js";
import type { ContextEmail } from "../src/domain/logistics/operation-context.js";
import type { Booking, Operation } from "../src/domain/logistics/operation.js";
import { MongoCompanyRepository } from "../src/infrastructure/adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../src/infrastructure/adapters/outbound/mongo/component.repository.js";
import { MongoOperationRepository } from "../src/infrastructure/adapters/outbound/mongo/operation.repository.js";
import { connectMongo } from "../src/infrastructure/config/mongo.js";
import type { Component } from "../src/domain/components/component.js";

const DATA_FILE = new URL("./seed-data.json", import.meta.url);

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD day")
  .transform((day) => new Date(`${day}T00:00:00.000Z`));

const bookingSeedSchema = z
  .object({
    id: z.string().min(1),
    companyIds: z.array(z.string().min(1)),
    carrier: z.string().min(1),
    vessel: z.string().min(1),
    originPort: z.string().min(1),
    destinationPort: z.string().min(1),
    etd: daySchema,
    eta: daySchema,
    delayedTo: daySchema.optional(),
    delayReason: z.string().min(1).optional(),
    containers: z.array(z.tuple([z.string().min(1), z.enum(CONTAINER_STATES)])),
  })
  .refine(
    (booking) => (booking.delayedTo === undefined) === (booking.delayReason === undefined),
    "delayedTo and delayReason go together",
  );

const emailSeedSchema = z.object({
  source: z.enum(["make", "gmail", "outlook", "manual"]),
  messageId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1).optional(),
  subject: z.string().min(1),
  receivedAt: daySchema,
  bodyText: z.string().optional(),
});

const documentSeedSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "PO",
    "BookingConfirmation",
    "BillOfLading",
    "Invoice",
    "PackingList",
    "ArrivalNotice",
  ]),
  format: z.enum(DOCUMENT_FORMATS),
  bucketKey: z.string().min(1),
  bookingId: z.string().min(1).optional(),
  sourceEmailId: z.string().min(1).optional(),
  extractedData: z.record(z.unknown()),
  receivedAt: daySchema,
});

const operationSeedSchema = z.object({
  id: z.string().min(1),
  createdAt: daySchema,
  companyId: z.string().min(1).optional(),
  bookings: z.array(bookingSeedSchema),
  context: z.object({
    emails: z.array(emailSeedSchema),
    documents: z.array(documentSeedSchema),
  }),
});

const companySeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contactEmails: z.array(z.string().min(1)),
  preferredNotificationChannel: z.enum(["email", "slack"]),
  active: z.boolean().default(true),
}) satisfies z.ZodType<Company, z.ZodTypeDef, unknown>;

type EmailSeed = z.infer<typeof emailSeedSchema>;
type DocumentSeed = z.infer<typeof documentSeedSchema>;

const seedFileSchema = z.object({
  operations: z.array(operationSeedSchema),
  companies: z.array(companySeedSchema),
});

type BookingSeed = z.infer<typeof bookingSeedSchema>;
type OperationSeed = z.infer<typeof operationSeedSchema>;

function buildEmail(seed: EmailSeed): ContextEmail {
  const { to, bodyText, ...rest } = seed;

  return {
    ...rest,
    ...(to !== undefined ? { to } : {}),
    ...(bodyText !== undefined ? { bodyText } : {}),
  };
}

function buildDocument(seed: DocumentSeed): Document {
  const { bookingId, sourceEmailId, ...rest } = seed;

  return {
    ...rest,
    ...(bookingId !== undefined ? { bookingId } : {}),
    ...(sourceEmailId !== undefined ? { sourceEmailId } : {}),
  };
}

function scheduleChanges(seed: BookingSeed): Booking["schedule"]["changes"] {
  const { delayedTo, delayReason } = seed;

  if (delayedTo === undefined || delayReason === undefined) {
    return [];
  }

  return [{ previousEta: seed.eta, newEta: delayedTo, reason: delayReason, occurredAt: seed.etd }];
}

function buildBooking(seed: BookingSeed): Booking {
  return {
    id: seed.id,
    companyIds: seed.companyIds,
    carrier: seed.carrier,
    vessel: seed.vessel,
    originPort: seed.originPort,
    destinationPort: seed.destinationPort,
    schedule: {
      etdOriginal: seed.etd,
      etaOriginal: seed.eta,
      etaCurrent: seed.delayedTo ?? seed.eta,
      changes: scheduleChanges(seed),
    },
    containers: seed.containers.map(([containerNumber, state], index) => ({
      id: `${seed.id}-c${index + 1}`,
      containerNumber,
      state,
    })),
  };
}

function buildOperation(seed: OperationSeed): Operation {
  return {
    id: seed.id,
    ...(seed.companyId !== undefined ? { companyId: seed.companyId } : {}),
    bookings: seed.bookings.map(buildBooking),
    context: {
      emails: seed.context.emails.map(buildEmail),
      documents: seed.context.documents.map(buildDocument),
    },
    createdAt: seed.createdAt,
  };
}

function buildComponents(operation: Operation): Component[] {
  const containers = operation.bookings.flatMap((booking) => booking.containers).length;

  return [
    {
      id: `seed-${operation.id}-summary`,
      operationId: operation.id,
      order: 0,
      size: "wide",
      kind: "container",
      children: [
        { kind: "title", order: 0, props: { text: "Resumen de operación" } },
        {
          kind: "label",
          order: 1,
          props: { text: `${operation.bookings.length} bookings y ${operation.context.documents.length} documentos` },
        },
      ],
      createdAt: operation.createdAt,
    },
    {
      id: `seed-${operation.id}-containers`,
      operationId: operation.id,
      order: 1,
      size: "small",
      kind: "container",
      children: [
        { kind: "title", order: 0, props: { text: "Contenedores" } },
        { kind: "stat", order: 1, props: { value: containers, label: "en la operación" } },
      ],
      createdAt: operation.createdAt,
    },
    {
      id: `seed-${operation.id}-documents`,
      operationId: operation.id,
      order: 2,
      size: "small",
      kind: "container",
      children: [
        { kind: "title", order: 0, props: { text: "Documentos" } },
        {
          kind: "stat",
          order: 1,
          props: { value: operation.context.documents.length, label: "cargados" },
        },
      ],
      createdAt: operation.createdAt,
    },
  ];
}

const seedFile = seedFileSchema.parse(JSON.parse(readFileSync(DATA_FILE, "utf8")));

const mongo = await connectMongo();

try {
  const operations = new MongoOperationRepository(mongo.db);
  const companies = new MongoCompanyRepository(mongo.db);
  const components = new MongoComponentRepository(mongo.db);

  for (const seed of seedFile.operations) {
    const operation = buildOperation(seed);
    await operations.save(operation);
    for (const component of buildComponents(operation)) {
      await components.save(component);
    }
  }
  for (const company of seedFile.companies) {
    await companies.save(company);
  }

  const storedOperations = await operations.findAll();
  const storedCompanies = await companies.findAll();

  console.log(`seeded into "${mongo.db.databaseName}"`);
  console.log(`operations: ${storedOperations.length}, companies: ${storedCompanies.length}`);
} finally {
  await mongo.close();
}
