import { expect, test } from "vitest";
import {
  COMPONENT_CATALOG,
  renderComponentCatalog,
} from "../../src/domain/components/component-catalog.js";
import { validateComponentTree } from "../../src/domain/components/component-node.js";
import { WIDGET_SIZES } from "../../src/domain/components/widget-size.js";
import { ATOMIC_NODE_KINDS } from "../../src/domain/enums/widget-kind.js";

/**
 * The whole point of the catalog: it is derived from the same constants the
 * validator reads, so the two cannot disagree. A hand-written list already
 * drifted once — it offered the agent a "button-group" kind that never existed
 * and hid "layout", the only kind that may carry children.
 */
test("the catalog describes every kind the validator accepts, and no other", () => {
  expect(Object.keys(COMPONENT_CATALOG.nodes).sort()).toEqual([...ATOMIC_NODE_KINDS].sort());
});

test("every catalogued node passes validation as the catalog describes it", () => {
  for (const [kind, spec] of Object.entries(COMPONENT_CATALOG.nodes)) {
    const node = {
      kind,
      order: 0,
      props: spec.example,
      ...(spec.action ? { action: spec.action } : {}),
      ...(spec.nestable ? { children: [] } : {}),
    };

    expect(() => validateComponentTree([node]), `catalogued ${kind} must validate`).not.toThrow();
  }
});

test("the catalog offers every real widget size", () => {
  expect(Object.keys(COMPONENT_CATALOG.sizes).sort()).toEqual(Object.keys(WIDGET_SIZES).sort());
});

test("the rendered catalog names each kind and each size", () => {
  const rendered = renderComponentCatalog();

  for (const kind of ATOMIC_NODE_KINDS) expect(rendered).toContain(`"${kind}"`);
  for (const size of Object.keys(WIDGET_SIZES)) expect(rendered).toContain(size);
});

test("the rendered catalog never names a kind the validator would reject", () => {
  const quoted = [...renderComponentCatalog().matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  const kindLike = quoted.filter((word) => word?.includes("-chart") || word === "button-group");

  for (const word of kindLike) {
    expect(() =>
      validateComponentTree([{ kind: word as string, order: 0, props: {} }]),
    ).not.toThrow();
  }
});
