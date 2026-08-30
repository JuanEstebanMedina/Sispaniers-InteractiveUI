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
  "button-group",
] as const;

export type AtomicNodeKind = (typeof ATOMIC_NODE_KINDS)[number];

export const NESTABLE_ATOMIC_NODE_KINDS = new Set<AtomicNodeKind>(["button-group"]);

// ponytail: closed set of business actions a button can trigger; the front-end
// mapping from action -> concrete request is explicitly out of scope for this
// change (see proposal.md Scope). Extend here if the AI needs more actions.
export const ACTION_KINDS = ["navigate", "confirm", "reject", "export", "refresh"] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];
