export const WIDGET_SIZES = {
  tile: { w: 1, h: 1 },
  small: { w: 2, h: 2 },
  wide: { w: 4, h: 2 },
  tall: { w: 2, h: 4 },
  tower: { w: 1, h: 5 },
  large: { w: 4, h: 4 },
  banner: { w: 4, h: 1 },
} as const;

export type WidgetSizeName = keyof typeof WIDGET_SIZES;
export type GridCols = 2 | 4 | 8;

const VALID_WIDTHS = new Set([1, 2, 4]);

export function isValidWidgetWidth(width: number, cols: GridCols): boolean {
  return VALID_WIDTHS.has(width) && cols % width === 0;
}
