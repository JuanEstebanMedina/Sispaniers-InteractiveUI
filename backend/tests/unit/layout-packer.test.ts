import { expect, test } from "vitest";
import { packDefaultLayout } from "../../src/domain/components/layout-packer.js";
import { WIDGET_SIZES, type WidgetSizeName } from "../../src/domain/components/widget-size.js";

function widget(id: string, size: WidgetSizeName) {
  return { id, ...WIDGET_SIZES[size] };
}

function entryFor(entries: ReturnType<typeof packDefaultLayout>, id: string) {
  return entries.find((entry) => entry.id === id);
}

test("the sequence decides the top-left slot, not the size", async () => {
  const packed = packDefaultLayout([widget("small", "small"), widget("wide", "wide")], 4);

  expect(entryFor(packed, "small")).toEqual({ id: "small", col: 0, row: 0, w: 2, h: 2 });
});

test("a widget later in the sequence backfills an earlier hole", async () => {
  const packed = packDefaultLayout(
    [widget("small", "small"), widget("wide", "wide"), widget("filler", "small")],
    4,
  );

  expect(entryFor(packed, "filler")).toEqual({ id: "filler", col: 2, row: 0, w: 2, h: 2 });
});

test("a widget wider than the grid is clamped rather than dropped", async () => {
  const packed = packDefaultLayout([widget("wide", "wide")], 2);

  expect(packed).toEqual([{ id: "wide", col: 0, row: 0, w: 2, h: 2 }]);
});

test("every widget is placed exactly once", async () => {
  const packed = packDefaultLayout(
    [
      widget("a", "tower"),
      widget("b", "banner"),
      widget("c", "tile"),
      widget("d", "large"),
      widget("e", "tall"),
    ],
    8,
  );

  expect(packed.map((entry) => entry.id).sort()).toEqual(["a", "b", "c", "d", "e"]);
});

test("no two widgets share a cell", async () => {
  const packed = packDefaultLayout(
    [
      widget("a", "small"),
      widget("b", "wide"),
      widget("c", "tile"),
      widget("d", "tall"),
      widget("e", "banner"),
    ],
    4,
  );

  const taken = new Set<string>();
  for (const entry of packed) {
    for (let row = entry.row; row < entry.row + entry.h; row += 1) {
      for (let col = entry.col; col < entry.col + entry.w; col += 1) {
        expect(taken.has(`${col},${row}`)).toBe(false);
        taken.add(`${col},${row}`);
      }
    }
  }
});

test("moving a widget to the front of the sequence moves it to the front of the grid", async () => {
  const before = packDefaultLayout([widget("first", "small"), widget("second", "small")], 4);
  const after = packDefaultLayout([widget("second", "small"), widget("first", "small")], 4);

  expect(entryFor(before, "first")?.col).toBe(0);
  expect(entryFor(after, "second")?.col).toBe(0);
  expect(entryFor(after, "first")?.col).toBe(2);
});

test("an empty sequence packs to an empty layout", async () => {
  expect(packDefaultLayout([], 4)).toEqual([]);
});
