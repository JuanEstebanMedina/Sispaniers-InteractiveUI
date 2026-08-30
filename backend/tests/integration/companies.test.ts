import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { FakeAttachmentStorage } from "../support/fakes.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp({
    operationRepository: new InMemoryOperationRepository(),
    companyRepository: new InMemoryCompanyRepository(),
    attachmentStorage: new FakeAttachmentStorage(),
  });
});

afterEach(async () => {
  await app.close();
});

test("GET /companies lists every created company", async () => {
  await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });
  await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Muebles del Sur" },
  });

  const response = await app.inject({ method: "GET", url: "/api/companies" });

  expect(response.statusCode).toBe(200);
  const names = response
    .json()
    .companies.map((company: { name: string }) => company.name)
    .sort();
  expect(names).toEqual(["Andes Textiles", "Muebles del Sur"]);
});

test("GET /companies on an empty repository returns an empty list", async () => {
  const response = await app.inject({ method: "GET", url: "/api/companies" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ companies: [] });
});

test("a new name creates a company", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles", contact_emails: ["ops@andestextiles.co"] },
  });

  expect(response.statusCode).toBe(201);
  const body = response.json();
  expect(body.name).toBe("Andes Textiles");
  expect(body.contact_emails).toEqual(["ops@andestextiles.co"]);
  expect(body.preferred_notification_channel).toBe("email");
  expect(typeof body.id).toBe("string");
});

test("posting the same name again returns the existing company instead of a duplicate", async () => {
  const first = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });

  const second = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "andes textiles" },
  });

  expect(second.statusCode).toBe(200);
  expect(second.json().id).toBe(first.json().id);
});

test("POST /operations accepts a company object and creates the company", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations",
    payload: { company: { name: "Nuevo Cliente" } },
  });

  expect(response.statusCode).toBe(201);
  const body = response.json();
  expect(body.company_ids).toHaveLength(1);

  const companies = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Nuevo Cliente" },
  });
  expect(companies.statusCode).toBe(200);
  expect(companies.json().id).toBe(body.company_ids[0]);
});

test("POST /operations rejects a body with both company_id and company", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations",
    payload: { company_id: "company-1", company: { name: "Nuevo Cliente" } },
  });

  expect(response.statusCode).toBe(400);
});

test("POST /operations rejects a body with neither company_id nor company", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/operations",
    payload: {},
  });

  expect(response.statusCode).toBe(400);
});

test("PATCH /companies/:id updates only the given fields", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/companies/${created.json().id}`,
    payload: { preferred_notification_channel: "slack" },
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.name).toBe("Andes Textiles");
  expect(body.preferred_notification_channel).toBe("slack");
});

test("PATCH /companies/:id on an unknown id returns 404", async () => {
  const response = await app.inject({
    method: "PATCH",
    url: "/api/companies/ghost",
    payload: { name: "Whatever" },
  });

  expect(response.statusCode).toBe(404);
});

test("PATCH /companies/:id rejects a rename that collides with another company", async () => {
  await app.inject({ method: "POST", url: "/api/companies", payload: { name: "Andes Textiles" } });
  const second = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Muebles del Sur" },
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/companies/${second.json().id}`,
    payload: { name: "andes textiles" },
  });

  expect(response.statusCode).toBe(409);
});

test("a newly created company is active", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });

  expect(response.json().active).toBe(true);
});

test("PATCH /companies/:id can disable a company without deleting it", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/companies/${created.json().id}`,
    payload: { active: false },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().active).toBe(false);
  expect(response.json().name).toBe("Andes Textiles");

  // Still there — disabling is not deleting.
  const list = await app.inject({ method: "GET", url: "/api/companies" });
  expect(list.json().companies).toHaveLength(1);
  expect(list.json().companies[0].active).toBe(false);
});

test("PATCH /companies/:id can re-enable a disabled company", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/companies",
    payload: { name: "Andes Textiles" },
  });
  await app.inject({
    method: "PATCH",
    url: `/api/companies/${created.json().id}`,
    payload: { active: false },
  });

  const response = await app.inject({
    method: "PATCH",
    url: `/api/companies/${created.json().id}`,
    payload: { active: true },
  });

  expect(response.json().active).toBe(true);
});
