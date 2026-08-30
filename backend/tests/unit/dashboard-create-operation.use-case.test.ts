import { expect, test } from "vitest";
import { createCreateCompanyUseCase } from "../../src/application/use-cases/dashboard/create-company.use-case.js";
import { createCreateOperationUseCase } from "../../src/application/use-cases/dashboard/create-operation.use-case.js";
import { createResolveCompanyUseCase } from "../../src/application/use-cases/shared/resolve-company.use-case.js";
import { CompanyNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-operation-event-publisher.js";
import { InMemoryCompanyRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-company-repository.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { aCompany } from "../support/operation-fixtures.js";

async function useCaseOver(
  operationRepository: InMemoryOperationRepository,
  companyRepository: InMemoryCompanyRepository = new InMemoryCompanyRepository(),
) {
  await companyRepository.save(aCompany({ id: "company-1" }));

  const idGenerator = { newId: () => "op-1" };
  const operationEventPublisher = new InMemoryOperationEventPublisher();
  const createCompany = createCreateCompanyUseCase({ companyRepository, idGenerator });
  const resolveCompany = createResolveCompanyUseCase({ companyRepository, createCompany });

  return createCreateOperationUseCase({
    operationRepository,
    resolveCompany,
    idGenerator,
    operationEventPublisher,
  });
}

test("a new operation is persisted empty and readable back by its generated id", async () => {
  const operationRepository = new InMemoryOperationRepository();

  const createOperation = await useCaseOver(operationRepository);
  const { operation } = await createOperation({ companyId: "company-1" });

  expect(operation.id).toBe("op-1");
  expect(operation.bookings).toEqual([]);
  expect(operation.context).toEqual({ emails: [], documents: [] });
  expect(await operationRepository.findById("op-1")).toEqual(operation);
});

test("the new operation records the company that owns it", async () => {
  const createOperation = await useCaseOver(new InMemoryOperationRepository());
  const { operation } = await createOperation({ companyId: "company-1" });

  expect(operation.companyId).toBe("company-1");
});

test("creating an operation leaves the company document untouched", async () => {
  const companyRepository = new InMemoryCompanyRepository();

  const createOperation = await useCaseOver(new InMemoryOperationRepository(), companyRepository);
  const before = await companyRepository.findById("company-1");
  await createOperation({ companyId: "company-1" });

  expect(await companyRepository.findById("company-1")).toEqual(before);
});

test("an unknown company is rejected and nothing is persisted", async () => {
  const operationRepository = new InMemoryOperationRepository();

  const createOperation = await useCaseOver(operationRepository);

  await expect(createOperation({ companyId: "ghost" })).rejects.toThrow(CompanyNotFoundError);
  expect(await operationRepository.findAll()).toEqual([]);
});

test("health defaults to ok when the caller does not say otherwise", async () => {
  const createOperation = await useCaseOver(new InMemoryOperationRepository());

  const { operation } = await createOperation({ companyId: "company-1" });

  expect(operation.health).toBe("ok");
});

test("an explicit health is kept", async () => {
  const createOperation = await useCaseOver(new InMemoryOperationRepository());

  const { operation } = await createOperation({ companyId: "company-1", health: "warning" });

  expect(operation.health).toBe("warning");
});

test("an operation with no containers yet reports the earliest status", async () => {
  const createOperation = await useCaseOver(new InMemoryOperationRepository());

  const { status } = await createOperation({ companyId: "company-1" });

  expect(status).toBe("booking_confirmed");
});
