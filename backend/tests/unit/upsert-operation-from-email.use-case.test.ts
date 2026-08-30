import { expect, test } from "vitest";
import { createCreateCompanyUseCase } from "../../src/application/use-cases/dashboard/create-company.use-case.js";
import {
  createUpsertOperationFromEmailUseCase,
  extractCompanyInfoFromBody,
  extractOperationIdFromSubject,
} from "../../src/application/use-cases/email/upsert-operation-from-email.use-case.js";
import { createResolveCompanyUseCase } from "../../src/application/use-cases/shared/resolve-company.use-case.js";
import type { NormalizedEmail } from "../../src/domain/model/email.js";
import { InMemoryOperationEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-operation-event-publisher.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";

function useCaseOver() {
  const operationRepository = new InMemoryOperationRepository();
  const companyRepository = new InMemoryCompanyRepository();
  let counter = 0;
  const idGenerator = { newId: () => `id-${++counter}` };
  const operationEventPublisher = new InMemoryOperationEventPublisher();
  const createCompany = createCreateCompanyUseCase({ companyRepository, idGenerator });
  const resolveCompany = createResolveCompanyUseCase({ companyRepository, createCompany });

  return {
    operationRepository,
    companyRepository,
    upsertOperationFromEmail: createUpsertOperationFromEmailUseCase({
      operationRepository,
      resolveCompany,
      idGenerator,
      operationEventPublisher,
    }),
  };
}

function anEmail(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    source: "make",
    messageId: "email-1",
    from: "docs@supplier.co",
    subject: "Orden de compra #OP-1",
    receivedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

test("extractCompanyInfoFromBody reads a labelled Compañía/Contacto block", () => {
  const info = extractCompanyInfoFromBody(
    "Orden de compra #OP-1\nCompañía: Andes Textiles\nContacto: ops@andestextiles.co\n",
  );

  expect(info).toEqual({ name: "Andes Textiles", contactEmails: ["ops@andestextiles.co"] });
});

test("extractCompanyInfoFromBody accepts the English Company/Contact spelling", () => {
  const info = extractCompanyInfoFromBody("Company: Andes Textiles\nContact: ops@andestextiles.co");

  expect(info).toEqual({ name: "Andes Textiles", contactEmails: ["ops@andestextiles.co"] });
});

test("extractCompanyInfoFromBody without a contact line reports no contact emails", () => {
  const info = extractCompanyInfoFromBody("Compañía: Andes Textiles");

  expect(info).toEqual({ name: "Andes Textiles", contactEmails: [] });
});

test("extractCompanyInfoFromBody with no matching line returns undefined", () => {
  expect(extractCompanyInfoFromBody("just a regular email body")).toBeUndefined();
  expect(extractCompanyInfoFromBody(undefined)).toBeUndefined();
});

test("a new operation with a company line gets linked, using the parsed contact", async () => {
  const { upsertOperationFromEmail, operationRepository, companyRepository } = useCaseOver();

  const result = await upsertOperationFromEmail({
    email: anEmail({ bodyText: "Compañía: Andes Textiles\nContacto: ops@andestextiles.co" }),
    attachments: [],
  });

  expect(result?.created).toBe(true);
  expect(result?.companyId).toBeDefined();

  const operation = await operationRepository.findById("OP-1");
  expect(operation?.companyId).toBe(result?.companyId);

  const company = await companyRepository.findByName("Andes Textiles");
  expect(company?.contactEmails).toEqual(["ops@andestextiles.co"]);
});

test("a company line without a contact falls back to the sender's address", async () => {
  const { upsertOperationFromEmail, companyRepository } = useCaseOver();

  await upsertOperationFromEmail({
    email: anEmail({ bodyText: "Compañía: Andes Textiles", from: "docs@andestextiles.co" }),
    attachments: [],
  });

  const company = await companyRepository.findByName("Andes Textiles");
  expect(company?.contactEmails).toEqual(["docs@andestextiles.co"]);
});

test("a new operation with no company line stays companyless", async () => {
  const { upsertOperationFromEmail, operationRepository } = useCaseOver();

  const result = await upsertOperationFromEmail({
    email: anEmail({ bodyText: "no company info here" }),
    attachments: [],
  });

  expect(result?.companyId).toBeUndefined();
  const operation = await operationRepository.findById("OP-1");
  expect(operation?.companyId).toBeUndefined();
});

test("a company line on a later email to an existing operation does not overwrite the link", async () => {
  const { upsertOperationFromEmail, operationRepository } = useCaseOver();

  await upsertOperationFromEmail({
    email: anEmail({ messageId: "email-1", bodyText: "no company info here" }),
    attachments: [],
  });

  await upsertOperationFromEmail({
    email: anEmail({ messageId: "email-2", bodyText: "Compañía: Late Arrival Co" }),
    attachments: [],
  });

  const operation = await operationRepository.findById("OP-1");
  expect(operation?.companyId).toBeUndefined();
});

test("extractOperationIdFromSubject still recognizes the existing pattern", () => {
  expect(extractOperationIdFromSubject("Re: Orden de compra #OP-42")).toBe("OP-42");
  expect(extractOperationIdFromSubject("no id here")).toBeUndefined();
});
