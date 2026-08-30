import {
  ACTION_KINDS,
  ATOMIC_NODE_KINDS,
  type ActionKind,
  type AtomicNodeKind,
  LAYOUT_DIRECTIONS,
  NESTABLE_ATOMIC_NODE_KINDS,
} from "../enums/widget-kind.js";
import { MAX_COMPONENT_NODE_DEPTH } from "./component-node.js";
import { WIDGET_SIZES, type WidgetSizeName, fitsChart } from "./widget-size.js";

export interface NodeSpec {
  purpose: string;
  props: Record<string, string>;
  example: Record<string, unknown>;
  nestable: boolean;
  action?: ActionKind;
}

/**
 * What each kind is for and which props reach the renderer.
 *
 * The kinds, the actions, the directions and the sizes are NOT restated here —
 * they are read from the enums the validator itself uses, so the catalogue
 * cannot offer the agent something the API will reject. Only the prop names
 * live here, because the wire schema accepts any `props` bag and the renderer
 * is the only thing that knows which keys it reads.
 */
const NODE_SPECS: Record<AtomicNodeKind, Omit<NodeSpec, "nestable">> = {
  title: {
    purpose: "Heading of a widget. One per widget at most.",
    props: { text: "string — required", tone: "default | muted | agent | accent" },
    example: { text: "Vessel ETA", tone: "default" },
  },
  label: {
    purpose: "Secondary line of text: a caption, a source, an explanation.",
    props: { text: "string — required", tone: "default | muted | agent | accent" },
    example: { text: "Reported by the carrier on 2026-07-02", tone: "muted" },
  },
  stat: {
    purpose: "A single figure with its caption. The workhorse for numbers.",
    props: {
      value: "string — required, the figure itself",
      label: "string — what the figure measures",
      tone: "default | muted | agent | accent",
    },
    example: { value: "+7 days", label: "ETA delay", tone: "accent" },
  },
  button: {
    purpose: "Triggers one business action. Requires a top-level `action`.",
    props: { label: "string — required" },
    example: { label: "Notify client" },
    action: "navigate",
  },
  layout: {
    purpose: "Arranges its children in a row or a column. The only nestable kind.",
    props: {
      direction: `${LAYOUT_DIRECTIONS.join(" | ")} — defaults to column`,
      gap: "none | xs | sm | md | lg",
      align: "start | center | end | stretch",
      justify: "start | center | end | between",
      wrap: "boolean",
    },
    example: { direction: "row", gap: "md", justify: "between" },
  },
  "trend-chart": {
    purpose: "A value over time. Needs a dataset the host already provides.",
    props: {
      dataKey: "string — names a dataset the host supplies; it carries no rows itself",
      title: "string",
      xKey: "string — the row field on the x axis, defaults to 'x'",
      series: "array of { key, label, colorIndex } — which columns to draw",
    },
    example: {
      dataKey: "eta-history",
      title: "ETA over time",
      xKey: "date",
      series: [{ key: "eta", label: "ETA", colorIndex: 0 }],
    },
  },
  "category-chart": {
    purpose: "A value compared across categories.",
    props: {
      dataKey: "string — names a dataset the host supplies",
      title: "string",
      xKey: "string — the row field on the x axis, defaults to 'x'",
      series: "array of { key, label, colorIndex }",
    },
    example: {
      dataKey: "containers-by-state",
      title: "Containers by state",
      xKey: "state",
      series: [{ key: "count", label: "Containers", colorIndex: 0 }],
    },
  },
  "breakdown-chart": {
    purpose: "Parts of a whole.",
    props: {
      dataKey: "string — names a dataset the host supplies",
      title: "string",
    },
    example: { dataKey: "cost-breakdown", title: "Cost breakdown" },
  },
};

export const COMPONENT_CATALOG = {
  nodes: Object.fromEntries(
    ATOMIC_NODE_KINDS.map((kind) => [
      kind,
      { ...NODE_SPECS[kind], nestable: NESTABLE_ATOMIC_NODE_KINDS.has(kind) },
    ]),
  ) as Record<AtomicNodeKind, NodeSpec>,

  sizes: Object.fromEntries(
    (Object.keys(WIDGET_SIZES) as WidgetSizeName[]).map((name) => [
      name,
      { ...WIDGET_SIZES[name], fitsChart: fitsChart(name) },
    ]),
  ) as Record<WidgetSizeName, { w: number; h: number; fitsChart: boolean }>,

  actions: ACTION_KINDS,
  maxDepth: MAX_COMPONENT_NODE_DEPTH,
} as const;

function renderNode(kind: AtomicNodeKind, spec: NodeSpec): string {
  const props = Object.entries(spec.props)
    .map(([name, description]) => `    - ${name}: ${description}`)
    .join("\n");

  const notes = [
    spec.action ? `requires a top-level "action" (one of ${ACTION_KINDS.join(", ")})` : null,
    spec.nestable ? 'may carry "children"' : 'must NOT carry "children"',
  ]
    .filter((note) => note !== null)
    .join("; ");

  return [
    `- "${kind}" — ${spec.purpose}`,
    "  props:",
    props,
    `  rules: ${notes}`,
    `  example: ${JSON.stringify({ kind, order: 0, props: spec.example, ...(spec.action ? { action: spec.action } : {}) })}`,
  ].join("\n");
}

/**
 * The catalogue as a prompt block. Generated rather than written by hand so a
 * new kind, action or size reaches the agent the moment the enum changes.
 */
export function renderComponentCatalog(): string {
  const nodes = ATOMIC_NODE_KINDS.map((kind) =>
    renderNode(kind, COMPONENT_CATALOG.nodes[kind]),
  ).join("\n\n");

  const sizes = (Object.keys(COMPONENT_CATALOG.sizes) as WidgetSizeName[])
    .map((name) => {
      const { w, h, fitsChart: chartable } = COMPONENT_CATALOG.sizes[name];
      return `- ${name}: ${w} columns x ${h} rows${chartable ? "" : " — too small to hold a chart"}`;
    })
    .join("\n");

  return `## Component catalogue

A widget is one container holding a tree of nodes. Every node is
{ "kind", "order", "props" }, plus "action" on a button and "children" on a layout.
"order" is an integer and decides the sequence; array position does not.
Nesting is capped at ${COMPONENT_CATALOG.maxDepth} levels.

### Node kinds — these are the ONLY valid values of "kind"

${nodes}

### Sizes — these are the ONLY valid values of "size"

${sizes}

A chart in a size marked above as too small is rejected outright.
`;
}
