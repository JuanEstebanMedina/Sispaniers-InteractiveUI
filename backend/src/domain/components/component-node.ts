import {
  ACTION_KINDS,
  ATOMIC_NODE_KINDS,
  type ActionKind,
  type AtomicNodeKind,
  COLOR_NAMES,
  DATA_SOURCE_NAMES,
  LAYOUT_DIRECTIONS,
  type LayoutDirection,
  NESTABLE_ATOMIC_NODE_KINDS,
} from "../enums/widget-kind.js";
import { InvalidComponentPathError, InvalidComponentTreeError } from "../model/errors.js";
import { type WidgetSizeName, fitsKind } from "./widget-size.js";

export const MAX_COMPONENT_NODE_DEPTH = 4;

interface ComponentNodeBase {
  order: number;
  props: Record<string, unknown>;
}

export type ComponentNode =
  | (ComponentNodeBase & { kind: "layout"; children: ComponentNode[] })
  | (ComponentNodeBase & { kind: "button"; action: ActionKind })
  | (ComponentNodeBase & {
      kind: Exclude<AtomicNodeKind, "layout" | "button">;
    });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionKind(value: unknown): value is ActionKind {
  return typeof value === "string" && (ACTION_KINDS as readonly string[]).includes(value);
}

function isLayoutDirection(value: unknown): value is LayoutDirection {
  return typeof value === "string" && (LAYOUT_DIRECTIONS as readonly string[]).includes(value);
}

function validateComponentNode(node: unknown, remainingDepth: number): void {
  if (remainingDepth <= 0) {
    throw new InvalidComponentTreeError(
      `nesting depth exceeds the maximum of ${MAX_COMPONENT_NODE_DEPTH} levels`,
    );
  }
  if (!isRecord(node)) {
    throw new InvalidComponentTreeError("node must be an object");
  }

  const { kind, order, props, action, children } = node;

  if (typeof kind !== "string" || !(ATOMIC_NODE_KINDS as readonly string[]).includes(kind)) {
    throw new InvalidComponentTreeError(`unknown node kind: ${String(kind)}`);
  }
  if (typeof order !== "number" || !Number.isInteger(order)) {
    throw new InvalidComponentTreeError("order must be an integer");
  }
  if (!isRecord(props)) {
    throw new InvalidComponentTreeError("props must be an object");
  }

  if (kind === "button") {
    if (!isActionKind(action)) {
      throw new InvalidComponentTreeError("button node requires a valid action");
    }
  } else if (action !== undefined) {
    throw new InvalidComponentTreeError(`action is not permitted on kind: ${kind}`);
  }

  // An unknown colour name silently falls back to the default, so the agent
  // would never learn its palette word was wrong. Say so instead.
  if (
    props.color !== undefined &&
    !(COLOR_NAMES as readonly string[]).includes(String(props.color))
  ) {
    throw new InvalidComponentTreeError(
      `unknown color: ${String(props.color)} (expected one of ${COLOR_NAMES.join(", ")})`,
    );
  }

  // A dataKey the frontend cannot resolve renders nothing and says nothing.
  // Rejecting it here turns a silent blank widget into an error the agent can
  // act on.
  const dataKey = String(props.dataKey);
  if (
    props.dataKey !== undefined &&
    !(DATA_SOURCE_NAMES as readonly string[]).includes(dataKey) &&
    !/^concept:[\w-]+$/.test(dataKey)
  ) {
    throw new InvalidComponentTreeError(
      `unknown dataKey: ${String(props.dataKey)} (expected one of ${DATA_SOURCE_NAMES.join(", ")})`,
    );
  }

  if (!NESTABLE_ATOMIC_NODE_KINDS.has(kind as AtomicNodeKind)) {
    if (Array.isArray(children) && children.length > 0) {
      throw new InvalidComponentTreeError(`kind ${kind} cannot carry children`);
    }
    return;
  }

  // Omitting direction is fine — the renderer stacks by default. Sending a
  // value that is not row or column is not: it would silently arrange the
  // children some way nobody asked for.
  if (props.direction !== undefined && !isLayoutDirection(props.direction)) {
    throw new InvalidComponentTreeError(
      `layout direction must be one of ${LAYOUT_DIRECTIONS.join(", ")}`,
    );
  }

  if (children !== undefined) {
    if (!Array.isArray(children)) {
      throw new InvalidComponentTreeError("children must be an array");
    }
    for (const child of children) {
      validateComponentNode(child, remainingDepth - 1);
    }
  }
}

export function validateComponentTree(children: unknown): asserts children is ComponentNode[] {
  if (!Array.isArray(children)) {
    throw new InvalidComponentTreeError("children must be an array");
  }
  for (const child of children) {
    validateComponentNode(child, MAX_COMPONENT_NODE_DEPTH);
  }
}

/** Every kind in the tree, root and nested, depth-first. */
function collectKinds(nodes: ComponentNode[]): string[] {
  return nodes.flatMap((node) => [
    node.kind,
    ...("children" in node && node.children !== undefined ? collectKinds(node.children) : []),
  ]);
}

/**
 * A node in a slot too small to render legibly still renders — nobody can
 * read it, so the container is rejected rather than shipped illegible.
 *
 * Separate from validateComponentTree because that one only ever sees the tree;
 * this rule is about the tree AND the slot it was given.
 */
export function validateComponentSize(size: WidgetSizeName, children: ComponentNode[]): void {
  const offender = collectKinds(children).find((kind) => !fitsKind(size, kind));
  if (offender === undefined) {
    return;
  }
  throw new InvalidComponentTreeError(`size ${size} is too small to hold a "${offender}" node`);
}

function resolveParent(
  root: Record<string, unknown>,
  segments: string[],
  fullPath: string,
): Record<string, unknown> | unknown[] {
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      throw new InvalidComponentPathError(`path does not resolve: ${fullPath}`);
    }
    current = Array.isArray(current)
      ? current[Number(segment)]
      : (current as Record<string, unknown>)[segment];
  }
  if (current === null || typeof current !== "object") {
    throw new InvalidComponentPathError(`path does not resolve: ${fullPath}`);
  }
  return current as Record<string, unknown> | unknown[];
}

/**
 * Applies `value` at `path` (dot-notation, rooted at "children") on a clone of
 * `children`, validating the path resolves to an existing location first
 * (D-CC-005.1). Returns the resulting tree; does not itself re-validate node
 * shape (see validateComponentTree for that, D-CC-005.2).
 */
export function setComponentTreePath(
  children: ComponentNode[],
  path: string,
  value: unknown,
): ComponentNode[] {
  const segments = path.split(".");
  if (segments[0] !== "children" || segments.length < 2) {
    throw new InvalidComponentPathError(`path must be rooted at "children": ${path}`);
  }

  const lastKey = segments[segments.length - 1];
  if (lastKey === undefined) {
    throw new InvalidComponentPathError(`path is empty: ${path}`);
  }

  const root: Record<string, unknown> = { children: structuredClone(children) };
  const parent = resolveParent(root, segments.slice(0, -1), path);

  if (Array.isArray(parent)) {
    const index = Number(lastKey);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
      throw new InvalidComponentPathError(`path index out of range: ${path}`);
    }
    parent[index] = value;
  } else {
    if (!(lastKey in parent)) {
      throw new InvalidComponentPathError(`path does not resolve: ${path}`);
    }
    (parent as Record<string, unknown>)[lastKey] = value;
  }

  return root.children as ComponentNode[];
}
