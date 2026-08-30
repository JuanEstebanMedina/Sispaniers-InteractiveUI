import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  validateComponentSize,
  validateComponentTree,
} from "../src/domain/components/component-node.js";
import type { Component, ComponentNode } from "../src/domain/components/component.js";
import { buildWelcomeComponent } from "../src/domain/components/welcome-component.js";
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

const vesselPositionSeedSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  updatedAt: daySchema,
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
  vesselPosition: vesselPositionSeedSchema.optional(),
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
    ...(seed.vesselPosition !== undefined ? { vesselPosition: seed.vesselPosition } : {}),
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
 * `op-andes-textiles-001` — the one operation left in a complete state,
 * covering all 18 kinds across its 16 widgets, so the dashboard alone
 * demonstrates everything the agent can build.
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
          text: `${operation.bookings.length} bookings, ${containers} containers and ${documents.length} documents in progress.`,
        },
      },
    ]),

    container(operation, "containers-stat", 1, "small", [
      { kind: "title", order: 0, props: { text: "Containers" } },
      { kind: "stat", order: 1, props: { value: String(containers), label: "in the operation" } },
    ]),

    container(operation, "status-badge", 2, "small", [
      { kind: "title", order: 0, props: { text: "Status" } },
      { kind: "badge", order: 1, props: { text: "In transit with delay", status: "warning" } },
    ]),

    container(operation, "customs-progress", 3, "small", [
      { kind: "title", order: 0, props: { text: "Customs clearance" } },
      {
        kind: "progress",
        order: 1,
        props: { value: 2, max: 5, label: "containers released", status: "brand" },
      },
    ]),

    container(operation, "eta-trend", 4, "wide", [
      { kind: "title", order: 0, props: { text: "ETA over time" } },
      {
        kind: "trend-chart",
        order: 1,
        props: {
          dataKey: "schedule-changes",
          xKey: "x",
          series: [{ key: "value", label: "Days late", colorIndex: 3 }],
        },
      },
    ]),

    container(operation, "containers-by-state", 5, "wide", [
      { kind: "title", order: 0, props: { text: "Containers by state" } },
      {
        kind: "category-chart",
        order: 1,
        props: {
          dataKey: "containers-by-state",
          xKey: "name",
          series: [{ key: "value", label: "Containers", colorIndex: 0 }],
        },
      },
    ]),

    container(operation, "containers-breakdown", 6, "small", [
      { kind: "title", order: 0, props: { text: "Container breakdown" } },
      {
        kind: "breakdown-chart",
        order: 1,
        props: { dataKey: "containers-by-state", centerLabel: "Total" },
      },
    ]),

    container(operation, "story", 7, "tall", [
      { kind: "title", order: 0, props: { text: "What happened with this order" } },
      narrativeTimeline(1, narrative),
    ]),

    container(operation, "bookings-table", 8, "wide", [
      { kind: "title", order: 0, props: { text: "Operation bookings" } },
      {
        kind: "table",
        order: 1,
        props: {
          dataKey: "bookings",
          columns: [
            { key: "carrier", label: "Carrier" },
            { key: "vessel", label: "Vessel" },
            { key: "origin", label: "Origin" },
            { key: "destination", label: "Destination" },
            { key: "containers", label: "Containers" },
          ],
        },
      },
    ]),

    container(operation, "booking-fields", 9, "small", [
      { kind: "title", order: 0, props: { text: "First booking" } },
      {
        kind: "key-values",
        order: 1,
        props: {
          items: firstBooking
            ? [
                { label: "Carrier", value: firstBooking.carrier },
                { label: "Vessel", value: firstBooking.vessel },
                { label: "Current ETA", value: iso(firstBooking.schedule.etaCurrent) },
              ]
            : [],
        },
      },
    ]),

    container(operation, "containers-sparkline", 10, "small", [
      { kind: "title", order: 0, props: { text: "Containers" } },
      { kind: "sparkline", order: 1, props: { dataKey: "containers-by-state", valueKey: "value" } },
    ]),

    container(operation, "documents-files", 11, "small", [
      { kind: "title", order: 0, props: { text: "Recent documents" } },
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

    container(operation, "notify-action", 12, "small", [
      { kind: "title", order: 0, props: { text: "Action" } },
      { kind: "button", order: 1, props: { label: "Notify client" }, action: "navigate" },
    ]),

    container(operation, "documents-summary", 13, "banner", [
      { kind: "title", order: 0, props: { text: "Latest document received" } },
      { kind: "divider", order: 1, props: {} },
      {
        kind: "label",
        order: 2,
        props: {
          text: firstDoc
            ? `${firstDoc.type} received on ${iso(firstDoc.receivedAt)}`
            : "No documents yet",
        },
      },
    ]),

    container(operation, "vessel-map", 14, "wide", [
      { kind: "title", order: 0, props: { text: "Vessel positions" } },
      { kind: "map", order: 1, props: { dataKey: "vessel-positions" } },
    ]),

    container(operation, "notify-delay-email", 15, "tall", [
      { kind: "title", order: 0, props: { text: "Notify client of the delay" } },
      {
        kind: "email-action",
        order: 1,
        props: {
          to: "ops@andestextiles.co",
          subject: "ETA update — booking bkg-andes-001",
          body:
            "Hi,\n\nWe're writing to let you know your shipment's ETA moved because of an " +
            "unplanned transshipment in Busan. We're standing by for any questions.\n\nBest " +
            "regards.",
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
      { kind: "title", order: 0, props: { text: "Operation summary" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: `${operation.bookings.length} booking and ${operation.context.documents.length} documents — delivered.`,
        },
      },
    ]),
    container(operation, "containers", 1, "small", [
      { kind: "title", order: 0, props: { text: "Containers" } },
      { kind: "stat", order: 1, props: { value: String(containers), label: "delivered" } },
    ]),
    container(operation, "status", 2, "small", [
      { kind: "title", order: 0, props: { text: "Status" } },
      { kind: "badge", order: 1, props: { text: "Delivered", status: "success" } },
    ]),
    container(operation, "story", 3, "tall", [
      { kind: "title", order: 0, props: { text: "What happened with this order" } },
      narrativeTimeline(1, narrative),
    ]),
    container(operation, "eta-sparkline", 4, "small", [
      { kind: "title", order: 0, props: { text: "ETA changes" } },
      { kind: "sparkline", order: 1, props: { dataKey: "schedule-changes" } },
    ]),
    container(operation, "delivery-email", 5, "tall", [
      { kind: "title", order: 0, props: { text: "Notify client of the delivery" } },
      {
        kind: "email-action",
        order: 1,
        props: {
          to: "ops@andestextiles.co",
          subject: "Delivery completed — booking bkg-andes-002",
          body:
            "Hi,\n\nWe're confirming that containers HLXU8811223 and HLXU8811224 were " +
            "delivered at destination. Let us know if anything comes up.\n\nBest regards.",
        },
      },
    ]),
  ];
}

/** `op-cafe-del-valle-001` — multi-booking operation, still moving. */
function buildCafeComponents(operation: Operation, narrative: NarrativeEventSeed[]): Component[] {
  return [
    container(operation, "summary", 0, "wide", [
      { kind: "title", order: 0, props: { text: "Operation summary" } },
      {
        kind: "label",
        order: 1,
        props: {
          text: `${operation.bookings.length} bookings and ${operation.context.documents.length} documents in progress.`,
        },
      },
      { kind: "divider", order: 2, props: {} },
      {
        kind: "label",
        order: 3,
        props: { text: "Café del Valle + Flores Tropicales share a booking.", tone: "muted" },
      },
    ]),
    container(operation, "containers-by-state", 1, "wide", [
      { kind: "title", order: 0, props: { text: "Containers by state" } },
      {
        kind: "category-chart",
        order: 1,
        props: {
          dataKey: "containers-by-state",
          xKey: "name",
          series: [{ key: "value", label: "Containers", colorIndex: 2 }],
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
            { key: "carrier", label: "Carrier" },
            { key: "origin", label: "Origin" },
            { key: "destination", label: "Destination" },
            { key: "containers", label: "Containers" },
          ],
        },
      },
    ]),
    container(operation, "customs-progress", 3, "small", [
      { kind: "title", order: 0, props: { text: "Customs clearance" } },
      {
        kind: "progress",
        order: 1,
        props: { value: 1, max: 3, label: "containers released", status: "warning" },
      },
    ]),
    container(operation, "story", 4, "tall", [
      { kind: "title", order: 0, props: { text: "What happened with this order" } },
      narrativeTimeline(1, narrative),
    ]),
    container(operation, "reroute-email", 5, "tall", [
      { kind: "title", order: 0, props: { text: "Notify of the route change" } },
      {
        kind: "email-action",
        order: 1,
        props: {
          to: "exports@cafedelvalle.co",
          subject: "Route change — booking bkg-cafe-001",
          body:
            "Hi,\n\nThe vessel had to reroute because of weather in the Caribbean, so the " +
            "ETA moved a couple of days. We'll let you know as soon as we have a firmer " +
            "date.\n\nBest regards.",
        },
      },
    ]),
  ];
}

/** `op-flores-tropicales-001` — pre-booking: just a PO and a promise so far. */
function buildFloresComponents(operation: Operation, narrative: NarrativeEventSeed[]): Component[] {
  const po = operation.context.documents[0];
  const extracted = (po?.extractedData ?? {}) as Record<string, unknown>;

  return [
    buildWelcomeComponent(operation.id, operation.createdAt),
    container(operation, "summary", 1, "wide", [
      { kind: "title", order: 0, props: { text: "Operation summary" } },
      {
        kind: "label",
        order: 1,
        props: { text: "Still no booking — waiting on carrier confirmation." },
      },
    ]),
    container(operation, "status", 2, "small", [
      { kind: "title", order: 0, props: { text: "Status" } },
      { kind: "badge", order: 1, props: { text: "No booking yet", status: "neutral" } },
    ]),
    container(operation, "po-fields", 3, "small", [
      { kind: "title", order: 0, props: { text: "Purchase order" } },
      {
        kind: "key-values",
        order: 1,
        props: {
          items: [
            { label: "Incoterm", value: String(extracted.incoterm ?? "—") },
            { label: "Requested ETA", value: String(extracted.requestedEta ?? "—") },
          ],
        },
      },
    ]),
    container(operation, "story", 4, "tall", [
      { kind: "title", order: 0, props: { text: "What happened with this order" } },
      narrativeTimeline(1, narrative),
    ]),
    container(operation, "booking-request-email", 5, "tall", [
      { kind: "title", order: 0, props: { text: "Ask for booking confirmation" } },
      {
        kind: "email-action",
        order: 1,
        props: {
          to: "compras@florestropicales.co",
          subject: "Follow-up — booking confirmation pending",
          body:
            "Hi,\n\nWe still don't have a booking confirmation from the carrier for the " +
            "September shipment. Standing by for any updates.\n\nBest regards.",
        },
      },
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
