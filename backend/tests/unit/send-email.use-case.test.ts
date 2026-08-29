import { expect, test } from "vitest";
import { createSendEmailUseCase } from "../../src/application/use-cases/email/send-email.use-case.js";
import { EmailSendError } from "../../src/domain/model/errors.js";
import { FakeEmailSender } from "../support/fakes.js";

const input = {
  runId: "run-1",
  to: "cliente@example.com",
  subject: "Actualizacion de tu embarque",
  bodyText: "Su embarque va en camino.",
};

test("sends the email and returns a generated email id", async () => {
  const emailSender = new FakeEmailSender();
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator: { newId: () => "id-1" } });

  const result = await sendEmail(input);

  expect(result.emailId).toBe("id-1");
  expect(result.providerMessageId).toBe("fake-1");
  expect(emailSender.sent).toHaveLength(1);
});

test("wraps a sender failure in EmailSendError", async () => {
  const emailSender = new FakeEmailSender();
  emailSender.failWith = new Error("SMTP connection refused");
  const sendEmail = createSendEmailUseCase({ emailSender, idGenerator: { newId: () => "id-1" } });

  await expect(sendEmail(input)).rejects.toThrow(EmailSendError);
});
