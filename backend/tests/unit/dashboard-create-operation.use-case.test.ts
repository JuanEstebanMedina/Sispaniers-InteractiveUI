import { expect, test } from "vitest";
import { createCreateOperationUseCase } from "../../src/application/use-cases/dashboard/create-operation.use-case.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";

function useCaseOver(operationRepository: InMemoryOperationRepository) {
  return createCreateOperationUseCase({
    operationRepository,
    idGenerator: { newId: () => "op-1" },
  });
}

test("a new operation is persisted empty and readable back by its generated id", async () => {
  const operationRepository = new InMemoryOperationRepository();

  const { operation } = await useCaseOver(operationRepository)({ clientId: "client-1" });

  expect(operation.id).toBe("op-1");
  expect(operation.clientId).toBe("client-1");
  expect(operation.bookings).toEqual([]);
  expect(operation.documents).toEqual([]);
  expect(await operationRepository.findById("op-1")).toEqual(operation);
});

test("health defaults to ok when the caller does not say otherwise", async () => {
  const { operation } = await useCaseOver(new InMemoryOperationRepository())({
    clientId: "client-1",
  });

  expect(operation.health).toBe("ok");
});

test("an explicit health is kept", async () => {
  const { operation } = await useCaseOver(new InMemoryOperationRepository())({
    clientId: "client-1",
    health: "warning",
  });

  expect(operation.health).toBe("warning");
});

test("an operation with no containers yet reports the earliest status", async () => {
  const { status } = await useCaseOver(new InMemoryOperationRepository())({
    clientId: "client-1",
  });

  expect(status).toBe("booking_confirmed");
});
