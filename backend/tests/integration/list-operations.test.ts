import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { FakeOperationRepository } from "../support/fakes.js";
import { anOperation } from "../support/operation-fixtures.js";

let app: FastifyInstance;
let operationRepository: FakeOperationRepository;

beforeEach(async () => {
  operationRepository = new FakeOperationRepository();
  app = await createApp({ operationRepository });
});

afterEach(async () => {
  await app.close();
});

test("an empty database answers with an empty operations list", async () => {
  const response = await app.inject({ method: "GET", url: "/api/operations" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ operations: [] });
});

test("the endpoint exposes the whole aggregate with its derived status", async () => {
  const operation = anOperation();
  await operationRepository.save(operation);

  const response = await app.inject({ method: "GET", url: "/api/operations" });

  expect(response.statusCode).toBe(200);

  const body = response.json();
  const [listed] = body.operations;

  expect(body.operations).toHaveLength(1);
  expect(listed.id).toBe(operation.id);
  expect(listed.clientId).toBe(operation.clientId);
  expect(listed.status).toBe("in_transit");
  expect(listed.createdAt).toBe(operation.createdAt.toISOString());
  expect(listed.bookings[0].status).toBe("in_transit");
  expect(listed.bookings[0].vessel).toBe("Ever Given");
  expect(listed.bookings[0].schedule.etaCurrent).toBe(
    operation.bookings[0]?.schedule.etaCurrent.toISOString(),
  );
  expect(listed.bookings[0].containers).toHaveLength(1);
  expect(listed.documents[0].type).toBe("BillOfLading");
  expect(listed.documents[0].extractedData).toEqual({ weightKg: 18500 });
});
