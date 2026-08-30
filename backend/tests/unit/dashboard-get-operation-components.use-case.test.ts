import { expect, test } from "vitest";
import { createGetOperationComponentsUseCase } from "../../src/application/use-cases/dashboard/get-operation-components.use-case.js";
import { OperationNotFoundError } from "../../src/domain/model/errors.js";
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
    getOperationComponents: createGetOperationComponentsUseCase({
      operationRepository,
      componentRepository,
    }),
  };
}

test("an unknown operation is a not-found error", async () => {
  const { getOperationComponents } = await buildUseCase();

  await expect(getOperationComponents({ operationId: "missing", cols: 4 })).rejects.toThrow(
    OperationNotFoundError,
  );
});

test("a single component is packed at the origin", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "a", operationId: operation.id, size: "small", order: 0 }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.components).toHaveLength(1);
  expect(result.layout).toEqual([{ id: "a", col: 0, row: 0, w: 2, h: 2 }]);
});

test("the component order decides the layout, not the insertion order", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "second", operationId: operation.id, size: "small", order: 1 }),
  );
  await componentRepository.save(
    aComponent({ id: "first", operationId: operation.id, size: "small", order: 0 }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.components.map((component) => component.id)).toEqual(["first", "second"]);
  expect(result.layout).toEqual([
    { id: "first", col: 0, row: 0, w: 2, h: 2 },
    { id: "second", col: 2, row: 0, w: 2, h: 2 },
  ]);
});

test("the same order packs differently for a narrower grid", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "a", operationId: operation.id, size: "small", order: 0 }),
  );
  await componentRepository.save(
    aComponent({ id: "b", operationId: operation.id, size: "small", order: 1 }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 2 });

  expect(result.layout).toEqual([
    { id: "a", col: 0, row: 0, w: 2, h: 2 },
    { id: "b", col: 0, row: 2, w: 2, h: 2 },
  ]);
});

test("a component wider than the grid is left out of the layout", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "wide", operationId: operation.id, size: "wide", order: 0 }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 2 });

  expect(result.components).toHaveLength(1);
  expect(result.layout).toEqual([]);
});
