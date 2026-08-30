import { expect, test } from "vitest";
import { createCreateComponentUseCase } from "../../src/application/use-cases/dashboard/create-component.use-case.js";
import type { Component, ComponentNode } from "../../src/domain/components/component.js";
import { InvalidComponentTreeError } from "../../src/domain/model/errors.js";
import { InMemoryComponentEventPublisher } from "../../src/infrastructure/adapters/outbound/events/in-memory-component-event-publisher.js";
import { InMemoryComponentRepository, aComponent } from "../support/component-fixtures.js";

const OPERATION_ID = "op-1";

function buildUseCase() {
  const componentRepository = new InMemoryComponentRepository();
  let next = 0;

  return {
    componentRepository,
    createComponent: createCreateComponentUseCase({
      componentRepository,
      idGenerator: {
        newId: () => {
          next += 1;
          return `component-${next}`;
        },
      },
      eventPublisher: new InMemoryComponentEventPublisher(),
    }),
  };
}

function aRequest() {
  return {
    operationId: OPERATION_ID,
    kind: "container" as const,
    size: "small" as const,
    children: [{ kind: "title" as const, order: 0, props: { text: "Vessel ETA" } }],
  };
}

test("the first component of an operation opens the sequence", async () => {
  const { createComponent } = buildUseCase();

  expect((await createComponent(aRequest())).order).toBe(0);
});

test("a new component lands after the last of its siblings", async () => {
  const { componentRepository, createComponent } = buildUseCase();
  await componentRepository.save(aComponent({ operationId: OPERATION_ID, order: 4 }));

  expect((await createComponent(aRequest())).order).toBe(5);
});

/**
 * Components written before `order` existed are still in the collection. One of
 * them used to turn the running maximum into NaN, and from then on every new
 * component was born with `order: NaN` — the defect spreads forward.
 */
test("a sibling with no order does not poison the sequence", async () => {
  const { componentRepository, createComponent } = buildUseCase();
  const { order: _absent, ...legacy } = aComponent({ operationId: OPERATION_ID });
  await componentRepository.save(legacy as Component);

  expect(Number.isFinite((await createComponent(aRequest())).order)).toBe(true);
});

test("an invalid tree is rejected before anything is stored", async () => {
  const { componentRepository, createComponent } = buildUseCase();
  const unknownKind = [{ kind: "sparkline", order: 0, props: {} }] as unknown as ComponentNode[];

  await expect(createComponent({ ...aRequest(), children: unknownKind })).rejects.toThrow(
    InvalidComponentTreeError,
  );
  expect(await componentRepository.findByOperationId(OPERATION_ID)).toHaveLength(0);
});
