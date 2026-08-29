import type { LayoutEntry } from "./layout.js";
import type { GridCols } from "./widget-size.js";

export interface PackableWidget {
  id: string;
  w: number;
  h: number;
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function fits(
  widget: PackableWidget,
  row: number,
  col: number,
  cols: GridCols,
  occupied: Set<string>,
): boolean {
  if (col + widget.w > cols) {
    return false;
  }
  for (let dr = 0; dr < widget.h; dr += 1) {
    for (let dc = 0; dc < widget.w; dc += 1) {
      if (occupied.has(cellKey(row + dr, col + dc))) {
        return false;
      }
    }
  }
  return true;
}

function occupy(widget: PackableWidget, row: number, col: number, occupied: Set<string>): void {
  for (let dr = 0; dr < widget.h; dr += 1) {
    for (let dc = 0; dc < widget.w; dc += 1) {
      occupied.add(cellKey(row + dr, col + dc));
    }
  }
}

export function packDefaultLayout(widgets: PackableWidget[], cols: GridCols): LayoutEntry[] {
  const placeable = widgets.filter((widget) => widget.w <= cols);

  const sortOrder = new Map(placeable.map((widget, index) => [widget, index]));
  const sorted = [...placeable].sort((a, b) => {
    const areaDiff = b.w * b.h - a.w * a.h;
    if (areaDiff !== 0) {
      return areaDiff;
    }
    return (sortOrder.get(a) ?? 0) - (sortOrder.get(b) ?? 0);
  });

  const unplaced = [...sorted];
  const occupied = new Set<string>();
  const result: LayoutEntry[] = [];

  const rowCap = placeable.reduce((sum, widget) => sum + widget.h, 0) + placeable.length + 1;

  for (let row = 0; row < rowCap && unplaced.length > 0; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (occupied.has(cellKey(row, col))) {
        continue;
      }

      const widgetIndex = unplaced.findIndex((widget) => fits(widget, row, col, cols, occupied));
      if (widgetIndex === -1) {
        continue;
      }

      const widget = unplaced[widgetIndex];
      if (widget === undefined) {
        continue;
      }

      occupy(widget, row, col, occupied);
      result.push({ id: widget.id, col, row, w: widget.w, h: widget.h });
      unplaced.splice(widgetIndex, 1);
    }
  }

  return result;
}
