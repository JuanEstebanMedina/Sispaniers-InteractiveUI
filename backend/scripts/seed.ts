import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  validateComponentSize,
  validateComponentTree,
} from "../src/domain/components/component-node.js";
import type { Component, ComponentNode } from "../src/domain/components/component.js";
import type { WidgetSizeName } from "../src/domain/components/widget-size.js";
import { CONTAINER_STATES } from "../src/domain/enums/container-state.js";
import { DOCUMENT_FORMATS } from "../src/domain/enums/document-format.js";
import { ROLES } from "../src/domain/enums/role.js";
import type { Company } from "../src/domain/logistics/company.js";
import type { Document } from "../src/domain/logistics/document.js";
import type { ContextEmail } from "../src/domain/logistics/operation-context.js";
import type { Booking, Operation } from "../src/domain/logistics/operation.js";
import type { User } from "../src/domain/logistics/user.js";
import { BcryptPasswordHasher } from "../src/infrastructure/adapters/outbound/auth/bcrypt-password-hasher.js";
import { MongoCompanyRepository } from "../src/infrastructure/adapters/outbound/mongo/company.repository.js";
import { MongoComponentRepository } from "../src/infrastructure/adapters/outbound/mongo/component.repository.js";
import { MongoOperationRepository } from "../src/infrastructure/adapters/outbound/mongo/operation.repository.js";
import { MongoUserRepository } from "../src/infrastructure/adapters/outbound/mongo/user.repository.js";
import { connectMongo } from "../src/infrastructure/config/mongo.js";

const DATA_FILE = new URL("./seed-data.json", import.meta.url);

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD day")
  .transform((day) => new Date(`${day}T00:00:00.000Z`));

/** One ETA move. A booking can carry several, in order — that's the trend line. */
const delayEventSeedSchema = z.object({
  eta: daySchema,
  reason: z.string().min(1),
  occurredAt: daySchema,
});

const bookingSeedSchema = z.object({
  id: z.string().min(1),
  companyIds: z.array(z.string().min(1)),
  carrier: z.string().min(1),
  vessel: z.string().min(1),
  originPort: z.string().min(1),
  destinationPort: z.string().min(1),
  etd: daySchema,
  eta: daySchema,
  delays: z.array(delayEventSeedSchema).default([]),
  containers: z.array(z.tuple([z.string().min(1), z.enum(CONTAINER_STATES)])),
});

/** The narrated history of an operation — "el guion". Feeds a seeded timeline. */
const narrativeEventSeedSchema = z.object({
  text: z.string().min(1),
  at: z.string().min(1),
  status: z
    .enum(["neutral", "brand", "accent", "success", "warning", "danger", "info"])
    .default("neutral"),
});

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
  narrative: z.array(narrativeEventSeedSchema).default([]),
});

const companySeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contactEmails: z.array(z.string().min(1)),
  preferredNotificationChannel: z.enum(["email", "slack"]),
  generalContext: z.array(z.string().min(1)).default([]),
  active: z.boolean().default(true),
}) satisfies z.ZodType<Company, z.ZodTypeDef, unknown>;

const userSeedSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1).optional(),
  email: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(ROLES),
});

type EmailSeed = z.infer<typeof emailSeedSchema>;
type DocumentSeed = z.infer<typeof documentSeedSchema>;
type UserSeed = z.infer<typeof userSeedSchema>;

const seedFileSchema = z.object({
  operations: z.array(operationSeedSchema),
  companies: z.array(companySeedSchema),
  users: z.array(userSeedSchema),
});

type BookingSeed = z.infer<typeof bookingSeedSchema>;
type OperationSeed = z.infer<typeof operationSeedSchema>;
type NarrativeEventSeed = z.infer<typeof narrativeEventSeedSchema>;

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

/** Chains the booking's delays into the previous→new ETA pairs the domain expects. */
function scheduleChanges(seed: BookingSeed): Booking["schedule"]["changes"] {
  const changes: Booking["schedule"]["changes"] = [];
  let previousEta = seed.eta;

  for (const delay of seed.delays) {
    changes.push({
      previousEta,
      newEta: delay.eta,
      reason: delay.reason,
      occurredAt: delay.occurredAt,
    });
    previousEta = delay.eta;
  }

  return changes;
}

function buildBooking(seed: BookingSeed): Booking {
  const lastDelay = seed.delays.at(-1);

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
      etaCurrent: lastDelay?.eta ?? seed.eta,
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

/**
 * SEEDED WIDGETS
 *
 * Mirrors the agent's own contract (`backend/src/application/skills/`): a
 * `stat`'s `value` is read as a string, a `progress`'s `value`/`max` as
 * numbers, a `timeline`'s `events` inline or through a `dataKey` — the same
 * rules the AI has to follow, because these boxes render through the exact
 * same parts the AI's own components do.
 */

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `document.format` → the `file` node's `type` (mirrors FileCard's FILE_KINDS) and a plausible extension. */
function fileTypeAndExtension(format: Document["format"]): [string, string] {
  switch (format) {
    case "spreadsheet":
      return ["excel", "xlsx"];
    case "document":
      return ["word", "docx"];
    case "image":
      return ["image", "png"];
    case "pdf":
      return ["pdf", "pdf"];
    default:
      return ["file", "dat"];
  }
}

function container(
  operation: Operation,
  suffix: string,
  order: number,
  size: WidgetSizeName,
  children: ComponentNode[],
): Component {
  return {
    id: `seed-${operation.id}-${suffix}`,
    operationId: operation.id,
    order,
    size,
    kind: "container",
    children,
    createdAt: operation.createdAt,
  };
}

function containerCount(operation: Operation): number {
  return operation.bookings.flatMap((booking) => booking.containers).length;
}

/** Inline `timeline` node carrying "el guion" — the narrated history of the order. */
function narrativeTimeline(order: number, narrative: NarrativeEventSeed[]): ComponentNode {
  return {
    kind: "timeline",
    order,
    props: {
      events: narrative.map((event) => ({ text: event.text, at: event.at, status: event.status })),
    },
  };
}

/**
 * `op-andes-textiles-001` — the one operation left in a complete state, one
 * widget per available `kind` (all 16), so the dashboard alone demonstrates
 * everything the agent can build.
 */
function buildShowcaseComponents(
  operation: Operation,
  narrative: NarrativeEventSeed[],
): Component[] {
  const containers = containerCount(operation);
  const documents = operation.context.documents;
  const firstDoc = documents[0];
  const firstBooking = operation.bookings[0];

  return [
    container(operation, "hero", 0, "banner", [
      { kind: "title", order: 0, props: { text: "Andes Textiles — CNSHA → COCTG" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: `${operation.bookings.length} bookings, ${containers} contenedores y ${documents.length} documentos en curso.`,
        },
      },
    ]),

    container(operation, "containers-stat", 1, "tile", [
      { kind: "title", order: 0, props: { text: "Contenedores" } },
      { kind: "stat", order: 1, props: { value: String(containers), label: "en la operación" } },
    ]),

    container(operation, "status-badge", 2, "tile", [
      { kind: "title", order: 0, props: { text: "Estado" } },
      { kind: "badge", order: 1, props: { text: "En tránsito con retraso", status: "warning" } },
    ]),

    container(operation, "customs-progress", 3, "small", [
      { kind: "title", order: 0, props: { text: "Despacho aduanero" } },
      {
        kind: "progress",
        order: 1,
        props: { value: 2, max: 5, label: "contenedores liberados", status: "brand" },
      },
    ]),

    container(operation, "eta-trend", 4, "wide", [
      { kind: "title", order: 0, props: { text: "Evolución del ETA" } },
      {
        kind: "trend-chart",
        order: 1,
        props: {
          dataKey: "schedule-changes",
          xKey: "x",
          series: [{ key: "value", label: "Cambios de ETA", colorIndex: 3 }],
        },
      },
    ]),

    container(operation, "containers-by-state", 5, "wide", [
      { kind: "title", order: 0, props: { text: "Contenedores por estado" } },
      {
        kind: "category-chart",
        order: 1,
        props: {
          dataKey: "containers-by-state",
          xKey: "name",
          series: [{ key: "value", label: "Contenedores", colorIndex: 0 }],
        },
      },
    ]),

    container(operation, "containers-breakdown", 6, "small", [
      { kind: "title", order: 0, props: { text: "Reparto de contenedores" } },
      {
        kind: "breakdown-chart",
        order: 1,
        props: { dataKey: "containers-by-state", centerLabel: "Total" },
      },
    ]),

    container(operation, "story", 7, "tall", [
      { kind: "title", order: 0, props: { text: "Qué pasó con esta orden" } },
      narrativeTimeline(1, narrative),
    ]),

    container(operation, "bookings-table", 8, "wide", [
      { kind: "title", order: 0, props: { text: "Bookings de la operación" } },
      {
        kind: "table",
        order: 1,
        props: {
          dataKey: "bookings",
          columns: [
            { key: "carrier", label: "Naviera" },
            { key: "vessel", label: "Buque" },
            { key: "origin", label: "Origen" },
            { key: "destination", label: "Destino" },
            { key: "containers", label: "Contenedores" },
          ],
        },
      },
    ]),

    container(operation, "booking-fields", 9, "small", [
      { kind: "title", order: 0, props: { text: "Primer booking" } },
      {
        kind: "key-values",
        order: 1,
        props: {
          items: firstBooking
            ? [
                { label: "Naviera", value: firstBooking.carrier },
                { label: "Buque", value: firstBooking.vessel },
                { label: "ETA vigente", value: iso(firstBooking.schedule.etaCurrent) },
              ]
            : [],
        },
      },
    ]),

    container(operation, "containers-sparkline", 10, "tile", [
      { kind: "title", order: 0, props: { text: "Contenedores" } },
      { kind: "sparkline", order: 1, props: { dataKey: "containers-by-state", valueKey: "value" } },
    ]),

    container(operation, "documents-files", 11, "small", [
      { kind: "title", order: 0, props: { text: "Documentos recientes" } },
      {
        kind: "layout",
        order: 1,
        props: { direction: "column", gap: "sm" },
        children: documents.slice(0, 3).map((document, index) => {
          const [type, extension] = fileTypeAndExtension(document.format);
          return {
            kind: "file",
            order: index,
            props: { name: `${document.type}.${extension}`, type, at: iso(document.receivedAt) },
          };
        }),
      },
    ]),

    container(operation, "notify-action", 12, "tile", [
      { kind: "title", order: 0, props: { text: "Acción" } },
      { kind: "button", order: 1, props: { label: "Notificar al cliente" }, action: "navigate" },
    ]),

    container(operation, "documents-summary", 13, "banner", [
      { kind: "title", order: 0, props: { text: "Último documento recibido" } },
      { kind: "divider", order: 1, props: {} },
      {
        kind: "label",
        order: 2,
        props: {
          text: firstDoc
            ? `${firstDoc.type} recibido el ${iso(firstDoc.receivedAt)}`
            : "Sin documentos todavía",
        },
      },
    ]),
  ];
}

/** `op-andes-textiles-002` — a closed operation: what happened, told as a few widgets. */
function buildAndesClosedComponents(
  operation: Operation,
  narrative: NarrativeEventSeed[],
): Component[] {
  const containers = containerCount(operation);

  return [
    container(operation, "summary", 0, "wide", [
      { kind: "title", order: 0, props: { text: "Resumen de operación" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: `${operation.bookings.length} booking y ${operation.context.documents.length} documentos — entregado.`,
        },
      },
    ]),
    container(operation, "containers", 1, "tile", [
      { kind: "title", order: 0, props: { text: "Contenedores" } },
      { kind: "stat", order: 1, props: { value: String(containers), label: "entregados" } },
    ]),
    container(operation, "status", 2, "tile", [
      { kind: "title", order: 0, props: { text: "Estado" } },
      { kind: "badge", order: 1, props: { text: "Entregado", status: "success" } },
    ]),
    container(operation, "story", 3, "tall", [
      { kind: "title", order: 0, props: { text: "Qué pasó con esta orden" } },
      narrativeTimeline(1, narrative),
    ]),
    container(operation, "eta-sparkline", 4, "tile", [
      { kind: "title", order: 0, props: { text: "Cambios de ETA" } },
      { kind: "sparkline", order: 1, props: { dataKey: "schedule-changes" } },
    ]),
  ];
}

/** `op-cafe-del-valle-001` — multi-booking operation, still moving. */
function buildCafeComponents(operation: Operation, narrative: NarrativeEventSeed[]): Component[] {
  return [
    container(operation, "summary", 0, "wide", [
      { kind: "title", order: 0, props: { text: "Resumen de operación" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: `${operation.bookings.length} bookings y ${operation.context.documents.length} documentos en curso.`,
        },
      },
      { kind: "divider", order: 2, props: {} },
      {
        kind: "label",
        order: 3,
        props: { text: "Café del Valle + Flores Tropicales comparten un booking.", tone: "muted" },
      },
    ]),
    container(operation, "containers-by-state", 1, "wide", [
      { kind: "title", order: 0, props: { text: "Contenedores por estado" } },
      {
        kind: "category-chart",
        order: 1,
        props: {
          dataKey: "containers-by-state",
          xKey: "name",
          series: [{ key: "value", label: "Contenedores", colorIndex: 2 }],
        },
      },
    ]),
    container(operation, "bookings-table", 2, "wide", [
      { kind: "title", order: 0, props: { text: "Bookings" } },
      {
        kind: "table",
        order: 1,
        props: {
          dataKey: "bookings",
          columns: [
            { key: "carrier", label: "Naviera" },
            { key: "origin", label: "Origen" },
            { key: "destination", label: "Destino" },
            { key: "containers", label: "Contenedores" },
          ],
        },
      },
    ]),
    container(operation, "customs-progress", 3, "small", [
      { kind: "title", order: 0, props: { text: "Despacho aduanero" } },
      {
        kind: "progress",
        order: 1,
        props: { value: 1, max: 3, label: "contenedores liberados", status: "warning" },
      },
    ]),
    container(operation, "story", 4, "tall", [
      { kind: "title", order: 0, props: { text: "Qué pasó con esta orden" } },
      narrativeTimeline(1, narrative),
    ]),
  ];
}

/** `op-flores-tropicales-001` — pre-booking: just a PO and a promise so far. */
function buildFloresComponents(operation: Operation, narrative: NarrativeEventSeed[]): Component[] {
  const po = operation.context.documents[0];
  const extracted = (po?.extractedData ?? {}) as Record<string, unknown>;

  return [
    container(operation, "summary", 0, "wide", [
      { kind: "title", order: 0, props: { text: "Resumen de operación" } },
      {
        kind: "label",
        order: 1,
        props: { text: "Todavía sin booking — esperando confirmación del naviero." },
      },
    ]),
    container(operation, "status", 1, "tile", [
      { kind: "title", order: 0, props: { text: "Estado" } },
      { kind: "badge", order: 1, props: { text: "Sin booking", status: "neutral" } },
    ]),
    container(operation, "po-fields", 2, "small", [
      { kind: "title", order: 0, props: { text: "Orden de compra" } },
      {
        kind: "key-values",
        order: 1,
        props: {
          items: [
            { label: "Incoterm", value: String(extracted.incoterm ?? "—") },
            { label: "ETA solicitada", value: String(extracted.requestedEta ?? "—") },
          ],
        },
      },
    ]),
    container(operation, "story", 3, "tall", [
      { kind: "title", order: 0, props: { text: "Qué pasó con esta orden" } },
      narrativeTimeline(1, narrative),
    ]),
  ];
}

const COMPONENT_BUILDERS: Record<
  string,
  (operation: Operation, narrative: NarrativeEventSeed[]) => Component[]
> = {
  "op-andes-textiles-001": buildShowcaseComponents,
  "op-andes-textiles-002": buildAndesClosedComponents,
  "op-cafe-del-valle-001": buildCafeComponents,
  "op-flores-tropicales-001": buildFloresComponents,
};

function buildComponents(seed: OperationSeed, operation: Operation): Component[] {
  const builder = COMPONENT_BUILDERS[seed.id] ?? buildAndesClosedComponents;
  return builder(operation, seed.narrative);
}

async function buildUser(seed: UserSeed, passwordHasher: BcryptPasswordHasher): Promise<User> {
  const { password, companyId, ...rest } = seed;

  return {
    ...rest,
    ...(companyId !== undefined ? { companyId } : {}),
    passwordHash: await passwordHasher.hash(password),
    active: true,
  };
}

const seedFile = seedFileSchema.parse(JSON.parse(readFileSync(DATA_FILE, "utf8")));

const mongo = await connectMongo();

try {
  const operations = new MongoOperationRepository(mongo.db);
  const companies = new MongoCompanyRepository(mongo.db);
  const components = new MongoComponentRepository(mongo.db);
  const users = new MongoUserRepository(mongo.db);
  const passwordHasher = new BcryptPasswordHasher();

  for (const seed of seedFile.operations) {
    const operation = buildOperation(seed);
    await operations.save(operation);
    for (const component of buildComponents(seed, operation)) {
      // Same rules the agent's own output has to pass — a seed can typo a
      // dataKey or a depth just as easily as the model can.
      validateComponentTree(component.children);
      validateComponentSize(component.size, component.children);
      await components.save(component);
    }
  }
  for (const company of seedFile.companies) {
    await companies.save(company);
  }
  for (const seed of seedFile.users) {
    await users.save(await buildUser(seed, passwordHasher));
  }

  const storedOperations = await operations.findAll();
  const storedCompanies = await companies.findAll();
  const storedUsers = await users.findAllByCompany();

  console.log(`seeded into "${mongo.db.databaseName}"`);
  console.log(
    `operations: ${storedOperations.length}, companies: ${storedCompanies.length}, users: ${storedUsers.length}`,
  );
} finally {
  await mongo.close();
}
