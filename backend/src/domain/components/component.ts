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

/**
 * Order decides the sequence, and creation time breaks the tie. The tie is real:
 * components stored before `order` existed all read back as 0, and without a
 * second key their sequence would be whatever the driver happened to return.
 */
export function bySequence(a: Component, b: Component): number {
  return a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime();
}

/** The order a component appended to this sequence takes: after all of them. */
export function nextOrderAfter(siblings: Component[]): number {
  return siblings.reduce(
    (next, sibling) => (Number.isFinite(sibling.order) ? Math.max(next, sibling.order + 1) : next),
    0,
  );
}

export type { ComponentNode } from "./component-node.js";
export type { GridComponentKind, AtomicNodeKind, ActionKind } from "../enums/widget-kind.js";
