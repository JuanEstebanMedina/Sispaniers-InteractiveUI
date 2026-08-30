import { expect, test } from "vitest";
import { createGetOperationComponentsUseCase } from "../../src/application/use-cases/dashboard/get-operation-components.use-case.js";
import { OperationNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import {
  InMemoryComponentRepository,
  InMemoryOperationLayoutRepository,
  aComponent,
} from "../support/component-fixtures.js";
import { anOperation } from "../support/operation-fixtures.js";

async function buildUseCase() {
  const operationRepository = new InMemoryOperationRepository();
  const componentRepository = new InMemoryComponentRepository();
  const operationLayoutRepository = new InMemoryOperationLayoutRepository();
  const operation = anOperation();
  await operationRepository.save(operation);

  return {
    operation,
    componentRepository,
    operationLayoutRepository,
    getOperationComponents: createGetOperationComponentsUseCase({
      operationRepository,
      componentRepository,
      operationLayoutRepository,
    }),
  };
}

test("an unknown operation is a not-found error", async () => {
  const { getOperationComponents } = await buildUseCase();

  await expect(getOperationComponents({ operationId: "missing", cols: 4 })).rejects.toThrow(
    OperationNotFoundError,
  );
});

test("with no saved breakpoint the components are packed by default", async () => {
  const { operation, componentRepository, getOperationComponents } = await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "small" }));

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.components).toHaveLength(1);
  expect(result.layout).toEqual([{ id: "a", col: 0, row: 0, w: 2, h: 2 }]);
});

test("the saved breakpoint for the requested cols wins over the default packing", async () => {
  const { operation, componentRepository, operationLayoutRepository, getOperationComponents } =
    await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "small" }));
  await operationLayoutRepository.saveBreakpoint(operation.id, {
    cols: 4,
    layout: [{ id: "a", col: 2, row: 4, w: 2, h: 2 }],
  });

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.layout).toEqual([{ id: "a", col: 2, row: 4, w: 2, h: 2 }]);
});

test("a breakpoint saved for another cols value does not leak into this one", async () => {
  const { operation, componentRepository, operationLayoutRepository, getOperationComponents } =
    await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "small" }));
  await operationLayoutRepository.saveBreakpoint(operation.id, {
    cols: 8,
    layout: [{ id: "a", col: 6, row: 0, w: 2, h: 2 }],
  });

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.layout).toEqual([{ id: "a", col: 0, row: 0, w: 2, h: 2 }]);
});

test("a component deleted after the layout was saved leaves no orphan entry", async () => {
  const { operation, componentRepository, operationLayoutRepository, getOperationComponents } =
    await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "kept", operationId: operation.id, size: "small" }),
  );
  await operationLayoutRepository.saveBreakpoint(operation.id, {
    cols: 4,
    layout: [
      { id: "kept", col: 0, row: 0, w: 2, h: 2 },
      { id: "gone", col: 2, row: 0, w: 2, h: 2 },
    ],
  });

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.layout).toEqual([{ id: "kept", col: 0, row: 0, w: 2, h: 2 }]);
});

test("a component created after the layout was saved is packed into free space", async () => {
  const { operation, componentRepository, operationLayoutRepository, getOperationComponents } =
    await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "old", operationId: operation.id, size: "wide" }),
  );
  await componentRepository.save(
    aComponent({ id: "new", operationId: operation.id, size: "small" }),
  );
  await operationLayoutRepository.saveBreakpoint(operation.id, {
    cols: 4,
    layout: [{ id: "old", col: 0, row: 0, w: 4, h: 2 }],
  });

  const result = await getOperationComponents({ operationId: operation.id, cols: 4 });

  expect(result.layout).toContainEqual({ id: "old", col: 0, row: 0, w: 4, h: 2 });
  expect(result.layout).toContainEqual({ id: "new", col: 0, row: 2, w: 2, h: 2 });
});
