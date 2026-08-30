import { expect, test } from "vitest";
import { createSendEmailUseCase } from "../../src/application/use-cases/email/send-email.use-case.js";
import { CompanyDisabledError, EmailSendError } from "../../src/domain/model/errors.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { FakeEmailSender } from "../support/fakes.js";
import { aCompany } from "../support/operation-fixtures.js";

const input = {
  runId: "run-1",
  to: "cliente@example.com",
  subject: "Actualizacion de tu embarque",
  bodyText: "Su embarque va en camino.",
};

function useCaseOver(companyRepository = new InMemoryCompanyRepository()) {
  const emailSender = new FakeEmailSender();
  return {
    emailSender,
    companyRepository,
    sendEmail: createSendEmailUseCase({
      emailSender,
      idGenerator: { newId: () => "id-1" },
      companyRepository,
    }),
  };
}

test("sends the email and returns a generated email id", async () => {
  const { sendEmail, emailSender } = useCaseOver();

  const result = await sendEmail(input);

  expect(result.emailId).toBe("id-1");
  expect(result.providerMessageId).toBe("fake-1");
  expect(emailSender.sent).toHaveLength(1);
});

test("wraps a sender failure in EmailSendError", async () => {
  const { sendEmail, emailSender } = useCaseOver();
  emailSender.failWith = new Error("SMTP connection refused");

  await expect(sendEmail(input)).rejects.toThrow(EmailSendError);
});

test("blocks sending to a disabled company's contact email", async () => {
  const companyRepository = new InMemoryCompanyRepository();
  await companyRepository.save(aCompany({ contactEmails: ["cliente@example.com"], active: false }));
  const { sendEmail, emailSender } = useCaseOver(companyRepository);

  await expect(sendEmail(input)).rejects.toThrow(CompanyDisabledError);
  expect(emailSender.sent).toHaveLength(0);
});

test("an active company's contact email sends normally", async () => {
  const companyRepository = new InMemoryCompanyRepository();
  await companyRepository.save(aCompany({ contactEmails: ["cliente@example.com"], active: true }));
  const { sendEmail, emailSender } = useCaseOver(companyRepository);

  await sendEmail(input);

  expect(emailSender.sent).toHaveLength(1);
});

test("an address that matches no company sends normally", async () => {
  const { sendEmail, emailSender } = useCaseOver();

  await sendEmail(input);

  expect(emailSender.sent).toHaveLength(1);
});
