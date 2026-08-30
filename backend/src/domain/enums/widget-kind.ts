export const GRID_COMPONENT_KINDS = ["container"] as const;

export type GridComponentKind = (typeof GRID_COMPONENT_KINDS)[number];

export const ATOMIC_NODE_KINDS = [
  "title",
  "trend-chart",
  "category-chart",
  "breakdown-chart",
  "stat",
  "label",
  "button",
  "layout",
] as const;

export type AtomicNodeKind = (typeof ATOMIC_NODE_KINDS)[number];

/**
 * The kinds that may carry children. The validator reads this set rather than
 * naming a kind, so adding a nestable kind is an entry here and no new branch.
 */
export const NESTABLE_ATOMIC_NODE_KINDS = new Set<AtomicNodeKind>(["layout"]);

/** How a layout arranges its children. Anything else is rejected. */
export const LAYOUT_DIRECTIONS = ["row", "column"] as const;

export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

// ponytail: closed set of business actions a button can trigger; the front-end
// mapping from action -> concrete request is explicitly out of scope for this
// change (see proposal.md Scope). Extend here if the AI needs more actions.
export const ACTION_KINDS = ["navigate", "confirm", "reject", "export", "refresh"] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];
