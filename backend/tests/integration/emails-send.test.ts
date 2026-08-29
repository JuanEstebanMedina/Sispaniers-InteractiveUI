import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createApp } from "../../src/infrastructure/config/composition.js";
import { FakeEmailSender } from "../support/fakes.js";

let app: FastifyInstance;
let emailSender: FakeEmailSender;

beforeEach(() => {
  emailSender = new FakeEmailSender();
  app = createApp({ emailSender });
});

afterEach(async () => {
  await app.close();
});

test("a successful send returns 201 with an email_id", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/emails/send",
    payload: {
      run_id: "run-1",
      to: "cliente@example.com",
      subject: "Actualizacion de tu embarque",
      body_text: "Su embarque va en camino.",
    },
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().status).toBe("sent");
  expect(typeof response.json().email_id).toBe("string");
  expect(emailSender.sent).toHaveLength(1);
});

test("an SMTP failure returns 502 with a clear message, not a generic 500", async () => {
  emailSender.failWith = new Error("SMTP connection refused");

  const response = await app.inject({
    method: "POST",
    url: "/api/emails/send",
    payload: { run_id: "run-1", to: "cliente@example.com", subject: "s", body_text: "b" },
  });

  expect(response.statusCode).toBe(502);
  expect(response.json().message).toContain("SMTP connection refused");
});
