import { expect, test } from "vitest";
import type { ComponentNode } from "../../src/domain/components/component-node.js";
import {
  setComponentTreePath,
  validateComponentSize,
  validateComponentTree,
} from "../../src/domain/components/component-node.js";
import { COLOR_NAMES, DATA_SOURCE_NAMES } from "../../src/domain/enums/widget-kind.js";
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
      kind: "layout",
      order: 0,
      props: {},
      children: [
        {
          kind: "layout",
          order: 0,
          props: {},
          children: [
            {
              kind: "layout",
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
      kind: "layout",
      order: 0,
      props: {},
      children: [
        {
          kind: "layout",
          order: 0,
          props: {},
          children: [
            {
              kind: "layout",
              order: 0,
              props: {},
              children: [
                {
                  kind: "layout",
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
  expect(() => validateComponentTree([{ kind: "chart-3d", order: 0, props: {} }])).toThrow(
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

test("layout accepts children of any kind, not only buttons", () => {
  const tree = [
    {
      kind: "layout",
      order: 0,
      props: { direction: "row" },
      children: [
        { kind: "title", order: 0, props: { text: "A" } },
        { kind: "trend-chart", order: 1, props: { dataKey: "schedule-changes" } },
        { kind: "button", order: 2, props: {}, action: "refresh" },
      ],
    },
  ];

  expect(() => validateComponentTree(tree)).not.toThrow();
});

test("layout direction may be omitted", () => {
  const tree = [{ kind: "layout", order: 0, props: {}, children: [statNode(0)] }];

  expect(() => validateComponentTree(tree)).not.toThrow();
});

test("rejects a layout direction that is neither row nor column", () => {
  const tree = [{ kind: "layout", order: 0, props: { direction: "diagonal" }, children: [] }];

  expect(() => validateComponentTree(tree)).toThrow(InvalidComponentTreeError);
});

test("rejects children on a kind that does not nest", () => {
  const tree = [{ kind: "stat", order: 0, props: {}, children: [statNode(0)] }];

  expect(() => validateComponentTree(tree)).toThrow(InvalidComponentTreeError);
});

test("rejects a chart in a container too small to render it legibly", () => {
  const children: ComponentNode[] = [{ kind: "trend-chart", order: 0, props: {} }];

  expect(() => validateComponentSize("tile", children)).toThrow(InvalidComponentTreeError);
  expect(() => validateComponentSize("banner", children)).toThrow(InvalidComponentTreeError);
  expect(() => validateComponentSize("small", children)).not.toThrow();
});

test("finds a chart nested inside a layout when checking the size", () => {
  const children: ComponentNode[] = [
    {
      kind: "layout",
      order: 0,
      props: {},
      children: [{ kind: "category-chart", order: 0, props: {} }],
    },
  ];

  expect(() => validateComponentSize("tile", children)).toThrow(InvalidComponentTreeError);
});

test("rejects any kind in a tile — no exceptions, not even sparkline", () => {
  expect(() => validateComponentSize("tile", [statNode(0)])).toThrow(InvalidComponentTreeError);
  expect(() => validateComponentSize("tile", [{ kind: "sparkline", order: 0, props: {} }])).toThrow(
    InvalidComponentTreeError,
  );
  expect(() => validateComponentSize("tile", [{ kind: "title", order: 0, props: {} }])).toThrow(
    InvalidComponentTreeError,
  );
});

test("rejects an empty tile too", () => {
  expect(() => validateComponentSize("tile", [])).toThrow("size tile (1x1) is not allowed");
});

test("a non-chart node fits any size but tile", () => {
  expect(() => validateComponentSize("small", [statNode(0)])).not.toThrow();
  expect(() => validateComponentSize("banner", [statNode(0)])).not.toThrow();
});

test("rejects a wide text-only component", () => {
  expect(() =>
    validateComponentSize("wide", [
      { kind: "title", order: 0, props: { text: "Import control tower" } },
      { kind: "label", order: 1, props: { text: "Three bookings under follow-up." } },
    ]),
  ).toThrow("size wide is too large for text-only content");
});

test("rejects a dataKey the frontend cannot resolve", () => {
  const tree = [{ kind: "table", order: 0, props: { dataKey: "ventas-del-mes" } }];

  expect(() => validateComponentTree(tree)).toThrow(InvalidComponentTreeError);
});

test("requires a visible illustrative flag for inline chart rows", () => {
  expect(() =>
    validateComponentTree([
      { kind: "trend-chart", order: 0, props: { rows: [{ x: "Week 1", value: 4 }] } },
    ]),
  ).toThrow("inline chart rows require illustrative: true");

  expect(() =>
    validateComponentTree([
      {
        kind: "trend-chart",
        order: 0,
        props: { illustrative: true, rows: [{ x: "Week 1", value: 4 }, { x: "Week 2", value: 6 }] },
      },
    ]),
  ).not.toThrow();
});

test("accepts every documented data source", () => {
  for (const name of DATA_SOURCE_NAMES) {
    expect(() =>
      validateComponentTree([{ kind: "table", order: 0, props: { dataKey: name } }]),
    ).not.toThrow();
  }
});

test("a node with no dataKey is none of that rule's business", () => {
  expect(() => validateComponentTree([statNode(0)])).not.toThrow();
});

test("rejects a colour that is not in the palette vocabulary", () => {
  const tree = [{ kind: "title", order: 0, props: { text: "X", color: "chartreuse" } }];

  expect(() => validateComponentTree(tree)).toThrow(InvalidComponentTreeError);
});

test("accepts every documented colour name", () => {
  for (const color of COLOR_NAMES) {
    expect(() =>
      validateComponentTree([{ kind: "title", order: 0, props: { text: "X", color } }]),
    ).not.toThrow();
  }
});

test("a node with no colour is none of that rule's business", () => {
  expect(() => validateComponentTree([statNode(0)])).not.toThrow();
});
