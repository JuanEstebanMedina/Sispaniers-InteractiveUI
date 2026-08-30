import type { LayoutEntry } from "./layout.js";
import type { GridCols } from "./widget-size.js";

export interface PackableWidget {
  id: string;
  w: number;
  h: number;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function isFree(
  occupied: Set<string>,
  col: number,
  row: number,
  w: number,
  h: number,
  cols: GridCols,
): boolean {
  if (col + w > cols) {
    return false;
  }
  for (let r = row; r < row + h; r += 1) {
    for (let c = col; c < col + w; c += 1) {
      if (occupied.has(cellKey(c, r))) {
        return false;
      }
    }
  }
  return true;
}

function occupy(occupied: Set<string>, entry: LayoutEntry): void {
  for (let r = entry.row; r < entry.row + entry.h; r += 1) {
    for (let c = entry.col; c < entry.col + entry.w; c += 1) {
      occupied.add(cellKey(c, r));
    }
  }
}

function firstFit(
  occupied: Set<string>,
  w: number,
  h: number,
  cols: GridCols,
  maxRow: number,
): { col: number; row: number } {
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col + w <= cols; col += 1) {
      if (isFree(occupied, col, row, w, h, cols)) {
        return { col, row };
      }
    }
  }
  return { col: 0, row: maxRow + 1 };
}

/**
 * The sequence IS the layout — coordinates are output, never input.
 *
 * Each widget takes the first cell it fits scanning from the top, so one later
 * in the sequence drops into an earlier hole instead of leaving it open.
 *
 * Order beats size on purpose. Placing the largest widget that fits each cell
 * packs marginally tighter, but then a big widget always wins the top-left slot
 * no matter where the user dropped it, and their arrangement never survives.
 *
 * This mirrors `pack` in the front's `lib/grid.ts`. The two must agree: the
 * front repacks locally on every drag and only later reads this back.
 */
export function packDefaultLayout(widgets: PackableWidget[], cols: GridCols): LayoutEntry[] {
  const occupied = new Set<string>();
  let maxRow = 0;

  return widgets.map((widget) => {
    const w = Math.min(widget.w, cols);
    const { col, row } = firstFit(occupied, w, widget.h, cols, maxRow);
    const entry: LayoutEntry = { id: widget.id, col, row, w, h: widget.h };

    occupy(occupied, entry);
    maxRow = Math.max(maxRow, entry.row + entry.h);

    return entry;
  });
}
