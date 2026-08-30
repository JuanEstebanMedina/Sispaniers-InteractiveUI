import type { Component } from "./component.js";
import { packDefaultLayout } from "./layout-packer.js";
import type { LayoutEntry, LayoutPosition } from "./layout.js";
import { type GridCols, WIDGET_SIZES } from "./widget-size.js";

export interface ProjectLayoutInput {
  components: Component[];
  saved: LayoutPosition[];
  cols: GridCols;
}

/**
 * Positions are the only thing a client owns: widgets can be moved but never
 * resized, so dimensions always come from the component's own size. Entries for
 * components that no longer exist are dropped, and components with no saved
 * position are packed into whatever space is left.
 */
export function projectLayout({ components, saved, cols }: ProjectLayoutInput): LayoutEntry[] {
  const sized = components
    .map((component) => ({ id: component.id, ...WIDGET_SIZES[component.size] }))
    .filter((widget) => widget.w <= cols);

  const byId = new Map(sized.map((widget) => [widget.id, widget]));

  const placed: LayoutEntry[] = [];
  const seen = new Set<string>();

  for (const position of saved) {
    const widget = byId.get(position.id);
    if (widget === undefined || seen.has(position.id)) {
      continue;
    }
    if (position.col + widget.w > cols) {
      continue;
    }

    seen.add(position.id);
    placed.push({ ...widget, col: position.col, row: position.row });
  }

  const unplaced = sized.filter((widget) => !seen.has(widget.id));

  return [...placed, ...packDefaultLayout(unplaced, cols, placed)];
}
