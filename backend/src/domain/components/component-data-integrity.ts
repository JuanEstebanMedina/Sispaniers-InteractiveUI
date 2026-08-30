import { InvalidComponentTreeError } from "../model/errors.js";
import type { ComponentNode } from "./component.js";

/**
 * Props that state a fact the organisation owns: where the numbers come from
 * (`dataKey`) or the numbers themselves. Everything else on a node — titles,
 * colours, statuses, and the `columns`/`series`/`xKey`/`valueKey` that pick
 * which field to show — presents that record without restating it.
 */
const FACTUAL_PROPS = ["dataKey", "rows", "items", "events", "value", "max"] as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return entries.map(([key, nested]) => [key, canonicalize(nested)]);
}

function collectFactualClaims(
  nodes: ComponentNode[],
  into: Map<string, string>,
): Map<string, string> {
  for (const node of nodes) {
    for (const prop of FACTUAL_PROPS) {
      const claimed = (node.props as Record<string, unknown>)[prop];
      if (claimed === undefined) continue;
      into.set(`${prop}:${JSON.stringify(canonicalize(claimed))}`, prop);
    }
    if ("children" in node && Array.isArray(node.children)) {
      collectFactualClaims(node.children, into);
    }
  }
  return into;
}

/**
 * An update replaces the component's whole tree, so a model asked to "change
 * the 42 to 50" can silently rewrite the company's own record while looking
 * like an edit. Every factual claim in the new tree must already exist in the
 * current one: restyling and dropping nodes stay allowed, inventing values
 * does not.
 */
export function assertFactualDataUnchanged(current: ComponentNode[], next: ComponentNode[]): void {
  const known = collectFactualClaims(current, new Map());

  for (const [claim, prop] of collectFactualClaims(next, new Map())) {
    if (!known.has(claim)) {
      throw new InvalidComponentTreeError(
        `${prop} carries data owned by the company and cannot be changed by an update; send it back exactly as it was, or drop the node entirely`,
      );
    }
  }
}
