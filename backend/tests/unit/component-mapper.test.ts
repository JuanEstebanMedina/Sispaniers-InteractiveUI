import { expect, test } from "vitest";
import {
  type ComponentDocument,
  toComponent,
} from "../../src/infrastructure/adapters/outbound/mongo/component.mapper.js";
import { aComponent } from "../support/component-fixtures.js";

/**
 * Components written before `order` existed are still in the collection, and a
 * document with no `order` used to come back as `order: undefined` — which
 * poisons every arithmetic comparison downstream into NaN.
 */
function aLegacyDocument(): ComponentDocument {
  const { id, order: _absent, ...rest } = aComponent();

  return { _id: id, ...rest } as ComponentDocument;
}

test("a document written before order existed reads back as a number", () => {
  const component = toComponent(aLegacyDocument());

  expect(Number.isFinite(component.order)).toBe(true);
});

test("a stored order is preserved", () => {
  const { id, ...rest } = aComponent({ order: 7 });

  expect(toComponent({ _id: id, ...rest }).order).toBe(7);
});
