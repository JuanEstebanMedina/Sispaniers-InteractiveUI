import { expect, test } from "vitest";
import type { ComponentNode } from "../../src/domain/components/component-node.js";
import {
  setComponentTreePath,
  validateComponentTree,
} from "../../src/domain/components/component-node.js";
import {
  InvalidComponentPathError,
  InvalidComponentTreeError,
} from "../../src/domain/model/errors.js";

function statNode(order: number): ComponentNode {
  return { kind: "stat", order, props: {} };
}

test("accepts a container tree nested exactly 4 levels deep", () => {
  const tree = [
    {
      kind: "button-group",
      order: 0,
      props: {},
      children: [
        {
          kind: "button-group",
          order: 0,
          props: {},
          children: [
            {
              kind: "button-group",
              order: 0,
              props: {},
              children: [{ kind: "button", order: 0, props: {}, action: "confirm" }],
            },
          ],
        },
      ],
    },
  ];

  expect(() => validateComponentTree(tree)).not.toThrow();
});

test("rejects a tree nested 5 levels deep", () => {
  const tree = [
    {
      kind: "button-group",
      order: 0,
      props: {},
      children: [
        {
          kind: "button-group",
          order: 0,
          props: {},
          children: [
            {
              kind: "button-group",
              order: 0,
              props: {},
              children: [
                {
                  kind: "button-group",
                  order: 0,
                  props: {},
                  children: [{ kind: "button", order: 0, props: {}, action: "confirm" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  expect(() => validateComponentTree(tree)).toThrow(InvalidComponentTreeError);
});

test("rejects an unknown kind", () => {
  expect(() => validateComponentTree([{ kind: "map", order: 0, props: {} }])).toThrow(
    InvalidComponentTreeError,
  );
});

test("rejects a leaf kind carrying children", () => {
  expect(() =>
    validateComponentTree([{ kind: "stat", order: 0, props: {}, children: [statNode(0)] }]),
  ).toThrow(InvalidComponentTreeError);
});

test("rejects a button node missing action", () => {
  expect(() => validateComponentTree([{ kind: "button", order: 0, props: {} }])).toThrow(
    InvalidComponentTreeError,
  );
});

test("rejects a non-button node carrying action", () => {
  expect(() =>
    validateComponentTree([{ kind: "stat", order: 0, props: {}, action: "confirm" }]),
  ).toThrow(InvalidComponentTreeError);
});

test("sets a value at an existing dot-notation path without touching siblings", () => {
  const tree: ComponentNode[] = [
    statNode(0),
    { kind: "label", order: 1, props: { name: "old" } },
    statNode(2),
  ];

  const result = setComponentTreePath(tree, "children.1.props.name", "new");

  expect(result[1]).toEqual({ kind: "label", order: 1, props: { name: "new" } });
  expect(result[0]).toEqual(tree[0]);
  expect(result[2]).toEqual(tree[2]);
  expect(tree[1]).toEqual({ kind: "label", order: 1, props: { name: "old" } });
});

test("rejects a path pointing at an out-of-range index", () => {
  const tree = [statNode(0)];

  expect(() => setComponentTreePath(tree, "children.9.props.name", "new")).toThrow(
    InvalidComponentPathError,
  );
});
