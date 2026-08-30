import {
  ACTION_KINDS,
  ATOMIC_NODE_KINDS,
  type ActionKind,
  type AtomicNodeKind,
} from "../enums/widget-kind.js";
import { InvalidComponentPathError, InvalidComponentTreeError } from "../model/errors.js";

export const MAX_COMPONENT_NODE_DEPTH = 4;

interface ComponentNodeBase {
  order: number;
  props: Record<string, unknown>;
}

export type ComponentNode =
  | (ComponentNodeBase & { kind: "button-group"; children: ComponentNode[] })
  | (ComponentNodeBase & { kind: "button"; action: ActionKind })
  | (ComponentNodeBase & {
      kind: Exclude<AtomicNodeKind, "button-group" | "button">;
    });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActionKind(value: unknown): value is ActionKind {
  return typeof value === "string" && (ACTION_KINDS as readonly string[]).includes(value);
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

  if (kind === "button-group") {
    if (children === undefined) {
      return;
    }
    if (!Array.isArray(children)) {
      throw new InvalidComponentTreeError("children must be an array");
    }
    for (const child of children) {
      validateComponentNode(child, remainingDepth - 1);
    }
    return;
  }

  if (Array.isArray(children) && children.length > 0) {
    throw new InvalidComponentTreeError(`kind ${kind} cannot carry children`);
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
