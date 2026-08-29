export const WIDGET_KINDS = ["map", "metric", "decision-panel", "timeline"] as const;

export type WidgetKind = (typeof WIDGET_KINDS)[number];
