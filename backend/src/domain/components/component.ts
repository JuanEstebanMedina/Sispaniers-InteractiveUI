import type { WidgetSizeName } from "./widget-size.js";

interface ComponentBase {
  id: string;
  operationId: string;
  size: WidgetSizeName;
  createdAt: Date;
}

export type Component =
  | (ComponentBase & { kind: "map"; content: Record<string, unknown> })
  | (ComponentBase & { kind: "metric"; content: Record<string, unknown> })
  | (ComponentBase & { kind: "decision-panel"; content: Record<string, unknown> })
  | (ComponentBase & { kind: "timeline"; content: Record<string, unknown> });

export type { WidgetKind } from "../enums/widget-kind.js";
