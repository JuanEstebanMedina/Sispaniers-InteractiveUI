import type { GridComponentKind } from "../enums/widget-kind.js";
import type { ComponentNode } from "./component-node.js";
import type { WidgetSizeName } from "./widget-size.js";

export interface Component {
  id: string;
  operationId: string;
  order: number;
  title?: string;
  size: WidgetSizeName;
  kind: GridComponentKind;
  children: ComponentNode[];
  createdAt: Date;
}

export type { ComponentNode } from "./component-node.js";
export type { GridComponentKind, AtomicNodeKind, ActionKind } from "../enums/widget-kind.js";
