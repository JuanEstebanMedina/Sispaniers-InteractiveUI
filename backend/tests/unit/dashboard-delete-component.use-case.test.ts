import { expect, test } from "vitest";
import { createDeleteComponentUseCase } from "../../src/application/use-cases/dashboard/delete-component.use-case.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";
import { anOperation } from "../support/operation-fixtures.js";

async function buildUseCase() {
  const operationRepository = new InMemoryOperationRepository();
  const componentRepository = new InMemoryComponentRepository();
  const operation = anOperation();
  await operationRepository.save(operation);

  return {
    operation,
    componentRepository,
    deleteComponent: createDeleteComponentUseCase({ operationRepository, componentRepository }),
  };
}

test("an unknown operation is a not-found error", async () => {
  const { deleteComponent } = await buildUseCase();

  await expect(deleteComponent({ operationId: "missing", componentId: "a" })).rejects.toThrow(
    OperationNotFoundError,
  );
});

test("an unknown component is a not-found error", async () => {
  const { operation, deleteComponent } = await buildUseCase();

  await expect(
    deleteComponent({ operationId: operation.id, componentId: "missing" }),
  ).rejects.toThrow(ComponentNotFoundError);
});

test("a component belonging to another operation cannot be deleted through this one", async () => {
  const { operation, componentRepository, deleteComponent } = await buildUseCase();
  const foreign = aComponent({ id: "foreign", operationId: "another-operation" });
  await componentRepository.save(foreign);

  await expect(
    deleteComponent({ operationId: operation.id, componentId: foreign.id }),
  ).rejects.toThrow(ComponentNotFoundError);

  expect(await componentRepository.findById(foreign.id)).not.toBeNull();
});

test("deleting a component removes it from the repository", async () => {
  const { operation, componentRepository, deleteComponent } = await buildUseCase();
  const component = aComponent({ id: "a", operationId: operation.id });
  await componentRepository.save(component);

  await deleteComponent({ operationId: operation.id, componentId: component.id });

  expect(await componentRepository.findById(component.id)).toBeNull();
});
