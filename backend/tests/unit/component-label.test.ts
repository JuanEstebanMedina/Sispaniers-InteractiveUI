import { expect, test } from "vitest";
import { componentLabel } from "../../src/domain/components/component-label.js";
import { aComponent } from "../support/component-fixtures.js";

test("the user's own name wins over anything in the tree", () => {
  const component = aComponent({
    title: "Mi panel",
    children: [{ kind: "title", order: 0, props: { text: "Vessel ETA" } }],
  });

  expect(componentLabel(component)).toBe("Mi panel");
});

test("without a name, the first title node speaks for the component", () => {
  const component = aComponent({
    children: [
      { kind: "stat", order: 1, props: { value: 12 } },
      { kind: "title", order: 0, props: { text: "Vessel ETA" } },
    ],
  });

  expect(componentLabel(component)).toBe("Vessel ETA");
});

/**
 * The agent is free to nest its title inside a layout, and a component the
 * model cannot name is a component the user cannot ask about.
 */
test("a nested title is found too", () => {
  const component = aComponent({
    children: [
      {
        kind: "layout",
        order: 0,
        props: {},
        children: [{ kind: "title", order: 0, props: { text: "Costos por aduana" } }],
      },
    ],
  });

  expect(componentLabel(component)).toBe("Costos por aduana");
});

test("a component with nothing to name it reads as untitled", () => {
  const component = aComponent({ children: [{ kind: "stat", order: 0, props: { value: 3 } }] });

  expect(componentLabel(component)).toBeNull();
});
