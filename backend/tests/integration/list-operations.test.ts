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
  const response = await app.inject({ method: "GET", url: "/api/flows" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ flows: [] });
});

test("the endpoint exposes the whole aggregate with its derived status", async () => {
  const operation = anOperation();
  await operationRepository.save(operation);

  const response = await app.inject({ method: "GET", url: "/api/flows" });

  expect(response.statusCode).toBe(200);

  const body = response.json();
  const [listed] = body.flows;

  expect(body.flows).toHaveLength(1);
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
