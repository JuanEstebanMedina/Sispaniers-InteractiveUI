import { expect, test } from "vitest";
import { createUpdateOperationLayoutUseCase } from "../../src/application/use-cases/dashboard/update-operation-layout.use-case.js";
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
    updateOperationLayout: createUpdateOperationLayoutUseCase({
      operationRepository,
      componentRepository,
      operationLayoutRepository,
    }),
  };
}

test("an unknown operation is a not-found error", async () => {
  const { updateOperationLayout } = await buildUseCase();

  await expect(
    updateOperationLayout({ operationId: "missing", cols: 4, layout: [] }),
  ).rejects.toThrow(OperationNotFoundError);
});

test("the stored size fills in the dimensions the client never sends", async () => {
  const { operation, componentRepository, updateOperationLayout } = await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "wide" }));

  const result = await updateOperationLayout({
    operationId: operation.id,
    cols: 4,
    layout: [{ id: "a", col: 0, row: 1 }],
  });

  expect(result.layout).toEqual([{ id: "a", col: 0, row: 1, w: 4, h: 2 }]);
});

test("a position for an unknown component is dropped instead of failing the request", async () => {
  const { operation, componentRepository, updateOperationLayout } = await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "small" }));

  const result = await updateOperationLayout({
    operationId: operation.id,
    cols: 4,
    layout: [
      { id: "a", col: 0, row: 0 },
      { id: "ghost", col: 2, row: 0 },
    ],
  });

  expect(result.layout).toEqual([{ id: "a", col: 0, row: 0, w: 2, h: 2 }]);
});

test("the projected layout is what gets persisted for that breakpoint", async () => {
  const { operation, componentRepository, operationLayoutRepository, updateOperationLayout } =
    await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "wide" }));

  await updateOperationLayout({
    operationId: operation.id,
    cols: 4,
    layout: [{ id: "a", col: 0, row: 3 }],
  });

  const stored = await operationLayoutRepository.findByOperationId(operation.id);

  expect(stored?.breakpoints).toEqual([
    { cols: 4, layout: [{ id: "a", col: 0, row: 3, w: 4, h: 2 }] },
  ]);
});

test("saving one breakpoint leaves the others untouched", async () => {
  const { operation, componentRepository, operationLayoutRepository, updateOperationLayout } =
    await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, size: "small" }));
  await operationLayoutRepository.saveBreakpoint(operation.id, {
    cols: 8,
    layout: [{ id: "a", col: 6, row: 0, w: 2, h: 2 }],
  });

  await updateOperationLayout({
    operationId: operation.id,
    cols: 4,
    layout: [{ id: "a", col: 0, row: 0 }],
  });

  const stored = await operationLayoutRepository.findByOperationId(operation.id);

  expect(stored?.breakpoints).toHaveLength(2);
  expect(stored?.breakpoints).toContainEqual({
    cols: 8,
    layout: [{ id: "a", col: 6, row: 0, w: 2, h: 2 }],
  });
});
