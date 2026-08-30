import { expect, test } from "vitest";
import { createUpdateComponentCommand } from "../../src/application/commands/update-component.command.js";
import { createUpdateComponentContentUseCase } from "../../src/application/use-cases/dashboard/update-component-content.use-case.js";
import type { Operation } from "../../src/domain/logistics/operation.js";
import { InMemoryComponentEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";

/**
 * Rewording an email used to mean regenerating the whole widget, because
 * `children` was the only way the tool could write. A model regenerating from
 * memory drifts: it dropped the title, blanked the recipient, translated the
 * subject. A narrow edit removes the opportunity rather than forbidding it.
 */
async function commandOver(component = anEmailComponent()) {
  const componentRepository = new InMemoryComponentRepository();
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

  return {
    component,
    componentRepository,
    command: createUpdateComponentCommand({
      updateComponentContent,
      // A narrow edit never resizes or moves, so reaching placement at all
      // would be the defect these tests exist to catch.
      updateComponentPlacement: async () => {
        throw new Error("a content edit must not touch placement");
      },
    }),
  };
}

function anEmailComponent() {
  return aComponent({
    operationId: "op-1",
    children: [
      { kind: "title", order: 0, props: { text: "Notify the carrier" } },
      {
        kind: "email-action",
        order: 1,
        props: { to: "ops@carrier.co", subject: "Booking BK-1", body: "Please confirm." },
      },
    ],
  });
}

test("a path edit rewrites one field and leaves every other node and prop alone", async () => {
  const { command, component, componentRepository } = await commandOver();

  await command.execute(
    {
      componentId: component.id,
      path: "children.1.props.body",
      value: "Please confirm at your earliest convenience.",
      reply: "Reworded the message.",
    },
    { operationId: "op-1" },
  );

  expect(await componentRepository.findById(component.id)).toMatchObject({
    children: [
      { kind: "title", props: { text: "Notify the carrier" } },
      {
        kind: "email-action",
        props: {
          to: "ops@carrier.co",
          subject: "Booking BK-1",
          body: "Please confirm at your earliest convenience.",
        },
      },
    ],
  });
});

test("a path that names no existing field is rejected instead of inventing one", async () => {
  const { command, component } = await commandOver();

  await expect(
    command.execute(
      {
        componentId: component.id,
        path: "children.1.props.cc",
        value: "boss@carrier.co",
        reply: "Added a copy.",
      },
      { operationId: "op-1" },
    ),
  ).rejects.toThrow();
});

test("an edit that names neither a path nor a whole tree is rejected", async () => {
  const { command, component } = await commandOver();

  await expect(
    command.execute({ componentId: component.id, reply: "Done." }, { operationId: "op-1" }),
  ).rejects.toThrow();
});

test("an edit that names both a path and a whole tree is rejected as ambiguous", async () => {
  const { command, component } = await commandOver();

  await expect(
    command.execute(
      {
        componentId: component.id,
        path: "children.1.props.body",
        value: "Reworded.",
        children: [{ kind: "title", order: 0, props: { text: "Notify the carrier" } }],
        reply: "Done.",
      },
      { operationId: "op-1" },
    ),
  ).rejects.toThrow();
});
