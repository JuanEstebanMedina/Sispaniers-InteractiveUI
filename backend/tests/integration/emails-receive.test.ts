import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { FakeAttachmentStorage, FakeEmailSender } from "../support/fakes.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await createApp({
    emailSender: new FakeEmailSender(),
    attachmentStorage: new FakeAttachmentStorage(),
    operationRepository: new InMemoryOperationRepository(),
  });
});

afterEach(async () => {
  await app.close();
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    source: "make",
    message_id: "msg-receive-1",
    from: "bookings@mscmed.com",
    to: "ari@mueblesdelsur.com",
    subject: "Booking Confirmation - MSC Vessel",
    received_at: "2026-08-29T14:30:00.000Z",
    body_text: "Booking confirmed.",
    ...overrides,
  };
}

test("a valid payload is accepted and returns a run_id", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/emails/receive",
    payload: validPayload(),
  });

  expect(response.statusCode).toBe(201);
  const body = response.json();
  expect(body.status).toBe("queued");
  expect(typeof body.run_id).toBe("string");
});

test("a payload missing message_id, from, subject or received_at returns 400 with readable details", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/emails/receive",
    payload: { source: "make", body_text: "no required fields here" },
  });

  expect(response.statusCode).toBe(400);
  const body = response.json();
  expect(body.error).toBe("validation_error");
  expect(Array.isArray(body.details)).toBe(true);
  expect(body.details.length).toBeGreaterThan(0);
});
