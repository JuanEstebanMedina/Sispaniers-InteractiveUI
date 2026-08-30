export interface GridItem {
  id: string
  col: number
  row: number
  w: number
  h: number
}

/** Target edge of a single cell. The column count follows from the space. */
export const CELL_TARGET_PX = 132

/**
 * Only counts the catalogue widths divide, so widening the grid never turns a
 * tiling layout into a gappy one.
 */
const COLUMN_STEPS = [2, 4, 8] as const

export function colsForWidth(width: number, gap: number): number {
  let best: number = COLUMN_STEPS[0]
  for (const cols of COLUMN_STEPS) {
    if ((width - gap * (cols - 1)) / cols >= CELL_TARGET_PX) best = cols
  }
  return best
}

/**
 * Widths must divide the column count, or gaps become unavoidable arithmetic:
 * a 3-wide widget on a 4-column grid always strands one column. Heights are
 * free — a 1x5 tower is fine.
 */
export const WIDGET_SIZES = {
  tile: { w: 1, h: 1 },
  small: { w: 2, h: 2 },
  wide: { w: 4, h: 2 },
  tall: { w: 2, h: 4 },
  tower: { w: 1, h: 5 },
  large: { w: 4, h: 4 },
  banner: { w: 4, h: 1 },
} as const

export type WidgetSize = keyof typeof WIDGET_SIZES

const key = (col: number, row: number) => `${col},${row}`

function occupy(taken: Set<string>, item: GridItem): void {
  for (let r = item.row; r < item.row + item.h; r++) {
    for (let c = item.col; c < item.col + item.w; c++) taken.add(key(c, r))
  }
}

function isFree(taken: Set<string>, col: number, row: number, w: number, h: number, cols: number) {
  if (col < 0 || row < 0 || col + w > cols) return false
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (taken.has(key(c, r))) return false
    }
  }
  return true
}

/** A widget wider than the grid is clamped rather than dropped. */
export function clampToCols(item: GridItem, cols: number): GridItem {
  const w = Math.min(item.w, cols)
  return w === item.w ? item : { ...item, w }
}

/** First cell, in reading order, where this footprint fits. */
function firstFit(taken: Set<string>, w: number, h: number, cols: number, maxRow: number) {
  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col + w <= cols; col++) {
      if (isFree(taken, col, row, w, h, cols)) return { col, row }
    }
  }
  return { col: 0, row: maxRow + 1 }
}

/**
 * The array order IS the layout — positions are output, never input.
 *
 * Each widget takes the first cell it fits, scanning from the top, so a small
 * one later in the sequence drops into an earlier hole instead of leaving it
 * open. That is what keeps the grid dense.
 *
 * Order beats size on purpose. Picking the largest widget that fits each cell
 * packs marginally tighter, but it means a big widget always wins the top-left
 * slot no matter where the user dropped it — their arrangement never survives.
 * A layout the user cannot control is worse than one with a hole in it.
 */
export function pack(items: GridItem[], cols: number): GridItem[] {
  const taken = new Set<string>()
  let maxRow = 0

  return items.map((raw) => {
    const item = clampToCols(raw, cols)
    const spot = firstFit(taken, item.w, item.h, cols, maxRow)
    const settled = { ...item, ...spot }
    occupy(taken, settled)
    maxRow = Math.max(maxRow, settled.row + settled.h)
    return settled
  })
}

/**
 * Drop `id` at (col, row): splice it into the sequence ahead of whatever
 * currently sits at that point, then reflow.
 *
 * Reordering rather than assigning coordinates is what makes "put this one
 * lower and let the rest rise" work — the widgets below now come first in the
 * sequence, so they flow up on their own.
 */
export function moveItem(
  items: GridItem[],
  id: string,
  col: number,
  row: number,
  cols: number,
): GridItem[] {
  const dragged = items.find((item) => item.id === id)
  if (!dragged) return pack(items, cols)

  // The splice point below is found in reading order, which stops matching the
  // sequence as soon as `pack` drops a later widget into an earlier hole. On a
  // drop that lands where the widget already is there is nothing to splice, so
  // taking the shortcut is also the only way the sequence survives it.
  if (dragged.col === col && dragged.row === row) return items

  const others = items.filter((item) => item.id !== id)
  const at = others.findIndex((item) => item.row > row || (item.row === row && item.col >= col))
  const index = at === -1 ? others.length : at

  return pack([...others.slice(0, index), dragged, ...others.slice(index)], cols)
}

/** Where a new widget lands when the agent does not name a position: last. */
export function append(items: GridItem[], item: GridItem, cols: number): GridItem[] {
  return pack([...items, item], cols)
}

/** True when the agent's proposed position is usable exactly as sent. */
export function fitsAsProposed(items: GridItem[], candidate: GridItem, cols: number): boolean {
  const taken = new Set<string>()
  for (const item of items) occupy(taken, item)
  return isFree(taken, candidate.col, candidate.row, candidate.w, candidate.h, cols)
}

export function sameLayout(a: GridItem[], b: GridItem[]): boolean {
  if (a.length !== b.length) return false
  const index = new Map(b.map((item) => [item.id, item]))
  return a.every((item) => {
    const other = index.get(item.id)
    return other?.col === item.col && other.row === item.row && other.w === item.w && other.h === item.h
  })
}

/** Cells left empty inside the packed area — what the UI reports back to the agent. */
export function holeCount(items: GridItem[], cols: number): number {
  if (items.length === 0) return 0
  const taken = new Set<string>()
  for (const item of items) occupy(taken, item)
  const rows = items.reduce((max, item) => Math.max(max, item.row + item.h), 0)
  let holes = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!taken.has(key(c, r))) holes += 1
    }
  }
  return holes
}
