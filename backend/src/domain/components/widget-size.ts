/**
 * Widths must divide every supported column count (2, 4, 8), or gaps become
 * unavoidable arithmetic rather than a packing failure.
 *
 * `tower` (1x5) used to live here and was removed: four of them beside one
 * `small` leave four cells no arrangement can fill, because each tower strands
 * a single cell in its own column and a 2x2 needs two adjacent ones.
 */
export const WIDGET_SIZES = {
  tile: { w: 1, h: 1 },
  small: { w: 2, h: 2 },
  wide: { w: 4, h: 2 },
  tall: { w: 2, h: 4 },
  large: { w: 4, h: 4 },
  banner: { w: 4, h: 1 },
} as const;

export type WidgetSizeName = keyof typeof WIDGET_SIZES;
export type GridCols = 2 | 4 | 8;

const VALID_WIDTHS = new Set([1, 2, 4]);

export function isValidWidgetWidth(width: number, cols: GridCols): boolean {
  return VALID_WIDTHS.has(width) && cols % width === 0;
}

/**
 * Sizes forbidden for a given kind — a quality floor, not a grid-geometry
 * rule. One cell is about 132px: a `stat`, a `badge`, a `sparkline`, anything
 * in that little space is unreadable, not "compact" — so `tile` (1x1) is off
 * limits for every kind, no exceptions.
 *
 * Charts and the live map also lose `banner` (4x1): one row tall is enough
 * area on paper, but there is no room for an axis, a legend or a marker to
 * read.
 */
const FORBIDDEN_SIZES_BY_KIND: Partial<Record<string, ReadonlySet<WidgetSizeName>>> = {
  "trend-chart": new Set<WidgetSizeName>(["tile", "banner"]),
  "category-chart": new Set<WidgetSizeName>(["tile", "banner"]),
  "breakdown-chart": new Set<WidgetSizeName>(["tile", "banner"]),
  map: new Set<WidgetSizeName>(["tile", "banner"]),
};

const DEFAULT_FORBIDDEN_SIZES = new Set<WidgetSizeName>(["tile"]);

/** Whether `kind` may legibly render at `size`. */
export function fitsKind(size: WidgetSizeName, kind: string): boolean {
  const forbidden = FORBIDDEN_SIZES_BY_KIND[kind] ?? DEFAULT_FORBIDDEN_SIZES;
  return !forbidden.has(size);
}
