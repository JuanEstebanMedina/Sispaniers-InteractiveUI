import { expect, test } from "vitest";
import { createUpdateComponentCommand } from "../../src/application/commands/update-component.command.js";
import { createUpdateComponentContentUseCase } from "../../src/application/use-cases/dashboard/update-component-content.use-case.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import { InMemoryComponentEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";

test("update_component persists its requested layout", async () => {
  const componentRepository = new InMemoryComponentRepository();
  const component = aComponent({ operationId: "op-1" });
  await componentRepository.save(component);
  const updateComponentContent = createUpdateComponentContentUseCase({
    operationRepository: {
      findById: async () => ({ id: "op-1" }) as unknown as Operation,
      findAll: async () => [],
      save: async () => {},
    },
    componentRepository,
    eventPublisher: new InMemoryComponentEventPublisher(),
  });
  const command = createUpdateComponentCommand({ updateComponentContent });

  await command.execute(
    {
      componentId: component.id,
      children: [{ kind: "title", order: 0, props: { text: "Nuevo ETA" } }],
      layout: { cols: 4, rows: 2 },
      reply: "Actualizado",
    },
    { operationId: "op-1" },
  );

  expect(await componentRepository.findById(component.id)).toMatchObject({
    size: "wide",
    children: [{ kind: "title", props: { text: "Nuevo ETA" } }],
  });
});
