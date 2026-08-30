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

/** Kinds that need real estate to say anything. */
const CHART_NODE_KINDS = new Set(["trend-chart", "category-chart", "breakdown-chart"]);

/** Sizes too short to render a chart legibly — one cell is about 132px. */
const SIZES_TOO_SMALL_FOR_CHARTS = new Set<WidgetSizeName>(["tile", "banner"]);

export function isChartNodeKind(kind: string): boolean {
  return CHART_NODE_KINDS.has(kind);
}

export function fitsChart(size: WidgetSizeName): boolean {
  return !SIZES_TOO_SMALL_FOR_CHARTS.has(size);
}
