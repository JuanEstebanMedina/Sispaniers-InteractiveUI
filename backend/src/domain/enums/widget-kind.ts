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
  // Blocks a logistics screen actually needs: the sequence of what happened,
  // the fields pulled off a document, the rows to scan side by side.
  "timeline",
  "table",
  "key-values",
  "progress",
  "badge",
  "divider",
  "sparkline",
  "file",
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
/**
 * The datasets a node may name in `props.dataKey`.
 *
 * Derived slices of the operation the frontend already holds, so the agent
 * names one instead of shipping rows. Listed here — and validated — because a
 * name the frontend does not know renders an empty widget in silence, which is
 * the worst way for a mistake to show up on a supervision screen.
 *
 * Keep in step with SLICES in frontend/src/components/generated/ComponentData.
 */
export const DATA_SOURCE_NAMES = [
  "containers",
  "bookings",
  "documents",
  "containers-by-state",
  "schedule-changes",
] as const;

export type DataSourceName = (typeof DATA_SOURCE_NAMES)[number];

/**
 * How badly a container wants to be looked at.
 *
 * Severity of the block, not state of the cargo — `critical` is the agent
 * saying "read this first", and the grid tints the widget's frame so a
 * supervisor scanning nine of them sees which one matters without reading any.
 *
 * Three levels and no more: with five, nothing reads as urgent because the
 * middle three are indistinguishable at a glance.
 */
/**
 * The colours a node may ask for, on any element: the text of a title, the
 * tint of a button, the fill of one bar.
 *
 * Names and never values. A hex would look right in one theme and be invisible
 * in the other, and it would drift off the palette the moment the model
 * improvises — which is exactly what a generated UI must not do.
 *
 * Keep in step with frontend/src/components/generated/colors.ts.
 */
export const COLOR_NAMES = [
  "default",
  "muted",
  "subtle",
  "agent",
  "brand",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
] as const;

export type ColorName = (typeof COLOR_NAMES)[number];

export const COMPONENT_PRIORITIES = ["normal", "high", "critical"] as const;

export type ComponentPriority = (typeof COMPONENT_PRIORITIES)[number];

export const ACTION_KINDS = ["navigate", "confirm", "reject", "export", "refresh"] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];
