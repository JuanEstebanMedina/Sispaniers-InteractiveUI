import { expect, test } from "vitest";
import { createUpdateComponentCommand } from "../../src/application/commands/update-component.command.js";
import { createUpdateComponentContentUseCase } from "../../src/application/use-cases/dashboard/update-component-content.use-case.js";
import { createUpdateComponentPlacementUseCase } from "../../src/application/use-cases/dashboard/update-component-placement.use-case.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import { InMemoryComponentEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";

/**
 * Editing a widget's content is not a request to resize it. The tool used to
 * take a `layout` and derive a size from it, which turned "fix the ETA on that
 * panel" into a silent reflow of the board around it.
 */
test("update_component leaves the component's size untouched", async () => {
  const componentRepository = new InMemoryComponentRepository();
  const component = aComponent({ operationId: "op-1" });
  await componentRepository.save(component);
  const operationRepository = {
    findById: async () => ({ id: "op-1" }) as unknown as Operation,
    findAll: async () => [],
    save: async () => {},
  };
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: new InMemoryComponentEventPublisher(),
  });
  const command = createUpdateComponentCommand({
    updateComponentContent,
    updateComponentPlacement: createUpdateComponentPlacementUseCase({
      operationRepository,
      componentRepository,
    }),
  });

  await command.execute(
    {
      componentId: component.id,
      children: [{ kind: "title", order: 0, props: { text: "Nuevo ETA" } }],
      reply: "Actualizado",
    },
    { operationId: "op-1" },
  );

  expect(await componentRepository.findById(component.id)).toMatchObject({
    size: component.size,
    children: [{ kind: "title", props: { text: "Nuevo ETA" } }],
  });
});

test("update_component resizes and moves one component while reordering siblings", async () => {
  const componentRepository = new InMemoryComponentRepository();
  const first = aComponent({ id: "first", operationId: "op-1", order: 0 });
  const second = aComponent({ id: "second", operationId: "op-1", order: 1 });
  await componentRepository.save(first);
  await componentRepository.save(second);
  const operationRepository = {
    findById: async () => ({ id: "op-1" }) as unknown as Operation,
    findAll: async () => [],
    save: async () => {},
  };
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository,
    componentRepository,
    eventPublisher: new InMemoryComponentEventPublisher(),
  });
  const command = createUpdateComponentCommand({
    updateComponentContent,
    updateComponentPlacement: createUpdateComponentPlacementUseCase({
      operationRepository,
      componentRepository,
    }),
  });

  await command.execute(
    {
      componentId: "second",
      layout: { cols: 4, rows: 2 },
      position: 0,
      reply: "Movido y redimensionado",
    },
    { operationId: "op-1" },
  );

  expect(await componentRepository.findById("second")).toMatchObject({ size: "wide", order: 0 });
  expect(await componentRepository.findById("first")).toMatchObject({ order: 1 });
});
