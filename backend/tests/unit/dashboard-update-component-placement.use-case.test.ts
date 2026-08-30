import { expect, test } from "vitest";
import { createUpdateComponentPlacementUseCase } from "../../src/application/use-cases/dashboard/update-component-placement.use-case.js";
import { ComponentNotFoundError, OperationNotFoundError } from "../../src/domain/model/errors.js";
import { InMemoryOperationRepository } from "../../src/infrastructure/adapters/outbound/logistics/in-memory-operation-repository.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";
import { anOperation } from "../support/operation-fixtures.js";

async function buildUseCase(componentIds: string[] = []) {
  const operationRepository = new InMemoryOperationRepository();
  const componentRepository = new InMemoryComponentRepository();
  const operation = anOperation();
  await operationRepository.save(operation);

  for (const [index, id] of componentIds.entries()) {
    await componentRepository.save(aComponent({ id, operationId: operation.id, order: index }));
  }

  async function orderedIds(): Promise<string[]> {
    const components = await componentRepository.findByOperationId(operation.id);
    return [...components].sort((a, b) => a.order - b.order).map((component) => component.id);
  }

  return {
    operation,
    componentRepository,
    orderedIds,
    updateComponentPlacement: createUpdateComponentPlacementUseCase({
      operationRepository,
      componentRepository,
    }),
  };
}

test("an unknown operation is a not-found error", async () => {
  const { updateComponentPlacement } = await buildUseCase();

  await expect(
    updateComponentPlacement({ operationId: "missing", componentId: "a", position: 0 }),
  ).rejects.toThrow(OperationNotFoundError);
});

test("a component belonging to another operation cannot be moved through this one", async () => {
  const { operation, componentRepository, updateComponentPlacement } = await buildUseCase();
  await componentRepository.save(aComponent({ id: "foreign", operationId: "another" }));

  await expect(
    updateComponentPlacement({
      operationId: operation.id,
      componentId: "foreign",
      position: 0,
    }),
  ).rejects.toThrow(ComponentNotFoundError);
});

test("moving a component later pulls the ones it passed forward", async () => {
  const { operation, orderedIds, updateComponentPlacement } = await buildUseCase(["a", "b", "c"]);

  await updateComponentPlacement({ operationId: operation.id, componentId: "a", position: 2 });

  expect(await orderedIds()).toEqual(["b", "c", "a"]);
});

test("moving a component earlier pushes the ones it displaced back", async () => {
  const { operation, orderedIds, updateComponentPlacement } = await buildUseCase(["a", "b", "c"]);

  await updateComponentPlacement({ operationId: operation.id, componentId: "c", position: 0 });

  expect(await orderedIds()).toEqual(["c", "a", "b"]);
});

test("the resulting order is always dense, so no gap survives a move", async () => {
  const { operation, componentRepository, updateComponentPlacement } = await buildUseCase();
  await componentRepository.save(aComponent({ id: "a", operationId: operation.id, order: 5 }));
  await componentRepository.save(aComponent({ id: "b", operationId: operation.id, order: 40 }));

  await updateComponentPlacement({ operationId: operation.id, componentId: "b", position: 0 });

  const components = await componentRepository.findByOperationId(operation.id);
  expect([...components].map((component) => component.order).sort()).toEqual([0, 1]);
});

test("a position past the end lands the component last instead of failing", async () => {
  const { operation, orderedIds, updateComponentPlacement } = await buildUseCase(["a", "b"]);

  await updateComponentPlacement({ operationId: operation.id, componentId: "a", position: 99 });

  expect(await orderedIds()).toEqual(["b", "a"]);
});

test("a title renames the component without touching the order", async () => {
  const { operation, componentRepository, orderedIds, updateComponentPlacement } =
    await buildUseCase(["a", "b"]);

  const updated = await updateComponentPlacement({
    operationId: operation.id,
    componentId: "b",
    title: "Vessel delay",
  });

  expect(updated.title).toBe("Vessel delay");
  expect((await componentRepository.findById("b"))?.title).toBe("Vessel delay");
  expect(await orderedIds()).toEqual(["a", "b"]);
});

test("an empty title clears the rename instead of storing a blank one", async () => {
  const { operation, componentRepository, updateComponentPlacement } = await buildUseCase();
  await componentRepository.save(
    aComponent({ id: "a", operationId: operation.id, order: 0, title: "Old" }),
  );

  await updateComponentPlacement({ operationId: operation.id, componentId: "a", title: "" });

  expect((await componentRepository.findById("a"))?.title).toBeUndefined();
});
