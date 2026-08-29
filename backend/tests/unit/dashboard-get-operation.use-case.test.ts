import { expect, test } from "vitest";
import { createGetOperationUseCase } from "../../src/application/use-cases/dashboard/get-operation.use-case.js";
import { OperationNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { anOperation } from "../support/operation-fixtures.js";

test("a stored operation comes back with its derived status", async () => {
  const operationRepository = new InMemoryOperationRepository();
  const operation = anOperation();
  await operationRepository.save(operation);

  const getOperation = createGetOperationUseCase({ operationRepository });

  expect(await getOperation({ id: operation.id })).toEqual({ operation, status: "in_transit" });
});

test("an unknown id is a not-found error, never a null result", async () => {
  const getOperation = createGetOperationUseCase({
    operationRepository: new InMemoryOperationRepository(),
  });

  await expect(getOperation({ id: "missing" })).rejects.toThrow(OperationNotFoundError);
});
