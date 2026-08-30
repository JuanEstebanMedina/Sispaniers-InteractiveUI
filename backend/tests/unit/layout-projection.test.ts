import { expect, test } from "vitest";
import { projectLayout } from "../../src/domain/components/layout-projection.js";
import type { LayoutEntry } from "../../src/domain/components/layout.js";
import { aComponent } from "../support/component-fixtures.js";

function savedEntries(entries: LayoutEntry[]): LayoutEntry[] {
  return entries;
}

test("a saved position keeps its cell but takes its size from the component", () => {
  const component = aComponent({ id: "widget-1", size: "wide" });

  const layout = projectLayout({
    components: [component],
    saved: savedEntries([{ id: "widget-1", col: 0, row: 3, w: 1, h: 1 }]),
    cols: 4,
  });

  expect(layout).toEqual([{ id: "widget-1", col: 0, row: 3, w: 4, h: 2 }]);
});

test("a saved position for a component that no longer exists is dropped", () => {
  const component = aComponent({ id: "widget-1", size: "tile" });

  const layout = projectLayout({
    components: [component],
    saved: savedEntries([
      { id: "deleted-widget", col: 0, row: 0, w: 2, h: 2 },
      { id: "widget-1", col: 3, row: 0, w: 1, h: 1 },
    ]),
    cols: 4,
  });

  expect(layout).toEqual([{ id: "widget-1", col: 3, row: 0, w: 1, h: 1 }]);
});

test("a component missing from the saved layout is packed into free space", () => {
  const placed = aComponent({ id: "placed", size: "wide" });
  const fresh = aComponent({ id: "fresh", size: "small" });

  const layout = projectLayout({
    components: [placed, fresh],
    saved: savedEntries([{ id: "placed", col: 0, row: 0, w: 4, h: 2 }]),
    cols: 4,
  });

  expect(layout).toContainEqual({ id: "placed", col: 0, row: 0, w: 4, h: 2 });

  const freshEntry = layout.find((entry) => entry.id === "fresh");
  expect(freshEntry).toEqual({ id: "fresh", col: 0, row: 2, w: 2, h: 2 });
});

test("with nothing saved every component is packed from scratch", () => {
  const layout = projectLayout({
    components: [aComponent({ id: "a", size: "small" }), aComponent({ id: "b", size: "small" })],
    saved: [],
    cols: 4,
  });

  expect(layout).toHaveLength(2);
  expect(layout.every((entry) => entry.w === 2 && entry.h === 2)).toBe(true);
});

test("a component wider than the grid is dropped rather than overflowing it", () => {
  const layout = projectLayout({
    components: [aComponent({ id: "too-wide", size: "wide" })],
    saved: [],
    cols: 2,
  });

  expect(layout).toEqual([]);
});

test("a saved position that would overflow the grid is repacked instead of trusted", () => {
  const layout = projectLayout({
    components: [aComponent({ id: "widget-1", size: "wide" })],
    saved: savedEntries([{ id: "widget-1", col: 3, row: 0, w: 4, h: 2 }]),
    cols: 4,
  });

  expect(layout).toEqual([{ id: "widget-1", col: 0, row: 0, w: 4, h: 2 }]);
});
