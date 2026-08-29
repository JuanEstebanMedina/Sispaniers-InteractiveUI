import { randomUUID } from "node:crypto";
import { type Db, MongoClient } from "mongodb";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import type { Operation } from "../../src/domain/model/operation.js";
import { MongoOperationRepository } from "../../src/infrastructure/adapters/outbound/mongo/operation.repository.js";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const databaseName = `sispaniers_test_${randomUUID().replaceAll("-", "")}`;

let client: MongoClient;
let db: Db;
let repository: MongoOperationRepository;

beforeAll(async () => {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(databaseName);
  repository = new MongoOperationRepository(db);
});

afterAll(async () => {
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  await db.collection("operations").deleteMany({});
});

function anOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: randomUUID(),
    clientId: randomUUID(),
    bookings: [
      {
        id: randomUUID(),
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
    documents: [
      {
        id: randomUUID(),
        type: "BillOfLading",
        bookingId: randomUUID(),
        sourceEmailId: "email-1",
        extractedData: { weightKg: 18500 },
        receivedAt: new Date("2026-01-06T08:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function withAllContainersDelivered(operation: Operation): Operation {
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

test("a saved operation is returned whole by its id", async () => {
  const operation = anOperation();

  await repository.save(operation);

  expect(await repository.findById(operation.id)).toEqual(operation);
});

test("an unknown id resolves to nothing", async () => {
  expect(await repository.findById(randomUUID())).toBeNull();
});

test("saving the same operation twice updates it instead of duplicating it", async () => {
  const operation = anOperation();
  await repository.save(operation);

  const delivered = withAllContainersDelivered(operation);
  await repository.save(delivered);

  expect(await repository.findById(operation.id)).toEqual(delivered);
  expect(await db.collection("operations").countDocuments({})).toBe(1);
});

test("the stored document identifies the operation only by _id, never by a duplicate id field", async () => {
  const operation = anOperation();

  await repository.save(operation);

  const raw = await db.collection("operations").findOne({});

  expect(raw).not.toBeNull();
  expect(raw?._id).toBe(operation.id);
  expect(raw).not.toHaveProperty("id");
});

test("dates survive the round trip as dates and not as strings", async () => {
  const operation = anOperation();

  await repository.save(operation);

  const raw = await db.collection("operations").findOne({});

  expect(raw?.createdAt).toBeInstanceOf(Date);

  const found = await repository.findById(operation.id);
  const booking = found?.bookings[0];

  expect(found?.createdAt).toBeInstanceOf(Date);
  expect(booking?.schedule.etaCurrent).toBeInstanceOf(Date);
  expect(booking?.schedule.changes[0]?.occurredAt).toBeInstanceOf(Date);
  expect(booking?.vesselPosition?.updatedAt).toBeInstanceOf(Date);
  expect(found?.documents[0]?.receivedAt).toBeInstanceOf(Date);
});

test("optional booking and document fields stay absent when the domain leaves them out", async () => {
  const operation = anOperation();
  const [booking] = operation.bookings;
  const [document] = operation.documents;
  if (!booking || !document) {
    throw new Error("fixture must carry one booking and one document");
  }
  const { vesselPosition: _vesselPosition, ...bookingWithoutPosition } = booking;
  const { bookingId: _bookingId, sourceEmailId: _sourceEmailId, ...bareDocument } = document;
  const sparse: Operation = {
    ...operation,
    bookings: [bookingWithoutPosition],
    documents: [bareDocument],
  };

  await repository.save(sparse);

  const found = await repository.findById(sparse.id);

  expect(found).toEqual(sparse);
  expect(found?.bookings[0]).not.toHaveProperty("vesselPosition");
  expect(found?.documents[0]).not.toHaveProperty("bookingId");
  expect(found?.documents[0]).not.toHaveProperty("sourceEmailId");
});

function withoutContainers(operation: Operation): Operation {
  return {
    ...operation,
    bookings: operation.bookings.map((booking) => ({ ...booking, containers: [] })),
  };
}

test("an operation whose containers are not loaded yet still counts as active", async () => {
  const clientId = randomUUID();
  const justCreated = withoutContainers(anOperation({ clientId }));

  await repository.save(justCreated);

  expect(await repository.findActiveByClient(clientId)).toEqual([justCreated]);
});

test("a client only sees operations that still have undelivered containers", async () => {
  const clientId = randomUUID();
  const partiallyDelivered = anOperation({ clientId });
  const fullyDelivered = withAllContainersDelivered(anOperation({ clientId }));
  const anotherClientsOperation = anOperation();

  await repository.save(partiallyDelivered);
  await repository.save(fullyDelivered);
  await repository.save(anotherClientsOperation);

  const active = await repository.findActiveByClient(clientId);

  expect(active).toEqual([partiallyDelivered]);
});
