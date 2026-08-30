import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { anOperation } from "../support/operation-fixtures.js";

let app: FastifyInstance;
let operationRepository: InMemoryOperationRepository;
let companyRepository: InMemoryCompanyRepository;

beforeEach(async () => {
  operationRepository = new InMemoryOperationRepository();
  companyRepository = new InMemoryCompanyRepository();
  app = await createApp({ operationRepository, companyRepository });
});

afterEach(async () => {
  await app.close();
});

test("an empty database answers with an empty operations list", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: {},
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ operations: [] });
});

test("the endpoint exposes the whole aggregate with its derived status", async () => {
  const operation = anOperation();
  await operationRepository.save(operation);

  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: {},
  });

  expect(response.statusCode).toBe(200);

  const body = response.json();
  const [listed] = body.operations;

  expect(body.operations).toHaveLength(1);
  expect(listed.id).toBe(operation.id);
  expect(listed.company_ids).toEqual(operation.bookings[0]?.companyIds);
  expect(listed.status).toBe("in_transit");
  expect(listed.created_at).toBe(operation.createdAt.toISOString());
  expect(listed.bookings[0].vessel).toBe("Ever Given");
  expect(listed.bookings[0].schedule.etaCurrent).toBe(
    operation.bookings[0]?.schedule.etaCurrent.toISOString(),
  );
  expect(listed.bookings[0].containers).toHaveLength(1);
  expect(listed.context.emails[0].messageId).toBe("email-1");
  expect(listed.context.documents[0].type).toBe("BillOfLading");
  expect(listed.context.documents[0].format).toBe("pdf");
  expect(listed.context.documents[0].bucketKey).toBe("operations/op-1/bl-001.pdf");
  expect(listed.context.documents[0].extractedData).toEqual({ weightKg: 18500 });
});

/* ---------------------------------------------------------------------------
 * POST /api/operations/search
 * ------------------------------------------------------------------------ */

test("searching with an empty body lists everything", async () => {
  await operationRepository.save(anOperation());
  await operationRepository.save(anOperation());

  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: {},
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().operations).toHaveLength(2);
});

test("searching by free text narrows the list", async () => {
  await operationRepository.save(anOperation({ id: "op-andes-textiles-001" }));
  await operationRepository.save(anOperation({ id: "op-cafe-del-valle-001" }));

  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: { search: "andes" },
  });

  expect(response.json().operations.map((o: { id: string }) => o.id)).toEqual([
    "op-andes-textiles-001",
  ]);
});

test("searching sorts by the requested field and direction", async () => {
  await operationRepository.save(anOperation({ id: "op-b" }));
  await operationRepository.save(anOperation({ id: "op-a" }));

  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: { sort_by: "id", sort_dir: "asc" },
  });

  expect(response.json().operations.map((o: { id: string }) => o.id)).toEqual(["op-a", "op-b"]);
});

test("an unknown sort field is rejected instead of silently ignored", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: { sort_by: "whatever" },
  });

  expect(response.statusCode).toBe(400);
});

test("date cannot be combined with from/to, same as the GET", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations/search",
    payload: { date: "2026-07-01", from: "2026-07-01" },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json().error).toBe("invalid_filter_combination");
});
