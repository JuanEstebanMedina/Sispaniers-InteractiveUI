import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { FakeAttachmentStorage } from "../support/fakes.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp({
    operationRepository: new InMemoryOperationRepository(),
    attachmentStorage: new FakeAttachmentStorage(),
  });
});

afterEach(async () => {
  await app.close();
});

test("health is reachable", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });
});
