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

test("a component wider than the grid is narrowed instead of disappearing", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "wide", operationId: operation.id, size: "wide", order: 0 }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 2 });

  expect(result.components).toHaveLength(1);
  expect(result.layout).toEqual([{ id: "wide", col: 0, row: 0, w: 2, h: 2 }]);
});

test("components sharing an order fall back to when they were created", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(
    aComponent({
      id: "later",
      operationId: operation.id,
      order: 0,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    }),
  );
  await componentRepository.save(
    aComponent({
      id: "earlier",
      operationId: operation.id,
      order: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.components.map((component) => component.id)).toEqual(["earlier", "later"]);
});
