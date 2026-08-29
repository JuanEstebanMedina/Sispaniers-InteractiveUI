import type { GridCols } from "./widget-size.js";

export interface LayoutEntry {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface LayoutBreakpoint {
  cols: GridCols;
  layout: LayoutEntry[];
}

export interface OperationLayout {
  operationId: string;
  breakpoints: LayoutBreakpoint[];
}
