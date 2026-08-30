import { randomUUID } from "node:crypto";
import { type Db, MongoClient } from "mongodb";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import type { Operation } from "../../src/domain/logistics/operation.js";
import { MongoOperationRepository } from "../../src/infrastructure/adapters/outbound/mongo/operation.repository.js";
import { resolveMongoUri } from "../../src/infrastructure/config/mongo.js";
import { anOperation, withAllContainersDelivered } from "../support/operation-fixtures.js";

const uri = resolveMongoUri();
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
  expect(found?.context.documents[0]?.receivedAt).toBeInstanceOf(Date);
  expect(found?.context.emails[0]?.receivedAt).toBeInstanceOf(Date);
});

test("optional booking and document fields stay absent when the domain leaves them out", async () => {
  const operation = anOperation();
  const [booking] = operation.bookings;
  const [document] = operation.context.documents;
  if (!booking || !document) {
    throw new Error("fixture must carry one booking and one document");
  }
  const { vesselPosition: _vesselPosition, ...bookingWithoutPosition } = booking;
  const { bookingId: _bookingId, sourceEmailId: _sourceEmailId, ...bareDocument } = document;
  const sparse: Operation = {
    ...operation,
    bookings: [bookingWithoutPosition],
    context: { ...operation.context, documents: [bareDocument] },
  };

  await repository.save(sparse);

  const found = await repository.findById(sparse.id);

  expect(found).toEqual(sparse);
  expect(found?.bookings[0]).not.toHaveProperty("vesselPosition");
  expect(found?.context.documents[0]).not.toHaveProperty("bookingId");
  expect(found?.context.documents[0]).not.toHaveProperty("sourceEmailId");
});

test("findAll returns every stored operation regardless of owner or delivery state", async () => {
  const first = anOperation();
  const second = withAllContainersDelivered(anOperation());

  await repository.save(first);
  await repository.save(second);

  const all = await repository.findAll();

  expect(all).toHaveLength(2);
  expect(all).toEqual(expect.arrayContaining([first, second]));
});

test("findAll on an empty collection returns an empty list", async () => {
  expect(await repository.findAll()).toEqual([]);
});
