import { expect, test } from "vitest";
import { toComponentWireShape } from "../../src/infrastructure/adapters/inbound/http/mappers/component.mapper.js";
import { aComponent } from "../support/component-fixtures.js";

test("a renamed component carries its title to the client", async () => {
  const wire = toComponentWireShape(aComponent({ title: "ETA del buque" }));

  expect(wire.title).toBe("ETA del buque");
});

test("a component the user never renamed omits the title instead of sending an empty one", async () => {
  const wire = toComponentWireShape(aComponent());

  expect("title" in wire).toBe(false);
});
